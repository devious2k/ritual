import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { lodgeScope } from '../middleware/lodgeScope.js';
import { requireRole } from '../middleware/roleGuard.js';
import { createAuditLog } from '../services/auditService.js';

export async function officerRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma;

  // GET /officers — List officers for lodge (optional ?year filter)
  fastify.get('/', {
    preHandler: [authenticate, lodgeScope],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const { year } = request.query as { year?: string };

    const where: any = { lodgeId };
    if (year) {
      where.year = parseInt(year, 10);
    }

    const officers = await prisma.officer.findMany({
      where,
      orderBy: [{ year: 'desc' }, { office: 'asc' }],
      include: {
        member: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            degree: true,
            photoUrl: true,
          },
        },
      },
    });

    return reply.send({ data: officers });
  });

  // GET /officers/current — Current active officers
  fastify.get('/current', {
    preHandler: [authenticate, lodgeScope],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;

    const officers = await prisma.officer.findMany({
      where: { lodgeId, isActive: true },
      orderBy: { office: 'asc' },
      include: {
        member: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            degree: true,
            photoUrl: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    return reply.send({ data: officers });
  });

  // POST /officers — Appoint officer
  fastify.post('/', {
    preHandler: [
      authenticate,
      lodgeScope,
      requireRole('WORSHIPFUL_MASTER', 'SECRETARY', 'DIRECTOR_OF_CEREMONIES', 'PROVINCE_ADMIN'),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const body = request.body as {
      memberId: string;
      office: string;
      year: number;
      installedDate?: string;
      investedDate?: string;
    };

    if (!body.memberId || !body.office || !body.year) {
      return reply.status(400).send({ error: 'memberId, office, and year are required' });
    }

    // Verify member belongs to lodge
    const member = await prisma.member.findFirst({
      where: { id: body.memberId, lodgeId },
    });
    if (!member) {
      return reply.status(404).send({ error: 'Member not found in this lodge' });
    }

    // Deactivate previous holder of this office for the same year
    await prisma.officer.updateMany({
      where: { lodgeId, office: body.office as any, year: body.year, isActive: true },
      data: { isActive: false },
    });

    const officer = await prisma.officer.create({
      data: {
        memberId: body.memberId,
        office: body.office as any,
        year: body.year,
        installedDate: body.installedDate ? new Date(body.installedDate) : undefined,
        investedDate: body.investedDate ? new Date(body.investedDate) : undefined,
        isActive: true,
        lodgeId,
      },
      include: {
        member: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    await createAuditLog(prisma, {
      action: 'CREATE',
      entity: 'Officer',
      entityId: officer.id,
      details: { office: body.office, year: body.year, memberId: body.memberId },
      userId: request.user.userId,
      lodgeId,
      ipAddress: request.ip,
    });

    return reply.status(201).send(officer);
  });

  // PUT /officers/:id — Update officer record
  fastify.put('/:id', {
    preHandler: [
      authenticate,
      lodgeScope,
      requireRole('WORSHIPFUL_MASTER', 'SECRETARY', 'DIRECTOR_OF_CEREMONIES', 'PROVINCE_ADMIN'),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const lodgeId = (request as any).lodgeId;
    const body = request.body as {
      isActive?: boolean;
      installedDate?: string;
      investedDate?: string;
    };

    const existing = await prisma.officer.findFirst({ where: { id, lodgeId } });
    if (!existing) {
      return reply.status(404).send({ error: 'Officer record not found' });
    }

    const officer = await prisma.officer.update({
      where: { id },
      data: {
        isActive: body.isActive,
        installedDate: body.installedDate ? new Date(body.installedDate) : undefined,
        investedDate: body.investedDate ? new Date(body.investedDate) : undefined,
      },
      include: {
        member: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    return reply.send(officer);
  });

  // DELETE /officers/:id — Remove officer
  fastify.delete('/:id', {
    preHandler: [
      authenticate,
      lodgeScope,
      requireRole('WORSHIPFUL_MASTER', 'SECRETARY', 'PROVINCE_ADMIN'),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const lodgeId = (request as any).lodgeId;

    const existing = await prisma.officer.findFirst({ where: { id, lodgeId } });
    if (!existing) {
      return reply.status(404).send({ error: 'Officer record not found' });
    }

    await prisma.officer.delete({ where: { id } });

    await createAuditLog(prisma, {
      action: 'DELETE',
      entity: 'Officer',
      entityId: id,
      details: { office: existing.office, year: existing.year },
      userId: request.user.userId,
      lodgeId,
      ipAddress: request.ip,
    });

    return reply.send({ message: 'Officer removed' });
  });
}
