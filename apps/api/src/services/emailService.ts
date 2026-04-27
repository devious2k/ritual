import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: Number(process.env.SMTP_PORT) || 1025,
      secure: process.env.SMTP_SECURE === 'true',
      ...(process.env.SMTP_USER && {
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      }),
    });
  }
  return transporter;
}

function wrapHtml(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f7; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #1a365d; color: #ffffff; padding: 24px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .body { background-color: #ffffff; padding: 32px 24px; border-radius: 0 0 8px 8px; }
    .footer { text-align: center; padding: 16px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>LodgeKey</h1>
    </div>
    <div class="body">
      ${content}
    </div>
    <div class="footer">
      <p>Sent via LodgeKey &mdash; freemasons.app</p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  const transport = getTransporter();
  await transport.sendMail({
    from: process.env.SMTP_FROM || 'noreply@freemasons.app',
    to,
    subject,
    html: wrapHtml(html),
  });
}

export async function sendBulkEmail(
  recipients: string[],
  subject: string,
  html: string,
): Promise<void> {
  const wrappedHtml = wrapHtml(html);
  const transport = getTransporter();

  await Promise.allSettled(
    recipients.map((to) =>
      transport.sendMail({
        from: process.env.SMTP_FROM || 'noreply@freemasons.app',
        to,
        subject,
        html: wrappedHtml,
      }),
    ),
  );
}
