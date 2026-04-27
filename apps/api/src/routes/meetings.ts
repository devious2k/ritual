import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { lodgeScope } from '../middleware/lodgeScope.js';
import { requireRole } from '../middleware/roleGuard.js';
import { createAuditLog } from '../services/auditService.js';

const REGULAR_AGENDA = [
  { title: 'To Open the Lodge' },
  { title: 'To Confirm the Minutes of the Previous Meeting' },
  { title: 'Ceremony / Degree work', description: 'Set when a ceremony is planned for this meeting' },
  { title: 'To Receive the Almoners Report' },
  { title: 'To Receive a Charity Report' },
  { title: 'To Receive a Masonic Hall (Mbro) Ltd Report' },
  { title: 'To Receive a Daily Advancement in Masonic Knowledge' },
  { title: 'To Receive Propositions' },
  { title: 'To Receive Communications' },
  { title: 'To Close the Lodge' },
];

const INSTALLATION_AGENDA = [
  { title: 'To Open the Lodge' },
  { title: 'To Confirm the Minutes of the Previous Meeting' },
  { title: 'To Install the Worshipful Master Elect', description: 'Installation ceremony' },
  { title: 'To Invest the Officers of the Lodge' },
  { title: 'To Receive the Almoners Report' },
  { title: 'To Receive a Charity Report' },
  { title: 'To Receive a Masonic Hall (Mbro) Ltd Report' },
  { title: 'To Receive Propositions' },
  { title: 'To Receive Communications' },
  { title: 'To Close the Lodge' },
];

function defaultAgendaForType(type: string) {
  return type === 'INSTALLATION' ? INSTALLATION_AGENDA : REGULAR_AGENDA;
}

export async function meetingRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma;

  // GET /meetings — List meetings (paginated, filterable)
  fastify.get('/', {
    preHandler: [authenticate, lodgeScope],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const {
      page = '1',
      limit = '25',
      type,
      from,
      to,
    } = request.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const where: any = { lodgeId };

    if (type) {
      where.type = type;
    }

    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }

    const [meetings, total] = await Promise.all([
      prisma.meeting.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { date: 'desc' },
        select: {
          id: true,
          type: true,
          date: true,
          startTime: true,
          venue: true,
          diningTime: true,
          diningCost: true,
          ceremonyType: true,
          candidateName: true,
          minutesApproved: true,
          _count: {
            select: {
              attendance: true,
              visitors: true,
            },
          },
        },
      }),
      prisma.meeting.count({ where }),
    ]);

    return reply.send({
      data: meetings,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  });

  // GET /meetings/:id — Single meeting with related data
  fastify.get('/:id', {
    preHandler: [authenticate, lodgeScope],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const lodgeId = (request as any).lodgeId;

    const meeting = await prisma.meeting.findFirst({
      where: { id, lodgeId },
      include: {
        attendance: {
          include: {
            member: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                degree: true,
              },
            },
          },
          orderBy: { member: { lastName: 'asc' } },
        },
        visitors: {
          orderBy: { lastName: 'asc' },
        },
        ceremonyPlan: {
          include: {
            roles: {
              include: {
                member: {
                  select: { id: true, firstName: true, lastName: true },
                },
              },
            },
          },
        },
        summons: true,
        diningFees: true,
      },
    });

    if (!meeting) {
      return reply.status(404).send({ error: 'Meeting not found' });
    }

    return reply.send(meeting);
  });

  // POST /meetings — Create meeting
  fastify.post('/', {
    preHandler: [
      authenticate,
      lodgeScope,
      requireRole('SECRETARY', 'WORSHIPFUL_MASTER', 'PROVINCE_ADMIN'),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const body = request.body as {
      type: string;
      date: string;
      startTime?: string;
      venue?: string;
      diningTime?: string;
      diningCost?: number;
      diningMenu?: any;
      agendaItems?: any;
      ceremonyType?: string;
      candidateName?: string;
    };

    if (!body.type || !body.date) {
      return reply.status(400).send({ error: 'type and date are required' });
    }

    const meeting = await prisma.meeting.create({
      data: {
        type: body.type as any,
        date: new Date(body.date),
        startTime: body.startTime,
        venue: body.venue,
        diningTime: body.diningTime,
        diningCost: body.diningCost,
        diningMenu: body.diningMenu ?? undefined,
        agendaItems: body.agendaItems ?? defaultAgendaForType(body.type),
        ceremonyType: body.ceremonyType,
        candidateName: body.candidateName,
        lodgeId,
      },
    });

    await createAuditLog(prisma, {
      action: 'CREATE',
      entity: 'Meeting',
      entityId: meeting.id,
      details: { type: body.type, date: body.date },
      userId: request.user.userId,
      lodgeId,
      ipAddress: request.ip,
    });

    return reply.status(201).send(meeting);
  });

  // PUT /meetings/:id — Update meeting
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

    const existing = await prisma.meeting.findFirst({ where: { id, lodgeId } });
    if (!existing) {
      return reply.status(404).send({ error: 'Meeting not found' });
    }

    const updateData: Record<string, any> = {};
    const allowedFields = [
      'type', 'date', 'startTime', 'venue', 'diningTime', 'diningCost',
      'diningMenu', 'agendaItems', 'minutesContent', 'minutesApproved',
      'minutesApprovedDate', 'minutesDocFlowId', 'ceremonyType', 'candidateName',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'date' || field === 'minutesApprovedDate') {
          updateData[field] = new Date(body[field]);
        } else {
          updateData[field] = body[field];
        }
      }
    }

    // If approving minutes, set the approval date
    if (body.minutesApproved === true && !existing.minutesApproved) {
      updateData.minutesApprovedDate = new Date();
    }

    const meeting = await prisma.meeting.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog(prisma, {
      action: 'UPDATE',
      entity: 'Meeting',
      entityId: id,
      details: updateData,
      userId: request.user.userId,
      lodgeId,
      ipAddress: request.ip,
    });

    return reply.send(meeting);
  });

  // DELETE /meetings/:id — Delete meeting
  fastify.delete('/:id', {
    preHandler: [
      authenticate,
      lodgeScope,
      requireRole('SECRETARY', 'WORSHIPFUL_MASTER', 'PROVINCE_ADMIN'),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const lodgeId = (request as any).lodgeId;

    const existing = await prisma.meeting.findFirst({ where: { id, lodgeId } });
    if (!existing) {
      return reply.status(404).send({ error: 'Meeting not found' });
    }

    await prisma.meeting.delete({ where: { id } });

    await createAuditLog(prisma, {
      action: 'DELETE',
      entity: 'Meeting',
      entityId: id,
      details: { type: existing.type, date: existing.date },
      userId: request.user.userId,
      lodgeId,
      ipAddress: request.ip,
    });

    return reply.send({ message: 'Meeting deleted' });
  });
}
