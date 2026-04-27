import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant.js';
import { buildSummonsModel, renderSummonsEmailHtml, renderSummonsEmailText } from '../services/summons.js';
import { buildSummonsPdf } from '../services/summonsPdf.js';
import { sendoffSend } from '../services/sendoff.js';

export async function ritualSummonsRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma;

  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', tenantContext);

  // GET /ritual/summons/pdf/:meetingId — printable two-page summons PDF
  // mirroring the traditional Vulcan format. Lodge crest is embedded from
  // Lodge.crestUrl. Streams as application/pdf.
  fastify.get('/pdf/:meetingId', async (request, reply) => {
    const { meetingId } = request.params as { meetingId: string };
    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) return reply.status(404).send({ error: 'Meeting not found' });
    if (!request.isSuperAdmin && request.lodgeId !== meeting.lodgeId) {
      return reply.status(403).send({ error: 'No access to this lodge' });
    }
    const pdf = await buildSummonsPdf(prisma, meetingId);
    const dateLabel = meeting.date.toISOString().slice(0, 10);
    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `inline; filename="summons-${dateLabel}.pdf"`)
      .send(pdf);
  });

  // GET /ritual/summons/preview/:meetingId — render the email body that
  // would be sent to a given member. Used to QA the summons.
  fastify.get('/preview/:meetingId', async (request, reply) => {
    const { meetingId } = request.params as { meetingId: string };
    const memberId = (request.query as any)?.memberId as string | undefined;
    const model = await buildSummonsModel(prisma, { meetingId });
    const recipient = memberId
      ? model.members.find((m) => m.memberId === memberId)
      : model.members[0];
    if (!recipient) return reply.status(404).send({ error: 'No member found to preview as' });

    const baseUrl = (request.headers.origin as string) || 'https://app.freemasons.app';
    const apiBase = process.env.API_BASE_URL || 'https://api.freemasons.app';
    const html = renderSummonsEmailHtml(
      model, recipient,
      `${baseUrl}/rsvp/preview-token`,
      `${apiBase}/public/rsvp/preview-token/summons.pdf`,
    );
    return { html, recipient };
  });

  // POST /ritual/summons/send/:meetingId — generate per-member summons emails
  // with unique RSVP tokens and dispatch via Sendoff. Idempotent: re-sending
  // re-uses existing DiningRsvp tokens so RSVP links remain stable.
  //
  // Body { recipientIds?: string[], testTag?: boolean } — if recipientIds is
  // provided, only those members are emailed (used by the "Test summons" UI
  // button). testTag prefixes the subject with [TEST] for clarity.
  fastify.post('/send/:meetingId', async (request, reply) => {
    const { meetingId } = request.params as { meetingId: string };
    const body = (request.body ?? {}) as { recipientIds?: string[]; testTag?: boolean };
    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) return reply.status(404).send({ error: 'Meeting not found' });
    if (!request.isSuperAdmin && request.lodgeId !== meeting.lodgeId) {
      return reply.status(403).send({ error: 'No access to this lodge' });
    }

    const model = await buildSummonsModel(prisma, { meetingId });
    const lodgeRecord = await prisma.lodge.findUnique({ where: { id: meeting.lodgeId } });
    const slug = lodgeRecord?.slug || lodgeRecord?.id;

    const rsvpBaseUrl = process.env.RSVP_BASE_URL || 'https://app.freemasons.app';
    const apiBaseUrl = process.env.API_BASE_URL || 'https://api.freemasons.app';
    const fromAddress = process.env.LODGEKEY_FORWARD_FROM || 'lodge@freemasons.app';
    const recipientFilter = Array.isArray(body.recipientIds) && body.recipientIds.length > 0
      ? new Set(body.recipientIds)
      : null;
    const subjectPrefix = body.testTag ? '[TEST] ' : '';

    // Sendoff (and SES) silently drop attachments, so we expose the PDF as a
    // public, token-protected URL instead — added inside the email body.

    let sentCount = 0;
    let skipped = 0;
    const errors: Array<{ memberId: string; error: string }> = [];

    for (const m of model.members) {
      if (recipientFilter && !recipientFilter.has(m.memberId)) continue;
      if (!m.email) {
        skipped += 1;
        continue;
      }

      const rsvp = await prisma.diningRsvp.upsert({
        where: { memberId_meetingId: { memberId: m.memberId, meetingId } },
        update: {},
        create: { memberId: m.memberId, meetingId, status: 'PENDING' },
      });

      const rsvpUrl = `${rsvpBaseUrl}/rsvp/${rsvp.token}`;
      const pdfUrl = `${apiBaseUrl}/public/rsvp/${rsvp.token}/summons.pdf`;
      const html = renderSummonsEmailHtml(model, m, rsvpUrl, pdfUrl);
      const text = renderSummonsEmailText(model, m, rsvpUrl, pdfUrl);

      try {
        await sendoffSend({
          to: m.email,
          from: fromAddress,
          fromName: `${model.lodgeName} No. ${model.lodgeNumber}`,
          subject: `${subjectPrefix}Summons — ${model.lodgeName} No. ${model.lodgeNumber} — ${model.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`,
          html,
          text,
          tags: ['summons', `lodge:${slug}`, `meeting:${meetingId}`],
        });
        sentCount += 1;
      } catch (err: any) {
        errors.push({ memberId: m.memberId, error: err.message ?? 'Send failed' });
      }
    }

    await prisma.summons.upsert({
      where: { meetingId },
      update: {
        sentAt: new Date(),
        recipientCount: sentCount,
        content: { agendaItems: model.agendaItems, errors } as any,
      },
      create: {
        meetingId,
        lodgeId: meeting.lodgeId,
        sentAt: new Date(),
        recipientCount: sentCount,
        content: { agendaItems: model.agendaItems, errors } as any,
      },
    });

    return { sent: sentCount, skipped, errors };
  });

  // GET /ritual/summons/rsvps/:meetingId — admin view
  fastify.get('/rsvps/:meetingId', async (request, reply) => {
    const { meetingId } = request.params as { meetingId: string };
    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) return reply.status(404).send({ error: 'Meeting not found' });
    if (!request.isSuperAdmin && request.lodgeId !== meeting.lodgeId) {
      return reply.status(403).send({ error: 'No access to this lodge' });
    }

    const rsvps = await prisma.diningRsvp.findMany({
      where: { meetingId },
      include: { member: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: [{ status: 'asc' }, { respondedAt: 'desc' }],
    });
    const summary = rsvps.reduce(
      (acc, r) => {
        acc[r.status] = (acc[r.status] ?? 0) + 1;
        if (r.status === 'ATTENDING_WITH_GUESTS') acc.guests += r.guestCount;
        return acc;
      },
      { PENDING: 0, ATTENDING: 0, ATTENDING_WITH_GUESTS: 0, NOT_ATTENDING: 0, guests: 0 } as Record<string, number>,
    );
    summary.totalDining = (summary.ATTENDING ?? 0) + (summary.ATTENDING_WITH_GUESTS ?? 0) + (summary.guests ?? 0);
    return { rsvps, summary };
  });
}
