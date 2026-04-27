import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { tenantContext, requireLodge } from '../middleware/tenant.js';
import { sendoffSend } from '../services/sendoff.js';

/**
 * Lodge events (festive boards, ladies' nights, charity quizzes, open
 * lodge nights) — distinct from regular Meeting business. Admin CRUD plus
 * a Sendoff "advertise" blast to members + opted-in subscribers.
 */
export async function eventRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma;

  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', tenantContext);
  fastify.addHook('preHandler', requireLodge);

  fastify.get('/', async (request) => {
    const lodgeId = request.lodgeId!;
    return prisma.lodgeEvent.findMany({
      where: { lodgeId },
      orderBy: { date: 'asc' },
      include: { _count: { select: { bookings: true } } },
    });
  });

  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const event = await prisma.lodgeEvent.findFirst({
      where: { id, lodgeId: request.lodgeId! },
      include: { bookings: { orderBy: { createdAt: 'desc' } } },
    });
    if (!event) return reply.status(404).send({ error: 'Not found' });
    return event;
  });

  fastify.post('/', async (request, reply) => {
    const body = request.body as {
      title: string; description?: string; date: string;
      startTime?: string; endTime?: string; venue?: string; venueAddress?: string;
      ticketPrice?: number; capacity?: number; allowsGuests?: boolean;
      isPublished?: boolean; imageUrl?: string;
    };
    if (!body.title || !body.date) return reply.status(400).send({ error: 'title and date required' });
    const event = await prisma.lodgeEvent.create({
      data: {
        lodgeId: request.lodgeId!,
        title: body.title,
        description: body.description,
        date: new Date(body.date),
        startTime: body.startTime,
        endTime: body.endTime,
        venue: body.venue,
        venueAddress: body.venueAddress,
        ticketPrice: body.ticketPrice,
        capacity: body.capacity,
        allowsGuests: body.allowsGuests ?? true,
        isPublished: body.isPublished ?? false,
        imageUrl: body.imageUrl,
      },
    });
    return reply.status(201).send(event);
  });

  fastify.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, any>;
    const existing = await prisma.lodgeEvent.findFirst({ where: { id, lodgeId: request.lodgeId! } });
    if (!existing) return reply.status(404).send({ error: 'Not found' });
    const data: Record<string, any> = {};
    for (const f of ['title', 'description', 'startTime', 'endTime', 'venue', 'venueAddress', 'ticketPrice', 'capacity', 'allowsGuests', 'isPublished', 'imageUrl']) {
      if (body[f] !== undefined) data[f] = body[f];
    }
    if (body.date) data.date = new Date(body.date);
    return prisma.lodgeEvent.update({ where: { id }, data });
  });

  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.lodgeEvent.findFirst({ where: { id, lodgeId: request.lodgeId! } });
    if (!existing) return reply.status(404).send({ error: 'Not found' });
    await prisma.lodgeEvent.delete({ where: { id } });
    return { ok: true };
  });

  // POST /events/:id/advertise — send a Sendoff blast to all active members
  // (via Member.email or User.email) plus all opted-in subscribers.
  fastify.post('/:id/advertise', async (request, reply) => {
    const { id } = request.params as { id: string };
    const lodgeId = request.lodgeId!;
    const event = await prisma.lodgeEvent.findFirst({ where: { id, lodgeId } });
    if (!event) return reply.status(404).send({ error: 'Not found' });
    if (!event.isPublished) return reply.status(400).send({ error: 'Publish the event before advertising' });

    const lodge = await prisma.lodge.findUnique({ where: { id: lodgeId } });
    if (!lodge) return reply.status(404).send({ error: 'Lodge not found' });

    // Recipient list: members + subscribers, deduped on email.
    const members = await prisma.member.findMany({
      where: { lodgeId, status: { in: ['ACTIVE', 'HONORARY', 'COUNTRY_MEMBER'] } as any },
      include: { user: { select: { email: true } } },
    });
    const subscribers = await prisma.subscriber.findMany({
      where: { lodgeId, unsubscribedAt: null },
    });

    const recipients = new Map<string, { email: string; firstName?: string | null; lastName?: string | null; isMember: boolean; unsubscribeToken?: string }>();
    for (const m of members) {
      const email = (m.user?.email ?? m.email)?.toLowerCase();
      if (!email) continue;
      recipients.set(email, { email, firstName: m.firstName, lastName: m.lastName, isMember: true });
    }
    for (const s of subscribers) {
      const email = s.email.toLowerCase();
      if (recipients.has(email)) continue;
      recipients.set(email, { email, firstName: s.firstName, lastName: s.lastName, isMember: false, unsubscribeToken: s.unsubscribeToken });
    }

    const apiBase = process.env.API_BASE_URL || 'https://api.freemasons.app';
    const fromAddress = process.env.LODGEKEY_FORWARD_FROM || 'lodge@freemasons.app';
    const slug = lodge.slug ?? lodge.id;
    const dateStr = event.date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const bookingUrl = `https://${slug === 'vulcan4510' ? 'vulcan4510.com' : `${slug}.freemasons.app`}/events/${event.id}`;

    let sent = 0;
    const errors: Array<{ email: string; error: string }> = [];
    for (const r of recipients.values()) {
      const unsub = r.unsubscribeToken ? `${apiBase}/public/subscribers/${r.unsubscribeToken}/unsubscribe` : null;
      try {
        await sendoffSend({
          to: r.email,
          from: fromAddress,
          fromName: `${lodge.name} No. ${lodge.number}`,
          subject: `${event.title} — ${dateStr}`,
          html: renderEventAdvertHtml(lodge, event, r, bookingUrl, unsub, apiBase),
          tags: ['event-advert', `lodge:${slug}`, `event:${event.id}`],
        });
        sent += 1;
      } catch (e: any) {
        errors.push({ email: r.email, error: e.message ?? 'Send failed' });
      }
    }

    await prisma.lodgeEvent.update({ where: { id }, data: { sentAdvertAt: new Date() } });
    return { sent, total: recipients.size, errors };
  });

  fastify.get('/subscribers/list', async (request) => {
    return prisma.subscriber.findMany({
      where: { lodgeId: request.lodgeId! },
      orderBy: { subscribedAt: 'desc' },
    });
  });
}

function renderEventAdvertHtml(
  lodge: { id: string; name: string; number: string },
  event: { id: string; title: string; description: string | null; date: Date; startTime: string | null; venue: string | null; venueAddress: string | null; ticketPrice: number | null; imageUrl: string | null },
  r: { firstName?: string | null; lastName?: string | null; isMember: boolean },
  bookingUrl: string,
  unsubUrl: string | null,
  apiBase: string,
): string {
  const dateStr = event.date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const greeting = r.firstName ? `Dear ${r.isMember ? 'Bro. ' : ''}${escapeHtml(r.firstName)},` : 'Dear friend of the lodge,';
  const price = event.ticketPrice != null ? `£${event.ticketPrice.toFixed(2)} per head` : 'Free';
  const heroImg = event.imageUrl ? `<img src="${event.imageUrl}" alt="" width="100%" style="display:block;margin:0 0 14px;border:0;border-radius:6px;" />` : '';
  const unsub = unsubUrl ? `<p style="margin:18px 0 0;color:#5C6678;font-size:11px;text-align:center;">If you'd rather not hear about future events, <a href="${unsubUrl}" style="color:#7B6A2A;">unsubscribe here</a>.</p>` : '';

  return `<!doctype html>
<html><body style="font-family:Georgia,'Times New Roman',serif;background:#F4F1EA;color:#0F2547;margin:0;padding:24px;">
  <div style="max-width:600px;margin:0 auto;background:#FFFFFF;border:1px solid #C9A24A;padding:32px 36px;">
    <div style="text-align:center;border-bottom:2px solid #0F2547;padding-bottom:14px;margin-bottom:18px;">
      <img src="${apiBase}/public/_lodges/${lodge.id}/crest" alt="${escapeHtml(lodge.name)} crest" width="64" height="64" style="display:block;margin:0 auto 6px;border:0;" />
      <p style="margin:0;font-size:11px;color:#0F2547;letter-spacing:0.18em;font-weight:700;">${escapeHtml(lodge.name.toUpperCase())} NO. ${escapeHtml(lodge.number)}</p>
    </div>
    ${heroImg}
    <h1 style="margin:0 0 6px;font-family:'Playfair Display',Georgia,serif;font-size:30px;color:#0F2547;font-style:italic;">${escapeHtml(event.title)}</h1>
    <p style="margin:0 0 14px;color:#5C6678;font-size:13px;">${escapeHtml(dateStr)}${event.startTime ? ` · ${escapeHtml(event.startTime)}` : ''}${event.venue ? ` · ${escapeHtml(event.venue)}` : ''}</p>
    <p style="margin:0 0 14px;color:#0F2547;">${greeting}</p>
    ${event.description ? `<div style="margin:0 0 18px;color:#0F2547;line-height:1.55;">${event.description.split('\n').map((p) => `<p style="margin:0 0 10px;">${escapeHtml(p)}</p>`).join('')}</div>` : ''}
    <p style="margin:0 0 6px;color:#0F2547;"><strong>Tickets:</strong> ${price}</p>
    ${event.venueAddress ? `<p style="margin:0 0 18px;color:#0F2547;"><strong>Address:</strong> ${escapeHtml(event.venueAddress)}</p>` : ''}
    <div style="text-align:center;margin:22px 0;">
      <a href="${bookingUrl}" style="display:inline-block;background:#0F2547;color:#FFFFFF;font-family:Inter,Arial,sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;font-size:13px;padding:14px 28px;border:1px solid #C9A24A;text-decoration:none;">Book your place</a>
    </div>
    ${unsub}
  </div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
