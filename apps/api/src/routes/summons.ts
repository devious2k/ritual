import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { lodgeScope } from '../middleware/lodgeScope.js';
import { requireRole } from '../middleware/roleGuard.js';

export async function summonsRoutes(fastify: FastifyInstance) {
  const preHandler = [authenticate, lodgeScope];

  // GET / — list summonses for lodge
  fastify.get('/', { preHandler }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;

    const summonses = await fastify.prisma.summons.findMany({
      where: { lodgeId },
      include: {
        meeting: { select: { id: true, date: true, type: true, venue: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reply.send(summonses);
  });

  // GET /:id — single summons
  fastify.get('/:id', { preHandler }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const lodgeId = (request as any).lodgeId;

    const summons = await fastify.prisma.summons.findFirst({
      where: { id, lodgeId },
      include: {
        meeting: {
          include: {
            attendance: {
              include: { member: { select: { id: true, firstName: true, lastName: true } } },
            },
          },
        },
      },
    });

    if (!summons) {
      return reply.status(404).send({ error: 'Summons not found' });
    }

    return reply.send(summons);
  });

  // POST /generate — generate summons for a meeting
  fastify.post('/generate', {
    preHandler: [...preHandler, requireRole('SECRETARY', 'WORSHIPFUL_MASTER')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const { meetingId, rsvpDeadline } = request.body as {
      meetingId: string;
      rsvpDeadline?: string;
    };

    // Verify meeting belongs to this lodge
    const meeting = await fastify.prisma.meeting.findFirst({
      where: { id: meetingId, lodgeId },
      include: {
        lodge: { select: { name: true, number: true, venue: true, venueAddress: true, meetingDay: true } },
      },
    });
    if (!meeting) {
      return reply.status(404).send({ error: 'Meeting not found in this lodge' });
    }

    // Get current officers for the summons header
    const currentYear = new Date().getFullYear();
    const officers = await fastify.prisma.officer.findMany({
      where: { lodgeId, year: currentYear, isActive: true },
      include: { member: { select: { firstName: true, lastName: true } } },
    });

    // Build summons content from meeting data
    const content = {
      lodge: {
        name: meeting.lodge.name,
        number: meeting.lodge.number,
        venue: meeting.venue || meeting.lodge.venue,
        venueAddress: meeting.lodge.venueAddress,
      },
      meeting: {
        type: meeting.type,
        date: meeting.date.toISOString(),
        startTime: meeting.startTime,
        diningTime: meeting.diningTime,
        ceremonyType: meeting.ceremonyType,
        candidateName: meeting.candidateName,
      },
      agenda: meeting.agendaItems,
      officers: officers.map((o) => ({
        office: o.office,
        name: `${o.member.firstName} ${o.member.lastName}`,
      })),
    };

    // Count active members for recipient count
    const memberCount = await fastify.prisma.member.count({
      where: { lodgeId, status: 'ACTIVE' },
    });

    const summons = await fastify.prisma.summons.upsert({
      where: { meetingId },
      create: {
        meetingId,
        lodgeId,
        content,
        generatedAt: new Date(),
        recipientCount: memberCount,
        rsvpDeadline: rsvpDeadline ? new Date(rsvpDeadline) : null,
      },
      update: {
        content,
        generatedAt: new Date(),
        recipientCount: memberCount,
        rsvpDeadline: rsvpDeadline ? new Date(rsvpDeadline) : null,
      },
      include: {
        meeting: { select: { id: true, date: true, type: true } },
      },
    });

    return reply.status(201).send(summons);
  });

  // POST /:id/send — send summons to all members via email
  fastify.post('/:id/send', {
    preHandler: [...preHandler, requireRole('SECRETARY', 'WORSHIPFUL_MASTER')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const lodgeId = (request as any).lodgeId;

    const summons = await fastify.prisma.summons.findFirst({
      where: { id, lodgeId },
      include: { meeting: true },
    });
    if (!summons) {
      return reply.status(404).send({ error: 'Summons not found' });
    }

    if (!summons.content) {
      return reply.status(400).send({ error: 'Summons has no content. Generate it first.' });
    }

    // Get all active members with email addresses
    const members = await fastify.prisma.member.findMany({
      where: { lodgeId, status: 'ACTIVE', email: { not: null } },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    // Mark summons as sent
    const updated = await fastify.prisma.summons.update({
      where: { id },
      data: {
        sentAt: new Date(),
        recipientCount: members.length,
      },
    });

    // TODO: integrate with emailService to actually send emails to each member
    // For now, return the sent status and recipient count

    return reply.send({
      ...updated,
      recipientEmails: members.length,
      message: `Summons marked as sent to ${members.length} members`,
    });
  });

  // GET /:id/rsvp — get RSVP status for a summons
  fastify.get('/:id/rsvp', { preHandler }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const lodgeId = (request as any).lodgeId;

    const summons = await fastify.prisma.summons.findFirst({
      where: { id, lodgeId },
      select: { meetingId: true, rsvpDeadline: true },
    });
    if (!summons) {
      return reply.status(404).send({ error: 'Summons not found' });
    }

    // Get attendance responses for this meeting
    const attendance = await fastify.prisma.attendance.findMany({
      where: { meetingId: summons.meetingId },
      include: {
        member: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Count members who haven't responded
    const totalActive = await fastify.prisma.member.count({
      where: { lodgeId, status: 'ACTIVE' },
    });

    const responded = attendance.length;
    const attending = attendance.filter((a) => a.status === 'PRESENT').length;
    const apologies = attendance.filter((a) => a.status === 'APOLOGY').length;
    const notResponded = totalActive - responded;

    return reply.send({
      rsvpDeadline: summons.rsvpDeadline,
      totalMembers: totalActive,
      responded,
      notResponded,
      attending,
      apologies,
      responses: attendance,
    });
  });
}
