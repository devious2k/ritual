import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { lodgeScope } from '../middleware/lodgeScope.js';
import { requireRole } from '../middleware/roleGuard.js';
import { createAuditLog } from '../services/auditService.js';

export async function degreeRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma;

  // GET /degrees/member/:memberId — Progression history
  fastify.get('/member/:memberId', {
    preHandler: [authenticate, lodgeScope],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { memberId } = request.params as { memberId: string };
    const lodgeId = (request as any).lodgeId;

    // Verify member belongs to lodge
    const member = await prisma.member.findFirst({
      where: { id: memberId, lodgeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        degree: true,
        dateInitiated: true,
        datePassed: true,
        dateRaised: true,
      },
    });

    if (!member) {
      return reply.status(404).send({ error: 'Member not found in this lodge' });
    }

    const progressions = await prisma.degreeProgression.findMany({
      where: { memberId },
      orderBy: { ceremonyDate: 'asc' },
    });

    return reply.send({
      member,
      progressions,
    });
  });

  // POST /degrees — Record degree progression
  fastify.post('/', {
    preHandler: [
      authenticate,
      lodgeScope,
      requireRole('SECRETARY', 'WORSHIPFUL_MASTER', 'DIRECTOR_OF_CEREMONIES', 'PROVINCE_ADMIN'),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const body = request.body as {
      memberId: string;
      degree: string;
      ceremonyDate: string;
      conductedBy?: string;
      lodgeOfCeremony?: string;
      notes?: string;
    };

    if (!body.memberId || !body.degree || !body.ceremonyDate) {
      return reply.status(400).send({ error: 'memberId, degree, and ceremonyDate are required' });
    }

    // Verify member belongs to lodge
    const member = await prisma.member.findFirst({
      where: { id: body.memberId, lodgeId },
    });
    if (!member) {
      return reply.status(404).send({ error: 'Member not found in this lodge' });
    }

    const progression = await prisma.$transaction(async (tx) => {
      // Create degree progression record
      const prog = await tx.degreeProgression.create({
        data: {
          memberId: body.memberId,
          degree: body.degree as any,
          ceremonyDate: new Date(body.ceremonyDate),
          conductedBy: body.conductedBy,
          lodgeOfCeremony: body.lodgeOfCeremony,
          notes: body.notes,
        },
      });

      // Update member's current degree and corresponding date
      const memberUpdate: Record<string, any> = {
        degree: body.degree as any,
      };

      switch (body.degree) {
        case 'ENTERED_APPRENTICE':
          memberUpdate.dateInitiated = new Date(body.ceremonyDate);
          break;
        case 'FELLOW_CRAFT':
          memberUpdate.datePassed = new Date(body.ceremonyDate);
          break;
        case 'MASTER_MASON':
          memberUpdate.dateRaised = new Date(body.ceremonyDate);
          break;
      }

      await tx.member.update({
        where: { id: body.memberId },
        data: memberUpdate,
      });

      return prog;
    });

    await createAuditLog(prisma, {
      action: 'CREATE',
      entity: 'DegreeProgression',
      entityId: progression.id,
      details: { memberId: body.memberId, degree: body.degree },
      userId: request.user.userId,
      lodgeId,
      ipAddress: request.ip,
    });

    return reply.status(201).send(progression);
  });

  // PUT /degrees/:id/proficiency — Mark proficiency as passed
  fastify.put('/:id/proficiency', {
    preHandler: [
      authenticate,
      lodgeScope,
      requireRole('SECRETARY', 'WORSHIPFUL_MASTER', 'MENTOR', 'DIRECTOR_OF_CEREMONIES', 'PROVINCE_ADMIN'),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const lodgeId = (request as any).lodgeId;
    const body = request.body as {
      proficiencyPassed: boolean;
      proficiencyDate?: string;
      notes?: string;
    };

    // Verify progression exists and member belongs to lodge
    const progression = await prisma.degreeProgression.findUnique({
      where: { id },
      include: { member: { select: { lodgeId: true } } },
    });

    if (!progression || progression.member.lodgeId !== lodgeId) {
      return reply.status(404).send({ error: 'Degree progression not found' });
    }

    const updated = await prisma.degreeProgression.update({
      where: { id },
      data: {
        proficiencyPassed: body.proficiencyPassed ?? true,
        proficiencyDate: body.proficiencyDate ? new Date(body.proficiencyDate) : new Date(),
        notes: body.notes !== undefined ? body.notes : undefined,
      },
    });

    return reply.send(updated);
  });

  // GET /degrees/mentoring — List mentor assignments
  fastify.get('/mentoring', {
    preHandler: [authenticate, lodgeScope],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const { active } = request.query as { active?: string };

    const where: any = {
      mentor: { lodgeId },
    };

    if (active !== undefined) {
      where.isActive = active === 'true';
    }

    const assignments = await prisma.mentorAssignment.findMany({
      where,
      orderBy: { assignedDate: 'desc' },
      include: {
        mentor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            degree: true,
          },
        },
        mentee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            degree: true,
          },
        },
      },
    });

    return reply.send({ data: assignments });
  });

  // POST /degrees/mentoring — Assign mentor to mentee
  fastify.post('/mentoring', {
    preHandler: [
      authenticate,
      lodgeScope,
      requireRole('SECRETARY', 'WORSHIPFUL_MASTER', 'MENTOR', 'PROVINCE_ADMIN'),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const body = request.body as {
      mentorId: string;
      menteeId: string;
      notes?: string;
    };

    if (!body.mentorId || !body.menteeId) {
      return reply.status(400).send({ error: 'mentorId and menteeId are required' });
    }

    if (body.mentorId === body.menteeId) {
      return reply.status(400).send({ error: 'Mentor and mentee must be different members' });
    }

    // Verify both members belong to lodge
    const [mentor, mentee] = await Promise.all([
      prisma.member.findFirst({ where: { id: body.mentorId, lodgeId } }),
      prisma.member.findFirst({ where: { id: body.menteeId, lodgeId } }),
    ]);

    if (!mentor) {
      return reply.status(404).send({ error: 'Mentor not found in this lodge' });
    }
    if (!mentee) {
      return reply.status(404).send({ error: 'Mentee not found in this lodge' });
    }

    // Check for existing active assignment
    const existing = await prisma.mentorAssignment.findFirst({
      where: { mentorId: body.mentorId, menteeId: body.menteeId, isActive: true },
    });
    if (existing) {
      return reply.status(409).send({ error: 'Active mentor assignment already exists' });
    }

    const assignment = await prisma.mentorAssignment.create({
      data: {
        mentorId: body.mentorId,
        menteeId: body.menteeId,
        notes: body.notes,
      },
      include: {
        mentor: {
          select: { id: true, firstName: true, lastName: true },
        },
        mentee: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    await createAuditLog(prisma, {
      action: 'CREATE',
      entity: 'MentorAssignment',
      entityId: assignment.id,
      details: { mentorId: body.mentorId, menteeId: body.menteeId },
      userId: request.user.userId,
      lodgeId,
      ipAddress: request.ip,
    });

    return reply.status(201).send(assignment);
  });
}
