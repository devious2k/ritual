import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { lodgeScope } from '../middleware/lodgeScope.js';
import { requireRole } from '../middleware/roleGuard.js';

export async function honoursRoutes(fastify: FastifyInstance) {
  const preHandler = [authenticate, lodgeScope];

  // GET / — list honours for lodge members
  fastify.get('/', { preHandler }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const { level } = request.query as { level?: string };

    const where: any = { member: { lodgeId } };
    if (level) where.level = level;

    const honours = await fastify.prisma.honour.findMany({
      where,
      include: {
        member: { select: { id: true, firstName: true, lastName: true, degree: true } },
      },
      orderBy: { dateConferred: 'desc' },
    });

    return reply.send(honours);
  });

  // GET /member/:memberId — honours for specific member
  fastify.get('/member/:memberId', { preHandler }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const { memberId } = request.params as { memberId: string };

    // Verify member belongs to this lodge
    const member = await fastify.prisma.member.findFirst({
      where: { id: memberId, lodgeId },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!member) {
      return reply.status(404).send({ error: 'Member not found in this lodge' });
    }

    const honours = await fastify.prisma.honour.findMany({
      where: { memberId },
      orderBy: { dateConferred: 'desc' },
    });

    return reply.send({ member, honours });
  });

  // POST / — record new honour (SECRETARY, WM, PROVINCE_ADMIN)
  fastify.post('/', {
    preHandler: [...preHandler, requireRole('SECRETARY', 'WORSHIPFUL_MASTER', 'PROVINCE_ADMIN')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const { memberId, rank, fullTitle, level, dateConferred, dateGazetted } = request.body as {
      memberId: string;
      rank: string;
      fullTitle: string;
      level: string;
      dateConferred?: string;
      dateGazetted?: string;
    };

    // Verify member belongs to this lodge
    const member = await fastify.prisma.member.findFirst({
      where: { id: memberId, lodgeId },
    });
    if (!member) {
      return reply.status(404).send({ error: 'Member not found in this lodge' });
    }

    const honour = await fastify.prisma.honour.create({
      data: {
        memberId,
        rank,
        fullTitle,
        level: level as any,
        dateConferred: dateConferred ? new Date(dateConferred) : null,
        dateGazetted: dateGazetted ? new Date(dateGazetted) : null,
      },
      include: {
        member: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return reply.status(201).send(honour);
  });

  // PUT /:id — update honour
  fastify.put('/:id', {
    preHandler: [...preHandler, requireRole('SECRETARY', 'WORSHIPFUL_MASTER', 'PROVINCE_ADMIN')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const lodgeId = (request as any).lodgeId;
    const body = request.body as Record<string, any>;

    const existing = await fastify.prisma.honour.findFirst({
      where: { id, member: { lodgeId } },
    });
    if (!existing) {
      return reply.status(404).send({ error: 'Honour not found' });
    }

    const data: any = {};
    if (body.rank !== undefined) data.rank = body.rank;
    if (body.fullTitle !== undefined) data.fullTitle = body.fullTitle;
    if (body.level !== undefined) data.level = body.level;
    if (body.dateConferred !== undefined) data.dateConferred = body.dateConferred ? new Date(body.dateConferred) : null;
    if (body.dateGazetted !== undefined) data.dateGazetted = body.dateGazetted ? new Date(body.dateGazetted) : null;

    const honour = await fastify.prisma.honour.update({
      where: { id },
      data,
      include: {
        member: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return reply.send(honour);
  });
}
