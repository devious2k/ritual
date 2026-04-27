/// <reference types="@cloudflare/workers-types" />
import PostalMime from 'postal-mime';

interface Env {
  API_URL: string;
  INBOUND_MAIL_SECRET: string;
}

const HTML_LIMIT = 10 * 1024;
const TEXT_LIMIT = 64 * 1024;

export default {
  async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext) {
    console.log(`[router] email event: from=${message.from} to=${message.to}`);
    const recipient = message.to.toLowerCase();
    const [localPart, rawDomain = ''] = recipient.split('@');
    const fromAddr = (message.from || '').toLowerCase();

    // Apex addressing pattern: `<role>.<lodge-slug>@freemasons.app`.
    // If we see that on freemasons.app we rewrite the recipient so the API
    // looks up the lodge by slug rather than by domain.
    let domain = rawDomain;
    let resolvedLocal = localPart;
    let resolvedSlug: string | null = null;
    if (rawDomain === 'freemasons.app' && localPart.includes('.')) {
      const idx = localPart.lastIndexOf('.');
      const role = localPart.slice(0, idx);
      const slug = localPart.slice(idx + 1);
      if (role && slug) {
        resolvedLocal = role;
        resolvedSlug = slug;
        domain = `${slug}.freemasons.app`; // synthetic — API maps to LodgeMailDomain by this
      }
    }

    let parsedSubject = '';
    let parsedText = '';
    let parsedHtml = '';
    let messageId: string | undefined;
    let fromName: string | undefined;

    try {
      const raw = await readStream(message.raw);
      const parsed = await new PostalMime().parse(raw);
      parsedSubject = parsed.subject || '';
      parsedText = (parsed.text || '').slice(0, TEXT_LIMIT);
      parsedHtml = (parsed.html || '').slice(0, HTML_LIMIT);
      messageId = parsed.messageId || undefined;
      fromName = parsed.from?.name || undefined;
    } catch (err) {
      console.error('Failed to parse MIME:', err);
    }

    // SPF/DKIM verdicts — Workers expose these via headers when the email
    // arrives through Cloudflare Email Routing.
    const auth = (message.headers.get('Authentication-Results') || '').toLowerCase();
    const spfPass = auth.includes('spf=pass');
    const dkimPass = auth.includes('dkim=pass');

    const payload = {
      domain,
      recipient,
      resolvedLocal,
      resolvedSlug,
      from: fromAddr,
      fromName,
      subject: parsedSubject,
      text: parsedText,
      html: parsedHtml,
      messageId,
      spfPass,
      dkimPass,
    };

    let result: { forward?: string; archived?: boolean; reason?: string } = {};
    try {
      const res = await fetch(`${env.API_URL}/inbound-mail`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.INBOUND_MAIL_SECRET}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        console.error('LodgeKey API rejected inbound:', res.status, await res.text().catch(() => ''));
        // Fall through — without a destination we can only reject.
        message.setReject('No destination configured for this address');
        return;
      }
      result = await res.json();
    } catch (err) {
      console.error('LodgeKey API call failed:', err);
      message.setReject('Mail routing service unavailable');
      return;
    }

    if (result.archived) {
      // Logged but no live officer holds the role — silently accept.
      return;
    }

    if (result.forward) {
      // Delivery is handled server-side via Sendoff (avoids CF's destination-
      // allowlist requirement on message.forward). The API has already either
      // queued or failed the forward — either way, accept the message at the
      // SMTP layer so the sender doesn't see a bounce while we retry.
      return;
    }

    message.setReject('Unrecognised address');
  },
};

async function readStream(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.length;
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}
