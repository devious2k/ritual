import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { lodgeScope } from '../middleware/lodgeScope.js';
import { requireRole } from '../middleware/roleGuard.js';

export async function attendanceRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma;

  // GET /attendance/meeting/:meetingId — List attendance for a meeting
  fastify.get('/meeting/:meetingId', {
    preHandler: [authenticate, lodgeScope],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { meetingId } = request.params as { meetingId: string };
    const lodgeId = (request as any).lodgeId;

    // Verify meeting belongs to lodge
    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, lodgeId },
    });
    if (!meeting) {
      return reply.status(404).send({ error: 'Meeting not found' });
    }

    const attendance = await prisma.attendance.findMany({
      where: { meetingId },
      include: {
        member: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            degree: true,
            status: true,
          },
        },
      },
      orderBy: { member: { lastName: 'asc' } },
    });

    return reply.send({ data: attendance });
  });

  // POST /attendance — Record or update attendance (upsert)
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
      meetingId: string;
      status: string;
      diningChoice?: string;
      guestCount?: number;
      guestNames?: string;
      apologyReason?: string;
    };

    if (!body.memberId || !body.meetingId || !body.status) {
      return reply.status(400).send({ error: 'memberId, meetingId, and status are required' });
    }

    // Verify meeting belongs to lodge
    const meeting = await prisma.meeting.findFirst({
      where: { id: body.meetingId, lodgeId },
    });
    if (!meeting) {
      return reply.status(404).send({ error: 'Meeting not found' });
    }

    // Verify member belongs to lodge
    const member = await prisma.member.findFirst({
      where: { id: body.memberId, lodgeId },
    });
    if (!member) {
      return reply.status(404).send({ error: 'Member not found in this lodge' });
    }

    const attendance = await prisma.attendance.upsert({
      where: {
        memberId_meetingId: {
          memberId: body.memberId,
          meetingId: body.meetingId,
        },
      },
      create: {
        memberId: body.memberId,
        meetingId: body.meetingId,
        status: body.status as any,
        diningChoice: body.diningChoice,
        guestCount: body.guestCount ?? 0,
        guestNames: body.guestNames,
        apologyReason: body.apologyReason,
        respondedAt: new Date(),
      },
      update: {
        status: body.status as any,
        diningChoice: body.diningChoice,
        guestCount: body.guestCount ?? 0,
        guestNames: body.guestNames,
        apologyReason: body.apologyReason,
        respondedAt: new Date(),
      },
      include: {
        member: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    return reply.send(attendance);
  });

  // POST /attendance/self — member RSVP for their own attendance and dining
  fastify.post('/self', {
    preHandler: [authenticate, lodgeScope],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const body = request.body as {
      meetingId: string;
      status: string;
      diningChoice?: string;
      guestCount?: number;
      guestNames?: string;
      apologyReason?: string;
    };

    if (!body.meetingId || !body.status) {
      return reply.status(400).send({ error: 'meetingId and status are required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: request.user.userId },
      select: { memberId: true },
    });

    if (!user?.memberId) {
      return reply.status(403).send({ error: 'No member record is linked to this user' });
    }

    const meeting = await prisma.meeting.findFirst({
      where: { id: body.meetingId, lodgeId },
    });
    if (!meeting) {
      return reply.status(404).send({ error: 'Meeting not found' });
    }

    const member = await prisma.member.findFirst({
      where: { id: user.memberId, lodgeId },
      select: { id: true },
    });
    if (!member) {
      return reply.status(404).send({ error: 'Member not found in this lodge' });
    }

    const attendance = await prisma.attendance.upsert({
      where: {
        memberId_meetingId: {
          memberId: member.id,
          meetingId: body.meetingId,
        },
      },
      create: {
        memberId: member.id,
        meetingId: body.meetingId,
        status: body.status as any,
        diningChoice: body.diningChoice,
        guestCount: body.guestCount ?? 0,
        guestNames: body.guestNames,
        apologyReason: body.apologyReason,
        respondedAt: new Date(),
      },
      update: {
        status: body.status as any,
        diningChoice: body.diningChoice,
        guestCount: body.guestCount ?? 0,
        guestNames: body.guestNames,
        apologyReason: body.apologyReason,
        respondedAt: new Date(),
      },
      include: {
        member: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    return reply.send(attendance);
  });

  // POST /attendance/bulk — Bulk attendance update
  fastify.post('/bulk', {
    preHandler: [
      authenticate,
      lodgeScope,
      requireRole('SECRETARY', 'WORSHIPFUL_MASTER', 'DIRECTOR_OF_CEREMONIES', 'PROVINCE_ADMIN'),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const body = request.body as {
      meetingId: string;
      records: Array<{
        memberId: string;
        status: string;
        diningChoice?: string;
        guestCount?: number;
        guestNames?: string;
        apologyReason?: string;
      }>;
    };

    if (!body.meetingId || !body.records || !Array.isArray(body.records)) {
      return reply.status(400).send({ error: 'meetingId and records array are required' });
    }

    // Verify meeting belongs to lodge
    const meeting = await prisma.meeting.findFirst({
      where: { id: body.meetingId, lodgeId },
    });
    if (!meeting) {
      return reply.status(404).send({ error: 'Meeting not found' });
    }

    const results = await prisma.$transaction(
      body.records.map((record) =>
        prisma.attendance.upsert({
          where: {
            memberId_meetingId: {
              memberId: record.memberId,
              meetingId: body.meetingId,
            },
          },
          create: {
            memberId: record.memberId,
            meetingId: body.meetingId,
            status: record.status as any,
            diningChoice: record.diningChoice,
            guestCount: record.guestCount ?? 0,
            guestNames: record.guestNames,
            apologyReason: record.apologyReason,
            respondedAt: new Date(),
          },
          update: {
            status: record.status as any,
            diningChoice: record.diningChoice,
            guestCount: record.guestCount ?? 0,
            guestNames: record.guestNames,
            apologyReason: record.apologyReason,
            respondedAt: new Date(),
          },
        })
      )
    );

    return reply.send({ data: results, count: results.length });
  });

  // GET /attendance/member/:memberId — Attendance history for a member
  fastify.get('/member/:memberId', {
    preHandler: [authenticate, lodgeScope],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { memberId } = request.params as { memberId: string };
    const lodgeId = (request as any).lodgeId;
    const { page = '1', limit = '25' } = request.query as Record<string, string>;

    // Verify member belongs to lodge
    const member = await prisma.member.findFirst({
      where: { id: memberId, lodgeId },
    });
    if (!member) {
      return reply.status(404).send({ error: 'Member not found in this lodge' });
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [attendance, total] = await Promise.all([
      prisma.attendance.findMany({
        where: { memberId },
        skip,
        take: limitNum,
        orderBy: { meeting: { date: 'desc' } },
        include: {
          meeting: {
            select: {
              id: true,
              type: true,
              date: true,
              startTime: true,
              venue: true,
            },
          },
        },
      }),
      prisma.attendance.count({ where: { memberId } }),
    ]);

    // Summary stats
    const stats = await prisma.attendance.groupBy({
      by: ['status'],
      where: { memberId },
      _count: true,
    });

    return reply.send({
      data: attendance,
      stats: stats.reduce(
        (acc, item) => ({ ...acc, [item.status]: item._count }),
        {} as Record<string, number>,
      ),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  });
}
