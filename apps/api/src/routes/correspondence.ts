import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { lodgeScope } from '../middleware/lodgeScope.js';
import { requireRole } from '../middleware/roleGuard.js';

export async function correspondenceRoutes(fastify: FastifyInstance) {
  const preHandler = [authenticate, lodgeScope];

  // GET / — list correspondence (paginated, filter by type)
  fastify.get('/', { preHandler }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const { type, page = '1', limit = '50' } = request.query as {
      type?: string;
      page?: string;
      limit?: string;
    };

    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), 100);

    const where: any = { lodgeId };
    if (type) where.type = type;

    const [items, total] = await Promise.all([
      fastify.prisma.correspondence.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      fastify.prisma.correspondence.count({ where }),
    ]);

    return reply.send({
      correspondence: items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  });

  // GET /:id — single correspondence
  fastify.get('/:id', { preHandler }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const lodgeId = (request as any).lodgeId;

    const item = await fastify.prisma.correspondence.findFirst({
      where: { id, lodgeId },
    });

    if (!item) {
      return reply.status(404).send({ error: 'Correspondence not found' });
    }

    return reply.send(item);
  });

  // POST / — create correspondence (SECRETARY)
  fastify.post('/', {
    preHandler: [...preHandler, requireRole('SECRETARY', 'WORSHIPFUL_MASTER')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const { type, from, to, subject, body, date, docFlowId } = request.body as {
      type: string;
      from: string;
      to: string;
      subject: string;
      body?: string;
      date?: string;
      docFlowId?: string;
    };

    const item = await fastify.prisma.correspondence.create({
      data: {
        type: type as any,
        from,
        to,
        subject,
        body,
        date: date ? new Date(date) : new Date(),
        docFlowId,
        lodgeId,
      },
    });

    return reply.status(201).send(item);
  });

  // PUT /:id — update (mark as read, etc.)
  fastify.put('/:id', {
    preHandler: [...preHandler, requireRole('SECRETARY', 'WORSHIPFUL_MASTER')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const lodgeId = (request as any).lodgeId;
    const updateBody = request.body as Record<string, any>;

    const existing = await fastify.prisma.correspondence.findFirst({
      where: { id, lodgeId },
    });
    if (!existing) {
      return reply.status(404).send({ error: 'Correspondence not found' });
    }

    const data: any = {};
    if (updateBody.isRead !== undefined) data.isRead = updateBody.isRead;
    if (updateBody.subject !== undefined) data.subject = updateBody.subject;
    if (updateBody.body !== undefined) data.body = updateBody.body;
    if (updateBody.from !== undefined) data.from = updateBody.from;
    if (updateBody.to !== undefined) data.to = updateBody.to;
    if (updateBody.type !== undefined) data.type = updateBody.type;
    if (updateBody.docFlowId !== undefined) data.docFlowId = updateBody.docFlowId;

    const item = await fastify.prisma.correspondence.update({
      where: { id },
      data,
    });

    return reply.send(item);
  });
}
