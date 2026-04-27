import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { lodgeScope } from '../middleware/lodgeScope.js';
import { requireRole } from '../middleware/roleGuard.js';
import { createAuditLog } from '../services/auditService.js';

export async function memberRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma;

  // GET /members — List members (paginated, searchable, filterable)
  fastify.get('/', {
    preHandler: [authenticate, lodgeScope],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const {
      page = '1',
      limit = '25',
      search,
      status,
      degree,
    } = request.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const where: any = { lodgeId };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (degree) {
      where.degree = degree;
    }

    const [members, total] = await Promise.all([
      prisma.member.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          degree: true,
          status: true,
          photoUrl: true,
          dateJoined: true,
          officers: {
            where: { isActive: true },
            select: { office: true, year: true },
          },
        },
      }),
      prisma.member.count({ where }),
    ]);

    return reply.send({
      data: members,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  });

  // GET /members/:id — Single member with details
  fastify.get('/:id', {
    preHandler: [authenticate, lodgeScope],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const lodgeId = (request as any).lodgeId;

    const member = await prisma.member.findFirst({
      where: { id, lodgeId },
      include: {
        officers: {
          orderBy: { year: 'desc' },
        },
        attendance: {
          take: 20,
          orderBy: { meeting: { date: 'desc' } },
          include: {
            meeting: {
              select: { id: true, type: true, date: true },
            },
          },
        },
        degreeProgressions: {
          orderBy: { ceremonyDate: 'desc' },
        },
        honours: {
          orderBy: { dateConferred: 'desc' },
        },
        duesRecords: {
          orderBy: { year: 'desc' },
          take: 5,
        },
      },
    });

    if (!member) {
      return reply.status(404).send({ error: 'Member not found' });
    }

    // Compute attendance stats
    const attendanceStats = await prisma.attendance.groupBy({
      by: ['status'],
      where: { memberId: id },
      _count: true,
    });

    return reply.send({
      ...member,
      attendanceStats: attendanceStats.reduce(
        (acc, item) => ({ ...acc, [item.status]: item._count }),
        {} as Record<string, number>,
      ),
    });
  });

  // POST /members — Create member
  fastify.post('/', {
    preHandler: [
      authenticate,
      lodgeScope,
      requireRole('SECRETARY', 'WORSHIPFUL_MASTER', 'PROVINCE_ADMIN'),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const body = request.body as {
      firstName: string;
      lastName: string;
      email?: string;
      phone?: string;
      address?: string;
      dateOfBirth?: string;
      occupation?: string;
      degree?: string;
      status?: string;
      dateInitiated?: string;
      datePassed?: string;
      dateRaised?: string;
      dateJoined?: string;
      previousLodge?: string;
      previousLodgeNumber?: string;
      proposerId?: string;
      seconderId?: string;
    };

    if (!body.firstName || !body.lastName) {
      return reply.status(400).send({ error: 'firstName and lastName are required' });
    }

    const member = await prisma.member.create({
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone,
        address: body.address,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
        occupation: body.occupation,
        degree: (body.degree as any) || 'ENTERED_APPRENTICE',
        status: (body.status as any) || 'ACTIVE',
        dateInitiated: body.dateInitiated ? new Date(body.dateInitiated) : undefined,
        datePassed: body.datePassed ? new Date(body.datePassed) : undefined,
        dateRaised: body.dateRaised ? new Date(body.dateRaised) : undefined,
        dateJoined: body.dateJoined ? new Date(body.dateJoined) : undefined,
        previousLodge: body.previousLodge,
        previousLodgeNumber: body.previousLodgeNumber,
        proposerId: body.proposerId,
        seconderId: body.seconderId,
        lodgeId,
      },
    });

    await createAuditLog(prisma, {
      action: 'CREATE',
      entity: 'Member',
      entityId: member.id,
      details: { firstName: body.firstName, lastName: body.lastName },
      userId: request.user.userId,
      lodgeId,
      ipAddress: request.ip,
    });

    return reply.status(201).send(member);
  });

  // PUT /members/:id — Update member
  fastify.put('/:id', {
    preHandler: [
      authenticate,
      lodgeScope,
      requireRole('SECRETARY', 'WORSHIPFUL_MASTER', 'PROVINCE_ADMIN'),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const lodgeId = (request as any).lodgeId;
    const body = request.body as Record<string, any>;

    // Verify member belongs to lodge
    const existing = await prisma.member.findFirst({ where: { id, lodgeId } });
    if (!existing) {
      return reply.status(404).send({ error: 'Member not found' });
    }

    // Build update data, converting date strings
    const dateFields = ['dateOfBirth', 'dateInitiated', 'datePassed', 'dateRaised', 'dateJoined', 'dateResigned', 'dateExcluded'];
    const updateData: Record<string, any> = {};

    for (const [key, value] of Object.entries(body)) {
      if (key === 'id' || key === 'lodgeId' || key === 'createdAt') continue;
      if (dateFields.includes(key) && value) {
        updateData[key] = new Date(value as string);
      } else {
        updateData[key] = value;
      }
    }

    const member = await prisma.member.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog(prisma, {
      action: 'UPDATE',
      entity: 'Member',
      entityId: id,
      details: updateData,
      userId: request.user.userId,
      lodgeId,
      ipAddress: request.ip,
    });

    return reply.send(member);
  });

  // DELETE /members/:id — Soft delete (set status to RESIGNED)
  fastify.delete('/:id', {
    preHandler: [
      authenticate,
      lodgeScope,
      requireRole('SECRETARY', 'WORSHIPFUL_MASTER', 'PROVINCE_ADMIN'),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const lodgeId = (request as any).lodgeId;

    const existing = await prisma.member.findFirst({ where: { id, lodgeId } });
    if (!existing) {
      return reply.status(404).send({ error: 'Member not found' });
    }

    const member = await prisma.member.update({
      where: { id },
      data: {
        status: 'RESIGNED',
        dateResigned: new Date(),
      },
    });

    await createAuditLog(prisma, {
      action: 'DELETE',
      entity: 'Member',
      entityId: id,
      details: { softDelete: true, previousStatus: existing.status },
      userId: request.user.userId,
      lodgeId,
      ipAddress: request.ip,
    });

    return reply.send({ message: 'Member marked as resigned', member });
  });
}
