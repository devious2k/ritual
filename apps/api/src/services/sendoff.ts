/**
 * Thin wrapper around the Sendoff transactional email API.
 * Used to forward inbound mail on to the lodge officer who currently holds the
 * recipient's office.
 */

const SENDOFF_URL = 'https://api.sendoff.social/api/v1/email/send';

export interface SendoffAttachment {
  filename: string;
  content: Buffer;          // raw bytes; encoded as base64 before send
  contentType?: string;     // e.g. 'application/pdf'
}

export interface SendoffMessage {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  from?: string;          // must be on a verified Sendoff sending domain
  fromName?: string;
  replyTo?: string;
  tags?: string[];
  attachments?: SendoffAttachment[];
}

export async function sendoffSend(msg: SendoffMessage): Promise<{ id: number; providerId?: string }> {
  const apiKey = process.env.SENDOFF_API_KEY;
  if (!apiKey) throw new Error('SENDOFF_API_KEY not configured');

  const attachments = msg.attachments?.map((a) => ({
    filename: a.filename,
    content: a.content.toString('base64'),
    content_type: a.contentType ?? 'application/octet-stream',
  }));

  const res = await fetch(SENDOFF_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      to: msg.to,
      subject: msg.subject,
      html: msg.html ?? '',
      text: msg.text,
      from: msg.from,
      from_name: msg.fromName,
      tags: msg.tags,
      ...(attachments?.length ? { attachments } : {}),
    }),
  });

  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const m = body?.error?.message || body?.error || `Sendoff ${res.status}`;
    throw new Error(typeof m === 'string' ? m : JSON.stringify(m));
  }
  return { id: body?.data?.id, providerId: body?.data?.provider_id };
}
