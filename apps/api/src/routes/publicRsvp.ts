import { FastifyInstance } from 'fastify';
import { sendoffSend } from '../services/sendoff.js';
import { buildSummonsPdf } from '../services/summonsPdf.js';

/**
 * Public, unauthenticated RSVP endpoints. Each summons email contains a link
 * with a stable token that resolves to a single member/meeting pair.
 */
export async function publicRsvpRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma;

  // GET /public/rsvp/:token/summons.pdf — printable summons PDF.
  // The token proves the bearer was emailed for that meeting; no auth needed.
  fastify.get('/:token/summons.pdf', async (request, reply) => {
    const { token } = request.params as { token: string };
    const rsvp = await prisma.diningRsvp.findUnique({
      where: { token },
      select: { meetingId: true },
    });
    if (!rsvp) return reply.status(404).send({ error: 'invalid_token' });
    const pdf = await buildSummonsPdf(prisma, rsvp.meetingId);
    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `inline; filename="summons-${rsvp.meetingId}.pdf"`)
      .send(pdf);
  });

  // GET /public/rsvp/:token — pre-fill the public RSVP page
  fastify.get('/:token', async (request, reply) => {
    const { token } = request.params as { token: string };
    const rsvp = await prisma.diningRsvp.findUnique({
      where: { token },
      include: {
        member: { select: { id: true, firstName: true, lastName: true } },
        meeting: {
          include: {
            lodge: { select: { id: true, name: true, number: true, diningCost: true, crestUrl: true, slug: true } },
          },
        },
      },
    });
    if (!rsvp) return reply.status(404).send({ error: 'invalid_token' });

    return {
      member: rsvp.member,
      meeting: {
        id: rsvp.meeting.id,
        date: rsvp.meeting.date,
        venue: rsvp.meeting.venue,
        diningCost: rsvp.meeting.diningCost ?? rsvp.meeting.lodge.diningCost,
        diningTime: rsvp.meeting.diningTime,
      },
      lodge: rsvp.meeting.lodge,
      rsvp: {
        status: rsvp.status,
        guestCount: rsvp.guestCount,
        guestNames: rsvp.guestNames,
        dietaryRequirements: rsvp.dietaryRequirements,
        notes: rsvp.notes,
        respondedAt: rsvp.respondedAt,
      },
    };
  });

  // POST /public/rsvp/:token — submit / update an RSVP
  fastify.post('/:token', async (request, reply) => {
    const { token } = request.params as { token: string };
    const body = request.body as {
      status: 'ATTENDING' | 'ATTENDING_WITH_GUESTS' | 'NOT_ATTENDING';
      guestCount?: number;
      guestNames?: string;
      dietaryRequirements?: string;
      notes?: string;
    };

    if (!['ATTENDING', 'ATTENDING_WITH_GUESTS', 'NOT_ATTENDING'].includes(body?.status)) {
      return reply.status(400).send({ error: 'invalid_status' });
    }

    const existing = await prisma.diningRsvp.findUnique({
      where: { token },
      include: {
        member: { select: { firstName: true, lastName: true, email: true } },
        meeting: {
          include: {
            lodge: { select: { id: true, name: true, number: true, slug: true, diningCost: true } },
          },
        },
      },
    });
    if (!existing) return reply.status(404).send({ error: 'invalid_token' });

    const guestCount = body.status === 'ATTENDING_WITH_GUESTS' ? Math.max(1, Math.min(10, body.guestCount ?? 1)) : 0;
    const updated = await prisma.diningRsvp.update({
      where: { token },
      data: {
        status: body.status,
        guestCount,
        guestNames: body.guestNames?.slice(0, 500) ?? null,
        dietaryRequirements: body.dietaryRequirements?.slice(0, 500) ?? null,
        notes: body.notes?.slice(0, 1000) ?? null,
        respondedAt: new Date(),
        remoteIp: (request.headers['cf-connecting-ip'] as string) || (request.ip as string) || null,
        userAgent: ((request.headers['user-agent'] as string) ?? '').slice(0, 200),
      },
    });

    // Notify the DC of the RSVP. Look up current DC via Officer table.
    const dcOfficer = await prisma.officer.findFirst({
      where: {
        lodgeId: existing.meeting.lodgeId,
        office: 'DIRECTOR_OF_CEREMONIES' as any,
        isActive: true,
      },
      orderBy: { year: 'desc' },
      include: { member: { include: { user: true } } },
    });
    const dcEmail = dcOfficer?.member?.user?.email ?? dcOfficer?.member?.email ?? null;

    if (dcEmail) {
      const member = `${existing.member.firstName} ${existing.member.lastName}`.trim();
      const lodge = existing.meeting.lodge;
      const dateStr = existing.meeting.date.toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      });
      const verb = body.status === 'NOT_ATTENDING'
        ? 'has declined the festive board'
        : body.status === 'ATTENDING_WITH_GUESTS'
          ? `has confirmed dining with ${guestCount} guest${guestCount === 1 ? '' : 's'}`
          : 'has confirmed dining';

      const html = renderDcNotifyHtml({
        memberName: member,
        verb,
        lodgeName: lodge.name,
        lodgeNumber: lodge.number,
        dateStr,
        guestNames: body.guestNames,
        dietary: body.dietaryRequirements,
        notes: body.notes,
        diningCost: lodge.diningCost,
        diners: body.status === 'ATTENDING_WITH_GUESTS' ? 1 + guestCount : (body.status === 'ATTENDING' ? 1 : 0),
      });
      const text = `${member} ${verb} for the ${lodge.name} No. ${lodge.number} meeting on ${dateStr}.${body.dietaryRequirements ? `\n\nDietary: ${body.dietaryRequirements}` : ''}${body.notes ? `\n\nNotes: ${body.notes}` : ''}`;

      try {
        await sendoffSend({
          to: dcEmail,
          from: process.env.LODGEKEY_FORWARD_FROM || 'lodge@freemasons.app',
          fromName: `${lodge.name} No. ${lodge.number}`,
          subject: `RSVP: ${member} — ${dateStr}`,
          html,
          text,
          tags: ['rsvp-notify', `lodge:${lodge.slug || lodge.id}`],
        });
      } catch (err) {
        // Don't fail the RSVP just because the DC notification didn't go.
        console.error('DC notify failed:', err);
      }
    }

    return { ok: true, status: updated.status, guestCount: updated.guestCount };
  });
}

function renderDcNotifyHtml(args: {
  memberName: string;
  verb: string;
  lodgeName: string;
  lodgeNumber: string;
  dateStr: string;
  guestNames?: string;
  dietary?: string;
  notes?: string;
  diningCost: number | null | undefined;
  diners: number;
}): string {
  const cost = args.diningCost != null
    ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(args.diningCost * args.diners)
    : null;
  return `<!doctype html>
<html><body style="font-family:Inter,Arial,sans-serif;background:#0B1A3A;color:#F0EDE4;margin:0;padding:24px;">
  <div style="max-width:540px;margin:0 auto;background:#12254A;border:1px solid rgba(201,162,74,0.18);border-radius:12px;padding:24px;">
    <p style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#7A8AA3;margin:0 0 8px 0;">${esc(args.lodgeName)} No. ${esc(args.lodgeNumber)} · RSVP</p>
    <h1 style="font-family:'Playfair Display',Georgia,serif;font-size:22px;color:#F0EDE4;margin:0 0 16px 0;">${esc(args.memberName)} ${esc(args.verb)}</h1>
    <p style="margin:0;color:#B7C2D6;line-height:1.5;">For the meeting on <strong>${esc(args.dateStr)}</strong>${cost ? ` · estimated dining bill ${esc(cost)}` : ''}.</p>
    ${args.guestNames ? `<p style="margin:16px 0 0 0;color:#B7C2D6;"><strong>Guests:</strong> ${esc(args.guestNames)}</p>` : ''}
    ${args.dietary ? `<p style="margin:16px 0 0 0;color:#B7C2D6;"><strong>Dietary:</strong> ${esc(args.dietary)}</p>` : ''}
    ${args.notes ? `<p style="margin:16px 0 0 0;color:#B7C2D6;"><strong>Notes:</strong> ${esc(args.notes)}</p>` : ''}
    <p style="margin:24px 0 0 0;color:#7A8AA3;font-size:12px;">Sent automatically by LodgeKey when a member RSVPs.</p>
  </div>
</body></html>`;
}

function esc(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
