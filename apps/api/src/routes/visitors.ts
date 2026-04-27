import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { lodgeScope } from '../middleware/lodgeScope.js';
import { requireRole } from '../middleware/roleGuard.js';

export async function visitorRoutes(fastify: FastifyInstance) {
  const preHandler = [authenticate, lodgeScope];

  // GET /meeting/:meetingId — visitors for a meeting
  fastify.get('/meeting/:meetingId', { preHandler }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const { meetingId } = request.params as { meetingId: string };

    // Verify meeting belongs to this lodge
    const meeting = await fastify.prisma.meeting.findFirst({
      where: { id: meetingId, lodgeId },
      select: { id: true, date: true, type: true },
    });
    if (!meeting) {
      return reply.status(404).send({ error: 'Meeting not found in this lodge' });
    }

    const visitors = await fastify.prisma.visitor.findMany({
      where: { meetingId },
      orderBy: { lastName: 'asc' },
    });

    return reply.send({ meeting, visitors });
  });

  // POST / — register visitor
  fastify.post('/', { preHandler }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const {
      meetingId, firstName, lastName, rank, degree, lodgeName, lodgeNumber,
      provinceName, dining, diningChoice, guestOf,
    } = request.body as {
      meetingId: string;
      firstName: string;
      lastName: string;
      rank?: string;
      degree?: string;
      lodgeName: string;
      lodgeNumber?: string;
      provinceName?: string;
      dining?: boolean;
      diningChoice?: string;
      guestOf?: string;
    };

    // Verify meeting belongs to this lodge
    const meeting = await fastify.prisma.meeting.findFirst({
      where: { id: meetingId, lodgeId },
    });
    if (!meeting) {
      return reply.status(404).send({ error: 'Meeting not found in this lodge' });
    }

    const visitor = await fastify.prisma.visitor.create({
      data: {
        meetingId,
        firstName,
        lastName,
        rank,
        degree: (degree as any) || 'MASTER_MASON',
        lodgeName,
        lodgeNumber,
        provinceName,
        dining: dining ?? false,
        diningChoice,
        guestOf,
      },
    });

    return reply.status(201).send(visitor);
  });

  // PUT /:id — update visitor
  fastify.put('/:id', { preHandler }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const lodgeId = (request as any).lodgeId;
    const body = request.body as Record<string, any>;

    const existing = await fastify.prisma.visitor.findFirst({
      where: { id, meeting: { lodgeId } },
    });
    if (!existing) {
      return reply.status(404).send({ error: 'Visitor not found' });
    }

    const data: any = {};
    if (body.firstName !== undefined) data.firstName = body.firstName;
    if (body.lastName !== undefined) data.lastName = body.lastName;
    if (body.rank !== undefined) data.rank = body.rank;
    if (body.degree !== undefined) data.degree = body.degree;
    if (body.lodgeName !== undefined) data.lodgeName = body.lodgeName;
    if (body.lodgeNumber !== undefined) data.lodgeNumber = body.lodgeNumber;
    if (body.provinceName !== undefined) data.provinceName = body.provinceName;
    if (body.dining !== undefined) data.dining = body.dining;
    if (body.diningChoice !== undefined) data.diningChoice = body.diningChoice;
    if (body.guestOf !== undefined) data.guestOf = body.guestOf;

    const visitor = await fastify.prisma.visitor.update({
      where: { id },
      data,
    });

    return reply.send(visitor);
  });

  // DELETE /:id — remove visitor
  fastify.delete('/:id', { preHandler }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const lodgeId = (request as any).lodgeId;

    const existing = await fastify.prisma.visitor.findFirst({
      where: { id, meeting: { lodgeId } },
    });
    if (!existing) {
      return reply.status(404).send({ error: 'Visitor not found' });
    }

    await fastify.prisma.visitor.delete({ where: { id } });

    return reply.status(204).send();
  });
}
