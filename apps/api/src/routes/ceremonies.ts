import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { lodgeScope } from '../middleware/lodgeScope.js';
import { requireRole } from '../middleware/roleGuard.js';

export async function ceremonyRoutes(fastify: FastifyInstance) {
  const preHandler = [authenticate, lodgeScope];

  // GET / — list ceremony plans for lodge
  fastify.get('/', { preHandler }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const plans = await fastify.prisma.ceremonyPlan.findMany({
      where: {
        meeting: { lodgeId },
      },
      include: {
        meeting: { select: { id: true, date: true, type: true, ceremonyType: true, candidateName: true } },
        roles: { include: { member: { select: { id: true, firstName: true, lastName: true } } } },
        rehearsals: { orderBy: { date: 'asc' } },
      },
      orderBy: { meeting: { date: 'desc' } },
    });
    return reply.send(plans);
  });

  // GET /:id — single ceremony plan with roles and rehearsals
  fastify.get('/:id', { preHandler }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const lodgeId = (request as any).lodgeId;

    const plan = await fastify.prisma.ceremonyPlan.findFirst({
      where: { id, meeting: { lodgeId } },
      include: {
        meeting: true,
        roles: {
          include: { member: { select: { id: true, firstName: true, lastName: true } } },
        },
        rehearsals: { orderBy: { date: 'asc' } },
      },
    });

    if (!plan) {
      return reply.status(404).send({ error: 'Ceremony plan not found' });
    }
    return reply.send(plan);
  });

  // POST / — create ceremony plan for a meeting (DC, WM, SECRETARY)
  fastify.post('/', {
    preHandler: [...preHandler, requireRole('DIRECTOR_OF_CEREMONIES', 'WORSHIPFUL_MASTER', 'SECRETARY')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const { meetingId, ceremonyType, allocations, equipmentChecklist, notes } = request.body as {
      meetingId: string;
      ceremonyType: string;
      allocations: Record<string, string>;
      equipmentChecklist?: Record<string, boolean>;
      notes?: string;
    };

    // Verify the meeting belongs to this lodge
    const meeting = await fastify.prisma.meeting.findFirst({
      where: { id: meetingId, lodgeId },
    });
    if (!meeting) {
      return reply.status(404).send({ error: 'Meeting not found in this lodge' });
    }

    // Check no existing plan for this meeting
    const existing = await fastify.prisma.ceremonyPlan.findUnique({
      where: { meetingId },
    });
    if (existing) {
      return reply.status(409).send({ error: 'Ceremony plan already exists for this meeting' });
    }

    const plan = await fastify.prisma.ceremonyPlan.create({
      data: {
        ceremonyType,
        allocations: allocations ?? {},
        equipmentChecklist: equipmentChecklist ?? null,
        notes,
        meetingId,
      },
      include: {
        meeting: { select: { id: true, date: true, type: true } },
      },
    });

    return reply.status(201).send(plan);
  });

  // PUT /:id — update allocations
  fastify.put('/:id', {
    preHandler: [...preHandler, requireRole('DIRECTOR_OF_CEREMONIES', 'WORSHIPFUL_MASTER', 'SECRETARY')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const lodgeId = (request as any).lodgeId;
    const { ceremonyType, allocations, equipmentChecklist, notes } = request.body as {
      ceremonyType?: string;
      allocations?: Record<string, string>;
      equipmentChecklist?: Record<string, boolean>;
      notes?: string;
    };

    const existing = await fastify.prisma.ceremonyPlan.findFirst({
      where: { id, meeting: { lodgeId } },
    });
    if (!existing) {
      return reply.status(404).send({ error: 'Ceremony plan not found' });
    }

    const plan = await fastify.prisma.ceremonyPlan.update({
      where: { id },
      data: {
        ...(ceremonyType !== undefined && { ceremonyType }),
        ...(allocations !== undefined && { allocations }),
        ...(equipmentChecklist !== undefined && { equipmentChecklist }),
        ...(notes !== undefined && { notes }),
      },
      include: {
        meeting: { select: { id: true, date: true, type: true } },
        roles: { include: { member: { select: { id: true, firstName: true, lastName: true } } } },
      },
    });

    return reply.send(plan);
  });

  // POST /:id/roles — assign ceremony roles
  fastify.post('/:id/roles', {
    preHandler: [...preHandler, requireRole('DIRECTOR_OF_CEREMONIES', 'WORSHIPFUL_MASTER', 'SECRETARY')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const lodgeId = (request as any).lodgeId;
    const { roles } = request.body as {
      roles: Array<{ role: string; memberId: string; confirmed?: boolean }>;
    };

    const plan = await fastify.prisma.ceremonyPlan.findFirst({
      where: { id, meeting: { lodgeId } },
    });
    if (!plan) {
      return reply.status(404).send({ error: 'Ceremony plan not found' });
    }

    // Upsert roles
    const results = await Promise.all(
      roles.map((r) =>
        fastify.prisma.ceremonyRole.upsert({
          where: { ceremonyPlanId_role: { ceremonyPlanId: id, role: r.role } },
          create: {
            role: r.role,
            memberId: r.memberId,
            confirmed: r.confirmed ?? false,
            ceremonyPlanId: id,
          },
          update: {
            memberId: r.memberId,
            confirmed: r.confirmed ?? false,
          },
          include: { member: { select: { id: true, firstName: true, lastName: true } } },
        })
      )
    );

    return reply.status(201).send(results);
  });

  // POST /:id/rehearsals — schedule rehearsal
  fastify.post('/:id/rehearsals', {
    preHandler: [...preHandler, requireRole('DIRECTOR_OF_CEREMONIES', 'WORSHIPFUL_MASTER', 'SECRETARY')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const lodgeId = (request as any).lodgeId;
    const { date, time, venue, notes, attendees } = request.body as {
      date: string;
      time?: string;
      venue?: string;
      notes?: string;
      attendees?: string[];
    };

    const plan = await fastify.prisma.ceremonyPlan.findFirst({
      where: { id, meeting: { lodgeId } },
    });
    if (!plan) {
      return reply.status(404).send({ error: 'Ceremony plan not found' });
    }

    const rehearsal = await fastify.prisma.rehearsal.create({
      data: {
        date: new Date(date),
        time,
        venue,
        notes,
        attendees: attendees ?? null,
        ceremonyPlanId: id,
      },
    });

    return reply.status(201).send(rehearsal);
  });

  // PUT /:id/confirm — confirm ceremony plan
  fastify.put('/:id/confirm', {
    preHandler: [...preHandler, requireRole('DIRECTOR_OF_CEREMONIES', 'WORSHIPFUL_MASTER', 'SECRETARY')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const lodgeId = (request as any).lodgeId;

    const existing = await fastify.prisma.ceremonyPlan.findFirst({
      where: { id, meeting: { lodgeId } },
    });
    if (!existing) {
      return reply.status(404).send({ error: 'Ceremony plan not found' });
    }

    const plan = await fastify.prisma.ceremonyPlan.update({
      where: { id },
      data: { isConfirmed: true },
      include: {
        meeting: { select: { id: true, date: true, type: true } },
        roles: { include: { member: { select: { id: true, firstName: true, lastName: true } } } },
      },
    });

    return reply.send(plan);
  });
}
