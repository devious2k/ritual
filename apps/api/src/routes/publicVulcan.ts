import { FastifyInstance } from 'fastify';
import { sendoffSend } from '../services/sendoff.js';

/**
 * Public, unauthenticated endpoints used by vulcan4510.com (and any other
 * lodge static site) to:
 *   - render an upcoming-meetings + events calendar
 *   - accept visitor bookings against a lodge meeting
 *   - accept event RSVPs
 *   - capture mailing-list opt-ins
 *
 * No JWT — every endpoint is keyed on lodge slug. Lookups are fast and the
 * blast radius of accidental misuse is bounded (anyone could already see
 * a public lodge's meeting calendar).
 */
export async function publicVulcanRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma;
  const apiBase = process.env.API_BASE_URL || 'https://api.freemasons.app';
  const fromAddress = process.env.LODGEKEY_FORWARD_FROM || 'lodge@freemasons.app';

  // GET /public/lodges/:slug/calendar — combined meetings + events feed.
  fastify.get('/lodges/:slug/calendar', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const lodge = await prisma.lodge.findFirst({
      where: { slug, isActive: true },
      select: { id: true, name: true, number: true, slug: true, crestUrl: true, venue: true, venueAddress: true },
    });
    if (!lodge) return reply.status(404).send({ error: 'Lodge not found' });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const horizon = new Date(today);
    horizon.setMonth(horizon.getMonth() + 12);

    const [meetings, events] = await Promise.all([
      prisma.meeting.findMany({
        where: { lodgeId: lodge.id, date: { gte: today, lte: horizon } },
        orderBy: { date: 'asc' },
        select: {
          id: true, type: true, date: true, startTime: true, venue: true,
          diningTime: true, diningCost: true, ceremonyType: true,
        },
      }),
      prisma.lodgeEvent.findMany({
        where: { lodgeId: lodge.id, isPublished: true, date: { gte: today, lte: horizon } },
        orderBy: { date: 'asc' },
      }),
    ]);

    return {
      lodge: {
        id: lodge.id, name: lodge.name, number: lodge.number, slug: lodge.slug,
        crestUrl: `${apiBase}/public/_lodges/${lodge.id}/crest`,
        venue: lodge.venue, venueAddress: lodge.venueAddress,
      },
      meetings: meetings.map((m) => ({
        kind: 'MEETING' as const,
        id: m.id,
        title: meetingTitle(m.type, m.ceremonyType),
        date: m.date,
        startTime: m.startTime,
        venue: m.venue ?? lodge.venue,
        diningTime: m.diningTime,
        diningCost: m.diningCost,
        ceremonyType: m.ceremonyType,
      })),
      events: events.map((e) => ({
        kind: 'EVENT' as const,
        id: e.id,
        title: e.title,
        description: e.description,
        date: e.date,
        startTime: e.startTime,
        endTime: e.endTime,
        venue: e.venue ?? lodge.venue,
        venueAddress: e.venueAddress ?? lodge.venueAddress,
        ticketPrice: e.ticketPrice,
        capacity: e.capacity,
        allowsGuests: e.allowsGuests,
        imageUrl: e.imageUrl,
      })),
    };
  });

  // POST /public/lodges/:slug/visitor-bookings
  // Body: {
  //   meetingId, firstName, lastName, rank, lodgeName, lodgeNumber,
  //   email, phone?, dining bool, guestCount?, guestNames? (newline-delimited),
  //   dietary?, notes?, subscribeToEvents bool
  // }
  fastify.post('/lodges/:slug/visitor-bookings', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const body = request.body as {
      meetingId: string;
      firstName: string;
      lastName: string;
      rank?: string;
      lodgeName: string;
      lodgeNumber?: string;
      email: string;
      phone?: string;
      dining?: boolean;
      diningChoice?: string;
      guestCount?: number;
      guestNames?: string;
      dietary?: string;
      notes?: string;
      subscribeToEvents?: boolean;
    };
    if (!body.firstName || !body.lastName || !body.lodgeName || !body.email || !body.meetingId) {
      return reply.status(400).send({ error: 'firstName, lastName, lodgeName, email, meetingId are required' });
    }

    const lodge = await prisma.lodge.findFirst({ where: { slug, isActive: true } });
    if (!lodge) return reply.status(404).send({ error: 'Lodge not found' });
    const meeting = await prisma.meeting.findFirst({ where: { id: body.meetingId, lodgeId: lodge.id } });
    if (!meeting) return reply.status(404).send({ error: 'Meeting not found at this lodge' });

    const numGuests = Math.max(0, Math.min(20, body.guestCount ?? 0));

    const visitor = await prisma.visitor.create({
      data: {
        meetingId: meeting.id,
        firstName: body.firstName.trim(),
        lastName: body.lastName.trim(),
        rank: body.rank?.trim() || null,
        lodgeName: body.lodgeName.trim(),
        lodgeNumber: body.lodgeNumber?.trim() || null,
        email: body.email.trim().toLowerCase(),
        phone: body.phone?.trim() || null,
        dining: !!body.dining,
        diningChoice: body.diningChoice?.trim() || null,
        dietary: body.dietary?.trim() || null,
        notes: body.notes?.trim() || null,
        numGuests,
        bookingSource: 'PUBLIC_SITE',
      },
    });

    // Optional: create one Visitor row per guest, linked back via guestOf
    const guestNames = (body.guestNames ?? '')
      .split('\n').map((s) => s.trim()).filter(Boolean).slice(0, numGuests);
    if (numGuests > 0) {
      await prisma.visitor.createMany({
        data: Array.from({ length: numGuests }).map((_, i) => {
          const [first, ...rest] = (guestNames[i] ?? '').split(' ').filter(Boolean);
          return {
            meetingId: meeting.id,
            firstName: first || 'Guest',
            lastName: rest.join(' ') || `${i + 1}`,
            rank: null,
            lodgeName: 'Guest of visitor',
            dining: !!body.dining,
            guestOf: visitor.id,
            bookingSource: 'PUBLIC_SITE',
          };
        }),
      });
    }

    // Subscribe if opted in.
    if (body.subscribeToEvents) {
      await prisma.subscriber.upsert({
        where: { lodgeId_email: { lodgeId: lodge.id, email: visitor.email! } },
        update: { unsubscribedAt: null, source: 'VISITOR_BOOKING' },
        create: {
          lodgeId: lodge.id,
          email: visitor.email!,
          firstName: visitor.firstName,
          lastName: visitor.lastName,
          source: 'VISITOR_BOOKING',
        },
      });
    }

    // Notify the DC.
    const dcOfficer = await prisma.officer.findFirst({
      where: { lodgeId: lodge.id, isActive: true, office: { in: ['DIRECTOR_OF_CEREMONIES', 'ASSISTANT_DC'] as any } },
      include: { member: { select: { email: true, user: { select: { email: true } } } } },
    });
    const dcEmail = dcOfficer?.member.user?.email ?? dcOfficer?.member.email;

    if (dcEmail) {
      const dateStr = meeting.date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      await sendoffSend({
        to: dcEmail,
        from: fromAddress,
        fromName: `${lodge.name} No. ${lodge.number}`,
        subject: `New visitor booking — ${visitor.firstName} ${visitor.lastName} for ${dateStr}`,
        html: `<p>A new visitor booking has been received via <strong>${escapeHtml(slug)}.com</strong>:</p>
          <ul>
            <li><strong>${escapeHtml(visitor.firstName)} ${escapeHtml(visitor.lastName)}</strong>${visitor.rank ? ' ' + escapeHtml(visitor.rank) : ''}</li>
            <li>${escapeHtml(visitor.lodgeName)}${visitor.lodgeNumber ? ' No. ' + escapeHtml(visitor.lodgeNumber) : ''}</li>
            <li>Email: ${escapeHtml(visitor.email ?? '')} · Phone: ${escapeHtml(visitor.phone ?? '—')}</li>
            <li>Dining: ${visitor.dining ? 'yes' : 'no'}${numGuests > 0 ? ` · ${numGuests} guest${numGuests === 1 ? '' : 's'}` : ''}</li>
            ${visitor.dietary ? `<li>Dietary: ${escapeHtml(visitor.dietary)}</li>` : ''}
            ${visitor.notes ? `<li>Notes: ${escapeHtml(visitor.notes)}</li>` : ''}
          </ul>
          <p>For: <strong>${escapeHtml(dateStr)}</strong> at ${escapeHtml(meeting.venue ?? lodge.venue ?? '')}.</p>
          <p>Open the meeting in LodgeKey: <a href="https://app.freemasons.app/meetings/${meeting.id}">View meeting</a></p>`,
        tags: ['visitor-booking', `lodge:${slug}`, `meeting:${meeting.id}`],
      });
    }

    // Confirm to the visitor.
    await sendoffSend({
      to: visitor.email!,
      from: fromAddress,
      fromName: `${lodge.name} No. ${lodge.number}`,
      subject: `Booking confirmed — ${lodge.name} No. ${lodge.number}`,
      html: visitorConfirmationHtml(lodge, meeting, visitor, numGuests),
      tags: ['visitor-confirmation', `lodge:${slug}`],
    });

    return reply.status(201).send({
      ok: true,
      bookingId: visitor.id,
      message: `Thank you Bro. ${visitor.firstName} — your booking has been logged. The Director of Ceremonies has been notified.`,
    });
  });

  // POST /public/lodges/:slug/events/:eventId/bookings
  fastify.post('/lodges/:slug/events/:eventId/bookings', async (request, reply) => {
    const { slug, eventId } = request.params as { slug: string; eventId: string };
    const body = request.body as {
      firstName: string; lastName: string; email: string; phone?: string;
      numGuests?: number; guestNames?: string; dietary?: string; notes?: string;
      subscribeToEvents?: boolean;
    };
    if (!body.firstName || !body.lastName || !body.email) {
      return reply.status(400).send({ error: 'firstName, lastName, email required' });
    }
    const lodge = await prisma.lodge.findFirst({ where: { slug, isActive: true } });
    if (!lodge) return reply.status(404).send({ error: 'Lodge not found' });
    const event = await prisma.lodgeEvent.findFirst({ where: { id: eventId, lodgeId: lodge.id, isPublished: true } });
    if (!event) return reply.status(404).send({ error: 'Event not found or not published' });

    const numGuests = Math.max(0, Math.min(20, body.numGuests ?? 0));
    const booking = await prisma.eventBooking.create({
      data: {
        eventId,
        firstName: body.firstName.trim(),
        lastName: body.lastName.trim(),
        email: body.email.trim().toLowerCase(),
        phone: body.phone?.trim() || null,
        numGuests,
        guestNames: body.guestNames?.trim() || null,
        dietary: body.dietary?.trim() || null,
        notes: body.notes?.trim() || null,
        subscribeToList: !!body.subscribeToEvents,
      },
    });

    if (body.subscribeToEvents) {
      await prisma.subscriber.upsert({
        where: { lodgeId_email: { lodgeId: lodge.id, email: booking.email } },
        update: { unsubscribedAt: null, source: 'EVENT_RSVP' },
        create: {
          lodgeId: lodge.id, email: booking.email,
          firstName: booking.firstName, lastName: booking.lastName,
          source: 'EVENT_RSVP',
        },
      });
    }

    return reply.status(201).send({ ok: true, bookingId: booking.id });
  });

  // GET /public/subscribers/:token/unsubscribe — one-click unsub for blast emails.
  fastify.get('/subscribers/:token/unsubscribe', async (request, reply) => {
    const { token } = request.params as { token: string };
    const sub = await prisma.subscriber.findUnique({ where: { unsubscribeToken: token } });
    if (!sub) return reply.status(404).send({ error: 'Unknown token' });
    await prisma.subscriber.update({ where: { id: sub.id }, data: { unsubscribedAt: new Date() } });
    return reply.type('text/html').send(
      `<!doctype html><meta charset="utf-8"><title>Unsubscribed</title>
       <body style="font-family:Inter,Arial,sans-serif;background:#0B1A3A;color:#F0EDE4;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
         <div style="max-width:480px;text-align:center;padding:32px;">
           <h1 style="font-family:'Playfair Display',Georgia,serif;color:#C9A24A;">You've been unsubscribed</h1>
           <p>${escapeHtml(sub.email)} will no longer receive event announcements from this lodge.</p>
         </div>
       </body>`,
    );
  });
}

function meetingTitle(type: string, ceremonyType?: string | null): string {
  const base = type.split('_').map((w) => w[0] + w.slice(1).toLowerCase()).join(' ');
  return ceremonyType ? `${base} — ${ceremonyType}` : base;
}

function visitorConfirmationHtml(lodge: any, meeting: any, visitor: any, numGuests: number): string {
  const dateStr = meeting.date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const apiBase = process.env.API_BASE_URL || 'https://api.freemasons.app';
  return `<!doctype html>
<html><body style="font-family:Georgia,'Times New Roman',serif;background:#F4F1EA;color:#0F2547;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #C9A24A;padding:32px 36px;">
    <div style="text-align:center;margin-bottom:18px;">
      <img src="${apiBase}/public/_lodges/${lodge.id}/crest" alt="${escapeHtml(lodge.name)} crest" width="80" height="80" style="display:block;margin:0 auto 8px;border:0;" />
      <h1 style="margin:0;font-family:'Playfair Display',Georgia,serif;font-size:30px;color:#0F2547;font-style:italic;">${escapeHtml(lodge.name)}</h1>
      <p style="margin:4px 0 0;font-family:'Playfair Display',Georgia,serif;font-size:18px;color:#0F2547;font-style:italic;">No. ${escapeHtml(lodge.number)}</p>
    </div>
    <p style="margin:0 0 14px;color:#0F2547;">Dear Bro. ${escapeHtml(visitor.firstName)} ${escapeHtml(visitor.lastName)},</p>
    <p style="margin:0 0 14px;color:#0F2547;line-height:1.55;">
      Thank you for booking to visit ${escapeHtml(lodge.name)}. Your booking has been logged and the Director of Ceremonies has been notified. Please find your meeting details below.
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:14px 0;">
      <tr><td style="padding:6px 12px;background:rgba(15,37,71,0.04);border:1px solid #C9A24A;color:#0F2547;font-weight:700;width:40%;">Date</td><td style="padding:6px 12px;border:1px solid #C9A24A;color:#0F2547;">${escapeHtml(dateStr)}</td></tr>
      ${meeting.startTime ? `<tr><td style="padding:6px 12px;background:rgba(15,37,71,0.04);border:1px solid #C9A24A;color:#0F2547;font-weight:700;">Start</td><td style="padding:6px 12px;border:1px solid #C9A24A;color:#0F2547;">${escapeHtml(meeting.startTime)}</td></tr>` : ''}
      <tr><td style="padding:6px 12px;background:rgba(15,37,71,0.04);border:1px solid #C9A24A;color:#0F2547;font-weight:700;">Venue</td><td style="padding:6px 12px;border:1px solid #C9A24A;color:#0F2547;">${escapeHtml(meeting.venue ?? lodge.venue ?? '')}</td></tr>
      <tr><td style="padding:6px 12px;background:rgba(15,37,71,0.04);border:1px solid #C9A24A;color:#0F2547;font-weight:700;">Dress</td><td style="padding:6px 12px;border:1px solid #C9A24A;color:#0F2547;">Dinner Suit and White Gloves</td></tr>
      <tr><td style="padding:6px 12px;background:rgba(15,37,71,0.04);border:1px solid #C9A24A;color:#0F2547;font-weight:700;">Dining</td><td style="padding:6px 12px;border:1px solid #C9A24A;color:#0F2547;">${visitor.dining ? 'Yes' : 'No'}${numGuests > 0 ? ` · ${numGuests} guest${numGuests === 1 ? '' : 's'}` : ''}</td></tr>
    </table>
    <p style="margin:0;color:#0F2547;font-size:13px;">If anything changes, just reply to this email.</p>
    <p style="margin:14px 0 0;color:#0F2547;font-size:13px;font-style:italic;">Yours faithfully and fraternally,</p>
    <p style="margin:0;color:#0F2547;font-size:13px;font-style:italic;">${escapeHtml(lodge.name)} No. ${escapeHtml(lodge.number)}</p>
  </div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
