import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { lodgeScope } from '../middleware/lodgeScope.js';
import { requireRole } from '../middleware/roleGuard.js';

export async function duesRoutes(fastify: FastifyInstance) {
  const preHandler = [authenticate, lodgeScope];

  // GET / — list dues records for lodge (filter by year, status)
  fastify.get('/', { preHandler }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const { year, status, page = '1', limit = '50' } = request.query as {
      year?: string;
      status?: string;
      page?: string;
      limit?: string;
    };

    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), 100);

    const where: any = { lodgeId };
    if (year) where.year = parseInt(year, 10);
    if (status) where.status = status;

    const [records, total] = await Promise.all([
      fastify.prisma.duesRecord.findMany({
        where,
        include: {
          member: { select: { id: true, firstName: true, lastName: true, degree: true, status: true } },
        },
        orderBy: [{ year: 'desc' }, { member: { lastName: 'asc' } }],
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      fastify.prisma.duesRecord.count({ where }),
    ]);

    return reply.send({
      records,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  });

  // GET /member/:memberId — dues history for member
  fastify.get('/member/:memberId', { preHandler }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const { memberId } = request.params as { memberId: string };

    const records = await fastify.prisma.duesRecord.findMany({
      where: { memberId, lodgeId },
      orderBy: { year: 'desc' },
    });

    return reply.send(records);
  });

  // POST / — create dues record (TREASURER)
  fastify.post('/', {
    preHandler: [...preHandler, requireRole('TREASURER', 'WORSHIPFUL_MASTER', 'SECRETARY')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const {
      memberId, year, amount, grandLodgePortion, provincialPortion, lodgePortion,
      dueDate, status, instalmentPlan, notes,
    } = request.body as {
      memberId: string;
      year: number;
      amount: number;
      grandLodgePortion?: number;
      provincialPortion?: number;
      lodgePortion?: number;
      dueDate?: string;
      status?: string;
      instalmentPlan?: boolean;
      notes?: string;
    };

    // Verify member belongs to this lodge
    const member = await fastify.prisma.member.findFirst({
      where: { id: memberId, lodgeId },
    });
    if (!member) {
      return reply.status(404).send({ error: 'Member not found in this lodge' });
    }

    const record = await fastify.prisma.duesRecord.create({
      data: {
        memberId,
        lodgeId,
        year,
        amount,
        grandLodgePortion,
        provincialPortion,
        lodgePortion,
        dueDate: dueDate ? new Date(dueDate) : null,
        status: (status as any) || 'CURRENT',
        instalmentPlan: instalmentPlan ?? false,
        notes,
      },
      include: {
        member: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return reply.status(201).send(record);
  });

  // PUT /:id — update dues record
  fastify.put('/:id', {
    preHandler: [...preHandler, requireRole('TREASURER', 'WORSHIPFUL_MASTER', 'SECRETARY')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const lodgeId = (request as any).lodgeId;
    const body = request.body as Record<string, any>;

    const existing = await fastify.prisma.duesRecord.findFirst({
      where: { id, lodgeId },
    });
    if (!existing) {
      return reply.status(404).send({ error: 'Dues record not found' });
    }

    const data: any = {};
    if (body.amount !== undefined) data.amount = body.amount;
    if (body.grandLodgePortion !== undefined) data.grandLodgePortion = body.grandLodgePortion;
    if (body.provincialPortion !== undefined) data.provincialPortion = body.provincialPortion;
    if (body.lodgePortion !== undefined) data.lodgePortion = body.lodgePortion;
    if (body.status !== undefined) data.status = body.status;
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body.paidDate !== undefined) data.paidDate = body.paidDate ? new Date(body.paidDate) : null;
    if (body.paidAmount !== undefined) data.paidAmount = body.paidAmount;
    if (body.paymentMethod !== undefined) data.paymentMethod = body.paymentMethod;
    if (body.instalmentPlan !== undefined) data.instalmentPlan = body.instalmentPlan;
    if (body.notes !== undefined) data.notes = body.notes;

    const record = await fastify.prisma.duesRecord.update({
      where: { id },
      data,
      include: {
        member: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return reply.send(record);
  });

  // POST /generate — bulk generate dues for all active members for a year
  fastify.post('/generate', {
    preHandler: [...preHandler, requireRole('TREASURER', 'WORSHIPFUL_MASTER', 'SECRETARY')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const { year, dueDate } = request.body as {
      year: number;
      dueDate?: string;
    };

    // Get lodge dues amounts
    const lodge = await fastify.prisma.lodge.findUnique({
      where: { id: lodgeId },
      select: { annualDues: true, grandLodgeDues: true, provincialDues: true },
    });
    if (!lodge || !lodge.annualDues) {
      return reply.status(400).send({ error: 'Lodge annual dues amount not configured' });
    }

    // Get all active members (exclude HONORARY and those already with records for this year)
    const existingRecords = await fastify.prisma.duesRecord.findMany({
      where: { lodgeId, year },
      select: { memberId: true },
    });
    const existingMemberIds = new Set(existingRecords.map((r) => r.memberId));

    const activeMembers = await fastify.prisma.member.findMany({
      where: {
        lodgeId,
        status: { in: ['ACTIVE', 'COUNTRY_MEMBER'] },
      },
      select: { id: true, status: true },
    });

    const membersToGenerate = activeMembers.filter((m) => !existingMemberIds.has(m.id));

    if (membersToGenerate.length === 0) {
      return reply.send({ message: 'No new dues records to generate', created: 0 });
    }

    const lodgePortion = lodge.annualDues - (lodge.grandLodgeDues ?? 0) - (lodge.provincialDues ?? 0);

    const records = await fastify.prisma.duesRecord.createMany({
      data: membersToGenerate.map((m) => ({
        memberId: m.id,
        lodgeId,
        year,
        amount: lodge.annualDues!,
        grandLodgePortion: lodge.grandLodgeDues,
        provincialPortion: lodge.provincialDues,
        lodgePortion: lodgePortion > 0 ? lodgePortion : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        status: 'CURRENT' as const,
      })),
    });

    return reply.status(201).send({
      message: `Generated ${records.count} dues records for year ${year}`,
      created: records.count,
    });
  });
}
