import { FastifyInstance } from 'fastify';
import { resolveOfficeFromLocalPart, OFFICE_LABELS } from '@lodgekey/shared';
import { sendoffSend } from '../services/sendoff.js';

interface InboundPayload {
  domain: string;          // recipient domain — used to find the LodgeMailDomain
  recipient: string;       // full recipient email (raw, as sent)
  resolvedLocal?: string;  // worker may rewrite the local-part (apex addressing)
  resolvedSlug?: string;   // when present, look up the lodge by slug
  from: string;
  fromName?: string;
  subject?: string;
  text?: string;
  html?: string;
  messageId?: string;
  spfPass?: boolean;
  dkimPass?: boolean;
}

const HTML_EXCERPT_BYTES = 10 * 1024;

/**
 * Public ingestion endpoint for the Cloudflare Email Worker. Authenticated
 * via shared secret in the Authorization header (Bearer + INBOUND_MAIL_SECRET).
 * Returns either { forward: <addr> } so the worker can call message.forward(),
 * or { archived: true } when the mail was logged but should not be forwarded.
 */
export async function inboundMailRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma;

  fastify.post('/', async (request, reply) => {
    const auth = request.headers.authorization;
    const expected = process.env.INBOUND_MAIL_SECRET;
    if (!expected || auth !== `Bearer ${expected}`) {
      return reply.status(401).send({ error: 'unauthorized' });
    }

    const payload = request.body as InboundPayload;
    if (!payload?.domain || !payload?.recipient || !payload?.from) {
      return reply.status(400).send({ error: 'domain, recipient, and from are required' });
    }

    const recipientLocal = (payload.resolvedLocal || payload.recipient.split('@')[0] || '').toLowerCase();
    const domain = payload.domain.toLowerCase();

    // Resolve the lodge: by slug (apex extended-local-part path) or by registered
    // mail domain (custom domain / explicit subdomain configurations).
    let mailDomain = null as Awaited<ReturnType<typeof prisma.lodgeMailDomain.findUnique>> | null;
    let lodge: any = null;
    if (payload.resolvedSlug) {
      lodge = await prisma.lodge.findFirst({
        where: { slug: payload.resolvedSlug, isActive: true },
      });
      if (lodge) {
        // Ensure a LodgeMailDomain row exists for tagging the InboundMessage,
        // even though resolution didn't go via that table this time.
        mailDomain = await prisma.lodgeMailDomain.findUnique({
          where: { domain: `${payload.resolvedSlug}.freemasons.app` },
        });
      }
    } else {
      mailDomain = await prisma.lodgeMailDomain.findUnique({
        where: { domain },
        include: { lodge: true },
      });
      if (mailDomain) {
        lodge = (mailDomain as any).lodge;
        // strip the include so later writes don't carry it
        const { lodge: _l, ...rest } = mailDomain as any;
        mailDomain = rest;
      }
    }
    if (!lodge) {
      return reply.status(404).send({ error: 'unknown_lodge' });
    }

    const officeKey = resolveOfficeFromLocalPart(recipientLocal);

    // Find the current officer for the resolved office. We pick the most recent
    // active record by `year DESC` so installations roll over without code
    // changes.
    let deliveredToUserId: string | null = null;
    let forwardEmail: string | null = null;
    if (officeKey) {
      const officer = await prisma.officer.findFirst({
        where: { lodgeId: lodge.id, office: officeKey as any, isActive: true },
        orderBy: { year: 'desc' },
        include: {
          member: {
            include: {
              user: { select: { id: true, email: true } },
            },
          },
        },
      });
      if (officer?.member?.user?.email) {
        deliveredToUserId = officer.member.user.id;
        forwardEmail = officer.member.user.email;
      } else if (officer?.member?.email) {
        // Officer exists but has no user account — forward to their member email.
        forwardEmail = officer.member.email;
      }
    }

    const bodyHtmlExcerpt =
      payload.html && payload.html.length > HTML_EXCERPT_BYTES
        ? payload.html.slice(0, HTML_EXCERPT_BYTES)
        : payload.html ?? null;

    const message = await prisma.inboundMessage.create({
      data: {
        lodgeId: lodge.id,
        domainId: mailDomain?.id ?? null,
        fromEmail: payload.from,
        fromName: payload.fromName ?? null,
        toEmail: payload.recipient,
        recipientLocal,
        mappedOffice: officeKey ? (officeKey as any) : null,
        deliveredToUserId,
        subject: payload.subject || '(no subject)',
        bodyText: payload.text || null,
        bodyHtmlExcerpt,
        messageId: payload.messageId || null,
        spfPass: payload.spfPass ?? false,
        dkimPass: payload.dkimPass ?? false,
        status: 'RECEIVED',
      },
    });

    if (!forwardEmail) {
      // Logged but unroutable — show in lodge inbox for an admin to triage.
      await prisma.inboundMessage.update({
        where: { id: message.id },
        data: { status: 'ARCHIVED' },
      });
      return reply.send({ archived: true, messageId: message.id, reason: officeKey ? 'no_holder' : 'no_office_match' });
    }

    // Compose a forwarding wrapper. The Email Worker also calls
    // message.forward(forwardEmail) to ensure delivery semantics; this Sendoff
    // call doubles as a notification with the LodgeKey banner so officers
    // know it came via the platform.
    const officeLabel = officeKey ? OFFICE_LABELS[officeKey as keyof typeof OFFICE_LABELS] : 'Lodge';
    const senderDisplay = payload.fromName ? `${payload.fromName} <${payload.from}>` : payload.from;
    try {
      await sendoffSend({
        to: forwardEmail,
        from: process.env.LODGEKEY_FORWARD_FROM,
        fromName: 'LodgeKey',
        subject: `[${lodge.name} · ${officeLabel}] ${message.subject}`,
        text:
`Forwarded by LodgeKey — addressed to ${payload.recipient} (${officeLabel} of ${lodge.name})

From: ${senderDisplay}
Subject: ${message.subject}

${payload.text || '(empty body)'}

—
This message was sent to the lodge ${officeLabel.toLowerCase()} address. As long as you currently hold that office in LodgeKey, mail addressed to that role will be routed to you.`,
        html: payload.html,
        tags: ['inbound', `lodge:${lodge.slug || lodge.id}`, `office:${officeKey || 'unknown'}`],
      });
      await prisma.inboundMessage.update({
        where: { id: message.id },
        data: { status: 'FORWARDED' },
      });
    } catch (err: any) {
      await prisma.inboundMessage.update({
        where: { id: message.id },
        data: { status: 'ERROR', forwardError: err?.message || 'forward failed' },
      });
      // Still tell the worker the destination so it can also forward natively
      // — Sendoff failure shouldn't block delivery.
    }

    return reply.send({
      forward: forwardEmail,
      messageId: message.id,
      office: officeKey,
    });
  });
}
