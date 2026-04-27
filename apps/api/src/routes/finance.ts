import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { lodgeScope } from '../middleware/lodgeScope.js';
import { requireRole } from '../middleware/roleGuard.js';

export async function financeRoutes(fastify: FastifyInstance) {
  const preHandler = [authenticate, lodgeScope];

  // GET /accounts — list accounts for lodge
  fastify.get('/accounts', { preHandler }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;

    const accounts = await fastify.prisma.account.findMany({
      where: { lodgeId },
      orderBy: { name: 'asc' },
    });

    return reply.send(accounts);
  });

  // POST /accounts — create account (TREASURER only)
  fastify.post('/accounts', {
    preHandler: [...preHandler, requireRole('TREASURER', 'WORSHIPFUL_MASTER', 'SECRETARY')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const { name, type, xeroAccountCode } = request.body as {
      name: string;
      type: string;
      xeroAccountCode?: string;
    };

    const account = await fastify.prisma.account.create({
      data: {
        name,
        type: type as any,
        xeroAccountCode,
        lodgeId,
      },
    });

    return reply.status(201).send(account);
  });

  // GET /accounts/:id — account with transactions
  fastify.get('/accounts/:id', { preHandler }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const lodgeId = (request as any).lodgeId;

    const account = await fastify.prisma.account.findFirst({
      where: { id, lodgeId },
      include: {
        transactions: {
          orderBy: { date: 'desc' },
          take: 50,
        },
      },
    });

    if (!account) {
      return reply.status(404).send({ error: 'Account not found' });
    }

    return reply.send(account);
  });

  // GET /transactions — list transactions (paginated, filterable)
  fastify.get('/transactions', { preHandler }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const {
      accountId,
      category,
      dateFrom,
      dateTo,
      type,
      page = '1',
      limit = '50',
    } = request.query as {
      accountId?: string;
      category?: string;
      dateFrom?: string;
      dateTo?: string;
      type?: string;
      page?: string;
      limit?: string;
    };

    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), 100);

    const where: any = {
      account: { lodgeId },
    };

    if (accountId) where.accountId = accountId;
    if (category) where.category = category;
    if (type) where.type = type;
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) where.date.lte = new Date(dateTo);
    }

    const [transactions, total] = await Promise.all([
      fastify.prisma.transaction.findMany({
        where,
        include: {
          account: { select: { id: true, name: true, type: true } },
        },
        orderBy: { date: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      fastify.prisma.transaction.count({ where }),
    ]);

    return reply.send({
      transactions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  });

  // POST /transactions — create transaction (TREASURER)
  fastify.post('/transactions', {
    preHandler: [...preHandler, requireRole('TREASURER', 'WORSHIPFUL_MASTER', 'SECRETARY')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const { type, amount, description, date, reference, category, accountId, memberId } = request.body as {
      type: string;
      amount: number;
      description: string;
      date?: string;
      reference?: string;
      category?: string;
      accountId: string;
      memberId?: string;
    };

    // Verify account belongs to this lodge
    const account = await fastify.prisma.account.findFirst({
      where: { id: accountId, lodgeId },
    });
    if (!account) {
      return reply.status(404).send({ error: 'Account not found in this lodge' });
    }

    const transaction = await fastify.prisma.transaction.create({
      data: {
        type: type as any,
        amount,
        description,
        date: date ? new Date(date) : new Date(),
        reference,
        category,
        accountId,
        memberId,
      },
      include: {
        account: { select: { id: true, name: true, type: true } },
      },
    });

    // Update account balance
    const balanceChange = type === 'INCOME' ? amount : type === 'EXPENSE' ? -amount : 0;
    if (balanceChange !== 0) {
      await fastify.prisma.account.update({
        where: { id: accountId },
        data: { balance: { increment: balanceChange } },
      });
    }

    return reply.status(201).send(transaction);
  });
}
