import type { PrismaClient } from '@prisma/client';
import { sendoffSend } from './sendoff.js';

interface PlanEmailContext {
  candidateFirstName: string;
  candidateLastName: string;
  candidateEmail: string;
  lodgeId: string;
  lodgeName: string;
  lodgeNumber: string;
  lodgeCrestUrl: string | null;
  bankSortCode: string | null;
  bankAccount: string | null;
  bankAccountName: string | null;
  joiningFeeAmount: number;
  year1SubsAmount: number;
  totalAmount: number;
  cadence: string;
  monthsToSpread: number;
  candidateCircumstances: string | null;
  instalments: Array<{
    sequence: number;
    label: string;
    dueDate: Date;
    amount: number;
    isJoiningFee: boolean;
  }>;
}

const NAVY = '#0F2547';
const GOLD = '#C9A24A';
const PARCH = '#F4F1EA';

function fmtGBP(n: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
}

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderPlanHtml(c: PlanEmailContext): string {
  const rows = c.instalments
    .map(
      (i) => `
        <tr style="${i.isJoiningFee ? `background:rgba(201,162,74,0.08);` : ''}">
          <td style="padding:8px 12px;border-bottom:1px solid #E8E2D2;color:${NAVY};font-size:13px;">${escapeHtml(i.label)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #E8E2D2;color:${NAVY};font-size:13px;">${escapeHtml(fmtDate(i.dueDate))}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #E8E2D2;color:${NAVY};font-size:13px;text-align:right;font-weight:${i.isJoiningFee ? 700 : 500};">${escapeHtml(fmtGBP(i.amount))}</td>
        </tr>`,
    )
    .join('');

  // Use the public crest endpoint — most email clients (Gmail, Outlook) strip
  // data: URIs from <img src>, so the inline data URL on Lodge.crestUrl never
  // renders. The /public/_lodges/:id/crest endpoint streams the bytes.
  const apiBase = process.env.API_BASE_URL || 'https://api.freemasons.app';
  const crestSrc = c.lodgeCrestUrl ? `${apiBase}/public/_lodges/${c.lodgeId}/crest` : null;
  const crest = crestSrc
    ? `<img src="${crestSrc}" alt="${escapeHtml(c.lodgeName)} crest" width="80" height="80" style="display:block;margin:0 auto 12px;border:0;" />`
    : '';

  const bankBlock = c.bankSortCode && c.bankAccount
    ? `<table cellpadding="0" cellspacing="0" style="margin:16px auto 0;border-collapse:collapse;background:rgba(15,37,71,0.04);border:1px solid ${GOLD};">
        <tr><td style="padding:6px 14px;color:${NAVY};font-size:12px;font-weight:700;letter-spacing:0.04em;">PAY TO</td><td style="padding:6px 14px;color:${NAVY};font-size:13px;">${escapeHtml(c.bankAccountName ?? c.lodgeName)}</td></tr>
        <tr><td style="padding:6px 14px;color:${NAVY};font-size:12px;font-weight:700;letter-spacing:0.04em;">SORT</td><td style="padding:6px 14px;color:${NAVY};font-size:13px;font-family:monospace;">${escapeHtml(c.bankSortCode)}</td></tr>
        <tr><td style="padding:6px 14px;color:${NAVY};font-size:12px;font-weight:700;letter-spacing:0.04em;">ACC</td><td style="padding:6px 14px;color:${NAVY};font-size:13px;font-family:monospace;">${escapeHtml(c.bankAccount)}</td></tr>
      </table>`
    : '';

  return `<!doctype html>
<html><body style="font-family:Georgia,'Times New Roman',serif;background:${PARCH};color:${NAVY};margin:0;padding:24px;">
  <div style="max-width:640px;margin:0 auto;background:#FFFFFF;border:1px solid ${GOLD};padding:32px 36px;">
    <div style="text-align:center;border-bottom:2px solid ${NAVY};padding-bottom:14px;margin-bottom:18px;">
      <p style="margin:0;font-size:11px;letter-spacing:0.18em;color:${NAVY};font-weight:700;text-transform:uppercase;">Antient Free &amp; Accepted Masons of England</p>
      ${crest}
      <h1 style="margin:0;font-family:'Playfair Display',Georgia,serif;font-size:32px;color:${NAVY};font-style:italic;">${escapeHtml(c.lodgeName)}</h1>
      <p style="margin:4px 0 0;font-family:'Playfair Display',Georgia,serif;font-size:18px;color:${NAVY};font-style:italic;">No. ${escapeHtml(c.lodgeNumber)}</p>
    </div>

    <p style="margin:0 0 12px;color:${NAVY};">Dear Bro. ${escapeHtml(c.candidateFirstName)} ${escapeHtml(c.candidateLastName)},</p>
    <p style="margin:0 0 16px;color:${NAVY};line-height:1.55;">
      Following our conversation about your circumstances, we have prepared a year-one payment plan that splits the joining fee and pro-rated annual subscription into manageable instalments. Once year one is complete, you will simply set up a standing order for £17 per month from month thirteen onwards.
    </p>

    <div style="border-top:1px solid ${GOLD};border-bottom:1px solid ${GOLD};padding:10px 0;margin:18px 0;text-align:center;">
      <h2 style="margin:0;font-family:'Playfair Display',Georgia,serif;font-size:18px;color:${NAVY};letter-spacing:0.06em;">YOUR PAYMENT PLAN</h2>
      <p style="margin:2px 0 0;color:${NAVY};font-size:12px;font-style:italic;">Total ${fmtGBP(c.totalAmount)} · Joining fee ${fmtGBP(c.joiningFeeAmount)} + Year-1 subs ${fmtGBP(c.year1SubsAmount)}</p>
    </div>

    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:${NAVY};color:#FFFFFF;">
          <th style="padding:8px 12px;text-align:left;font-size:11px;letter-spacing:0.06em;">INSTALMENT</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;letter-spacing:0.06em;">DUE</th>
          <th style="padding:8px 12px;text-align:right;font-size:11px;letter-spacing:0.06em;">AMOUNT</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr><td colspan="2" style="padding:10px 12px;border-top:2px solid ${NAVY};color:${NAVY};font-weight:700;text-align:right;">Total</td><td style="padding:10px 12px;border-top:2px solid ${NAVY};color:${NAVY};font-weight:700;text-align:right;">${fmtGBP(c.totalAmount)}</td></tr>
      </tfoot>
    </table>

    ${bankBlock}

    <p style="margin:18px 0 8px;color:${NAVY};font-size:13px;line-height:1.55;">
      Please use your name as the payment reference. If your circumstances change at any point, speak to the Treasurer directly — we would rather adjust the plan than have you fall behind.
    </p>
    <p style="margin:8px 0 0;color:${NAVY};font-size:13px;">Yours faithfully and fraternally,</p>
    <p style="margin:0;color:${NAVY};font-size:13px;font-style:italic;">The Treasurer, ${escapeHtml(c.lodgeName)} No. ${escapeHtml(c.lodgeNumber)}</p>

    <div style="margin-top:24px;border-top:1px solid ${GOLD};padding-top:10px;text-align:center;">
      <p style="margin:0;color:#7A8AA3;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;">Sent via LodgeKey</p>
    </div>
  </div>
</body></html>`;
}

function renderPlanText(c: PlanEmailContext): string {
  const lines = c.instalments
    .map((i) => `  ${i.sequence}. ${i.label} — due ${fmtDate(i.dueDate)} — ${fmtGBP(i.amount)}`)
    .join('\n');
  const bank = c.bankSortCode && c.bankAccount
    ? `\nPay to: ${c.bankAccountName ?? c.lodgeName}\n  Sort: ${c.bankSortCode}\n  Acc:  ${c.bankAccount}\n`
    : '';
  return `${c.lodgeName} No. ${c.lodgeNumber}

Dear Bro. ${c.candidateFirstName} ${c.candidateLastName},

Following our conversation, here is your year-one payment plan.

Joining fee:   ${fmtGBP(c.joiningFeeAmount)}
Year-1 subs:   ${fmtGBP(c.year1SubsAmount)}
Total:         ${fmtGBP(c.totalAmount)}

${lines}
${bank}
Use your name as the payment reference. If your circumstances change, speak to the Treasurer directly — we would rather adjust the plan than have you fall behind.

Yours faithfully and fraternally,
The Treasurer, ${c.lodgeName} No. ${c.lodgeNumber}
`;
}

export async function sendPaymentPlanEmail(prisma: PrismaClient, lodgeId: string, planId: string) {
  const plan = await prisma.paymentPlan.findFirst({
    where: { id: planId, lodgeId },
    include: {
      candidate: true,
      instalments: { orderBy: { sequence: 'asc' } },
    },
  });
  if (!plan) throw new Error('Plan not found');
  if (plan.status !== 'APPROVED' && plan.status !== 'ACTIVE') {
    throw new Error(`Plan must be APPROVED before email can be sent (current: ${plan.status})`);
  }
  const lodge = await prisma.lodge.findUnique({ where: { id: lodgeId } });
  if (!lodge) throw new Error('Lodge not found');
  const candidateEmail = plan.candidate.email;
  if (!candidateEmail) throw new Error('Candidate has no email on file');

  const ctx: PlanEmailContext = {
    candidateFirstName: plan.candidate.firstName,
    candidateLastName: plan.candidate.lastName,
    candidateEmail,
    lodgeId: lodge.id,
    lodgeName: lodge.name,
    lodgeNumber: lodge.number,
    lodgeCrestUrl: lodge.crestUrl,
    bankSortCode: lodge.bankSortCode,
    bankAccount: lodge.bankAccount,
    bankAccountName: lodge.bankAccountName,
    joiningFeeAmount: plan.joiningFeeAmount,
    year1SubsAmount: plan.year1SubsAmount,
    totalAmount: plan.totalAmount,
    cadence: plan.cadence,
    monthsToSpread: plan.monthsToSpread,
    candidateCircumstances: plan.candidateCircumstances,
    instalments: plan.instalments,
  };

  const html = renderPlanHtml(ctx);
  const text = renderPlanText(ctx);
  const fromAddress = process.env.LODGEKEY_FORWARD_FROM || 'lodge@freemasons.app';
  const slug = lodge.slug ?? lodge.id;

  await sendoffSend({
    to: candidateEmail,
    from: fromAddress,
    fromName: `${lodge.name} No. ${lodge.number}`,
    subject: `Your Year-1 Payment Plan — ${lodge.name} No. ${lodge.number}`,
    html,
    text,
    tags: ['payment-plan', `lodge:${slug}`, `plan:${planId}`],
  });

  await prisma.paymentPlan.update({
    where: { id: planId },
    data: { status: 'ACTIVE', sentAt: new Date() },
  });
}
