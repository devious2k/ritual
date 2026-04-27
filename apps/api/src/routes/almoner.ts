import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { lodgeScope } from '../middleware/lodgeScope.js';
import { requireRole } from '../middleware/roleGuard.js';
import { encrypt, decrypt } from '../services/encryptionService.js';

export async function almonerRoutes(fastify: FastifyInstance) {
  const preHandler = [authenticate, lodgeScope];
  const almonerRoles = requireRole('ALMONER', 'WORSHIPFUL_MASTER', 'SECRETARY');

  // GET /cases — list cases (ALMONER, WM, SECRETARY only) — decrypt notes
  fastify.get('/cases', {
    preHandler: [...preHandler, almonerRoles],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const { status } = request.query as { status?: string };

    const where: any = { member: { lodgeId } };
    if (status) where.status = status;

    const cases = await fastify.prisma.almonerCase.findMany({
      where,
      include: {
        member: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Decrypt notes for each case
    const decryptedCases = cases.map((c) => ({
      ...c,
      notes: (() => {
        try {
          return decrypt(c.encryptedNotes);
        } catch {
          return '[Unable to decrypt notes]';
        }
      })(),
      encryptedNotes: undefined,
    }));

    return reply.send(decryptedCases);
  });

  // GET /cases/:id — single case
  fastify.get('/cases/:id', {
    preHandler: [...preHandler, almonerRoles],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const lodgeId = (request as any).lodgeId;

    const almonerCase = await fastify.prisma.almonerCase.findFirst({
      where: { id, member: { lodgeId } },
      include: {
        member: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, address: true } },
      },
    });

    if (!almonerCase) {
      return reply.status(404).send({ error: 'Case not found' });
    }

    let notes: string;
    try {
      notes = decrypt(almonerCase.encryptedNotes);
    } catch {
      notes = '[Unable to decrypt notes]';
    }

    return reply.send({
      ...almonerCase,
      notes,
      encryptedNotes: undefined,
    });
  });

  // POST /cases — create case — encrypt notes
  fastify.post('/cases', {
    preHandler: [...preHandler, almonerRoles],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const { memberId, notes, category, isConfidential, nextActionDate, nextAction } = request.body as {
      memberId: string;
      notes: string;
      category?: string;
      isConfidential?: boolean;
      nextActionDate?: string;
      nextAction?: string;
    };

    // Verify member belongs to this lodge
    const member = await fastify.prisma.member.findFirst({
      where: { id: memberId, lodgeId },
    });
    if (!member) {
      return reply.status(404).send({ error: 'Member not found in this lodge' });
    }

    const encryptedNotes = encrypt(notes);

    const almonerCase = await fastify.prisma.almonerCase.create({
      data: {
        memberId,
        encryptedNotes,
        category,
        isConfidential: isConfidential ?? true,
        nextActionDate: nextActionDate ? new Date(nextActionDate) : null,
        nextAction,
      },
      include: {
        member: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return reply.status(201).send({
      ...almonerCase,
      notes,
      encryptedNotes: undefined,
    });
  });

  // PUT /cases/:id — update case
  fastify.put('/cases/:id', {
    preHandler: [...preHandler, almonerRoles],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const lodgeId = (request as any).lodgeId;
    const body = request.body as Record<string, any>;

    const existing = await fastify.prisma.almonerCase.findFirst({
      where: { id, member: { lodgeId } },
    });
    if (!existing) {
      return reply.status(404).send({ error: 'Case not found' });
    }

    const data: any = {};
    if (body.notes !== undefined) data.encryptedNotes = encrypt(body.notes);
    if (body.status !== undefined) data.status = body.status;
    if (body.category !== undefined) data.category = body.category;
    if (body.isConfidential !== undefined) data.isConfidential = body.isConfidential;
    if (body.nextActionDate !== undefined) data.nextActionDate = body.nextActionDate ? new Date(body.nextActionDate) : null;
    if (body.nextAction !== undefined) data.nextAction = body.nextAction;
    if (body.lastContactDate !== undefined) data.lastContactDate = body.lastContactDate ? new Date(body.lastContactDate) : null;
    if (body.status === 'CLOSED') data.closedDate = new Date();

    const updated = await fastify.prisma.almonerCase.update({
      where: { id },
      data,
      include: {
        member: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    let notes: string;
    try {
      notes = decrypt(updated.encryptedNotes);
    } catch {
      notes = '[Unable to decrypt notes]';
    }

    return reply.send({
      ...updated,
      notes,
      encryptedNotes: undefined,
    });
  });

  // GET /flags — attendance flags (members with low attendance)
  fastify.get('/flags', {
    preHandler: [...preHandler, almonerRoles],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const { meetings = '3' } = request.query as { meetings?: string };
    const meetingThreshold = parseInt(meetings, 10);

    // Get the last N meetings for this lodge
    const recentMeetings = await fastify.prisma.meeting.findMany({
      where: { lodgeId, type: 'REGULAR' },
      orderBy: { date: 'desc' },
      take: meetingThreshold,
      select: { id: true, date: true },
    });

    if (recentMeetings.length === 0) {
      return reply.send({ flags: [], message: 'No recent meetings found' });
    }

    const meetingIds = recentMeetings.map((m) => m.id);

    // Get all active members
    const activeMembers = await fastify.prisma.member.findMany({
      where: { lodgeId, status: 'ACTIVE' },
      select: { id: true, firstName: true, lastName: true },
    });

    // Get attendance records for these meetings
    const attendanceRecords = await fastify.prisma.attendance.findMany({
      where: {
        meetingId: { in: meetingIds },
        status: 'PRESENT',
      },
      select: { memberId: true, meetingId: true },
    });

    // Count attendance per member
    const attendanceCounts = new Map<string, number>();
    for (const record of attendanceRecords) {
      attendanceCounts.set(record.memberId, (attendanceCounts.get(record.memberId) ?? 0) + 1);
    }

    // Flag members with zero attendance in the recent meetings
    const flaggedMembers = activeMembers
      .map((m) => ({
        ...m,
        attendedCount: attendanceCounts.get(m.id) ?? 0,
        totalMeetings: recentMeetings.length,
      }))
      .filter((m) => m.attendedCount === 0)
      .sort((a, b) => a.lastName.localeCompare(b.lastName));

    return reply.send({
      flags: flaggedMembers,
      period: {
        meetings: recentMeetings.length,
        from: recentMeetings[recentMeetings.length - 1]?.date,
        to: recentMeetings[0]?.date,
      },
    });
  });
}
