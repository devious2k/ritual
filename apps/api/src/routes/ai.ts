import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { lodgeScope } from '../middleware/lodgeScope.js';
import { tenantContext } from '../middleware/tenant.js';
import { chat, streamChat } from '../services/aiService.js';
import { buildMemberContext, chatWithIncus } from '../services/incus.js';

export async function aiRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma;

  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', tenantContext);
  fastify.addHook('preHandler', lodgeScope);

  // POST /ai/incus — chat with Incus, the lodge mentor.
  // Body: { message: string, history?: [{role,content}, ...] }
  fastify.post('/incus', async (request, reply) => {
    const body = request.body as { message: string; history?: Array<{ role: 'user' | 'assistant'; content: string }> };
    if (!body.message?.trim()) return reply.status(400).send({ error: 'message required' });
    const lodgeId = request.lodgeId;
    if (!lodgeId) return reply.status(400).send({ error: 'No lodge context' });

    const ctx = await buildMemberContext(prisma, request.user.userId, lodgeId);
    if (!ctx) return reply.status(403).send({ error: 'Incus is only available to brethren attached to a lodge.' });

    try {
      const result = await chatWithIncus(prisma, ctx, body.history ?? [], body.message);
      return reply.send(result);
    } catch (err: any) {
      request.log.error({ err }, 'Incus chat failed');
      return reply.status(500).send({ error: err.message ?? 'Incus is resting at the anvil — try again shortly.' });
    }
  });

  // POST /ai/chat — Send message to Aida AI assistant
  fastify.post('/chat', async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const { message, context } = request.body as { message: string; context?: string };

    if (!message) {
      return reply.status(400).send({ error: 'message is required' });
    }

    // Build lodge context for system prompt
    const lodge = await prisma.lodge.findUnique({
      where: { id: lodgeId },
      include: {
        officers: {
          where: { isActive: true },
          include: { member: { select: { firstName: true, lastName: true } } },
        },
        meetings: {
          where: { date: { gte: new Date() } },
          orderBy: { date: 'asc' },
          take: 5,
        },
      },
    });

    if (!lodge) {
      return reply.status(404).send({ error: 'Lodge not found' });
    }

    const officerList = lodge.officers
      .map((o) => `${o.office}: ${o.member.firstName} ${o.member.lastName}`)
      .join('\n');

    const upcomingMeetings = lodge.meetings
      .map((m) => `${new Date(m.date).toLocaleDateString('en-GB')} - ${m.type}${m.ceremonyType ? ` (${m.ceremonyType})` : ''}`)
      .join('\n');

    // Get member stats
    const memberCount = await prisma.member.count({
      where: { lodgeId, status: 'ACTIVE' },
    });

    // Get outstanding dues
    const outstandingDues = await prisma.duesRecord.count({
      where: { lodgeId, status: { in: ['OVERDUE', 'ARREARS'] } },
    });

    const systemPrompt = `You are Aida, the AI secretary assistant for ${lodge.name} No. ${lodge.number}. You help lodge officers manage their lodge efficiently.

Lodge Information:
- Name: ${lodge.name} No. ${lodge.number}
- Meeting Day: ${lodge.meetingDay || 'Not set'}
- Meeting Months: ${lodge.meetingMonths || 'Not set'}
- Venue: ${lodge.venue || 'Not set'}
- Active Members: ${memberCount}
- Outstanding Dues: ${outstandingDues}

Current Officers:
${officerList || 'No officers currently set'}

Upcoming Meetings:
${upcomingMeetings || 'No upcoming meetings scheduled'}

${context ? `Additional Context:\n${context}` : ''}

You can suggest actions by including special tags in your response:
- [ACTION:generate_summons] — Generate summons for a meeting
- [ACTION:send_reminder] — Send dues/dining reminder
- [ACTION:flag_attendance] — Flag low-attendance member for Almoner
- [ACTION:create_ceremony_plan] — Create ceremony allocation draft

Be concise, helpful, and use proper Masonic terminology. Address the user formally.`;

    const lodgeSettings = lodge.settings as any;
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ];

    // Check if client wants SSE streaming
    const acceptHeader = request.headers.accept || '';
    if (acceptHeader.includes('text/event-stream')) {
      const stream = streamChat(messages, lodgeSettings);
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      const reader = stream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          reply.raw.write(new TextDecoder().decode(value));
        }
      } catch {
        // Client disconnected
      } finally {
        reply.raw.end();
      }
      return;
    }

    // Non-streaming response
    const response = await chat(messages, lodgeSettings);
    return reply.send({ response });
  });

  // GET /ai/actions/:action — Execute AI-suggested action
  fastify.get('/actions/:action', async (request: FastifyRequest, reply: FastifyReply) => {
    const { action } = request.params as { action: string };
    const lodgeId = (request as any).lodgeId;
    const query = request.query as Record<string, string>;

    switch (action) {
      case 'generate_summons': {
        const meetingId = query.meetingId;
        if (!meetingId) {
          return reply.status(400).send({ error: 'meetingId is required' });
        }

        const meeting = await prisma.meeting.findFirst({
          where: { id: meetingId, lodgeId },
        });

        if (!meeting) {
          return reply.status(404).send({ error: 'Meeting not found' });
        }

        // Create or get existing summons record
        const summons = await prisma.summons.upsert({
          where: { meetingId },
          create: {
            meetingId,
            lodgeId,
            generatedAt: new Date(),
          },
          update: {
            generatedAt: new Date(),
          },
        });

        return reply.send({
          action: 'generate_summons',
          status: 'initiated',
          summonsId: summons.id,
          message: 'Summons generation initiated. Review and send from the Summons page.',
        });
      }

      case 'send_reminder': {
        const memberId = query.memberId;

        const where: any = { lodgeId, status: { in: ['OVERDUE', 'ARREARS'] } };
        if (memberId) where.memberId = memberId;

        const overdueRecords = await prisma.duesRecord.findMany({
          where,
          include: {
            member: {
              include: { user: true },
            },
          },
        });

        let remindersSent = 0;
        for (const record of overdueRecords) {
          if (record.member.user) {
            await prisma.notification.create({
              data: {
                type: 'dues_reminder',
                title: 'Dues Reminder',
                body: `Your dues for ${record.year} are ${record.status.toLowerCase()}. Amount due: £${record.amount.toFixed(2)}.`,
                link: '/dues',
                userId: record.member.user.id,
                lodgeId,
              },
            });
            remindersSent++;
          }
        }

        return reply.send({
          action: 'send_reminder',
          status: 'completed',
          remindersSent,
          message: `${remindersSent} reminder(s) sent.`,
        });
      }

      case 'flag_attendance': {
        // Find members with low attendance in last 3 meetings
        const recentMeetings = await prisma.meeting.findMany({
          where: { lodgeId, type: 'REGULAR', date: { lt: new Date() } },
          orderBy: { date: 'desc' },
          take: 3,
          select: { id: true },
        });

        const meetingIds = recentMeetings.map((m) => m.id);

        const activeMembers = await prisma.member.findMany({
          where: { lodgeId, status: 'ACTIVE' },
          include: {
            attendance: {
              where: { meetingId: { in: meetingIds }, status: 'PRESENT' },
            },
          },
        });

        const lowAttendance = activeMembers
          .filter((m) => m.attendance.length === 0)
          .map((m) => ({ id: m.id, name: `${m.firstName} ${m.lastName}` }));

        // Create notifications for almoner
        const almonerAccess = await prisma.userLodgeAccess.findFirst({
          where: { lodgeId, role: 'ALMONER' },
        });

        if (almonerAccess && lowAttendance.length > 0) {
          await prisma.notification.create({
            data: {
              type: 'attendance_flag',
              title: 'Low Attendance Alert',
              body: `${lowAttendance.length} member(s) have not attended any of the last 3 meetings: ${lowAttendance.map((m) => m.name).join(', ')}`,
              link: '/almoner',
              userId: almonerAccess.userId,
              lodgeId,
            },
          });
        }

        return reply.send({
          action: 'flag_attendance',
          status: 'completed',
          flaggedMembers: lowAttendance,
          message: `${lowAttendance.length} member(s) flagged for low attendance.`,
        });
      }

      case 'create_ceremony_plan': {
        const meetingId = query.meetingId;
        if (!meetingId) {
          return reply.status(400).send({ error: 'meetingId is required' });
        }

        const meeting = await prisma.meeting.findFirst({
          where: { id: meetingId, lodgeId },
        });

        if (!meeting) {
          return reply.status(404).send({ error: 'Meeting not found' });
        }

        const ceremonyPlan = await prisma.ceremonyPlan.upsert({
          where: { meetingId },
          create: {
            meetingId,
            ceremonyType: meeting.ceremonyType || 'Unknown',
            allocations: {},
            isConfirmed: false,
          },
          update: {},
        });

        return reply.send({
          action: 'create_ceremony_plan',
          status: 'initiated',
          ceremonyPlanId: ceremonyPlan.id,
          message: 'Ceremony plan draft created. Assign roles from the Ceremonies page.',
        });
      }

      default:
        return reply.status(400).send({ error: `Unknown action: ${action}` });
    }
  });
}
