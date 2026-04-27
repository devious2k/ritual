import { PrismaClient } from '@prisma/client';
import { OFFICE_LABELS, type OfficeKey } from '@lodgekey/shared';

interface SummonsContext {
  meetingId: string;
}

interface OfficerEntry {
  office: string;
  label: string;
  holder: string;
  prefix: 'W. Bro.' | 'Bro.';
  postNominal: string | null;
}

interface AgendaItem {
  index: number;
  text: string;
}

interface SummonsModel {
  lodgeId: string;
  lodgeName: string;
  lodgeNumber: string;
  province: string;
  date: Date;
  meetingTime: string;
  venue: string;
  venueAddress: string | null;
  ceremonyType: string | null;
  candidateName: string | null;
  agendaItems: AgendaItem[];
  diningCost: number | null;
  diningTime: string | null;
  rsvpDeadline: Date | null;
  rehearsalNote: string | null;
  officers: OfficerEntry[];
  pastMasters: string[];
  members: Array<{
    memberId: string;
    firstName: string;
    lastName: string;
    email: string | null;
    prefix: 'W. Bro.' | 'Bro.';
    postNominal: string | null;
  }>;
  wmFullName: string;
  wmPostNominal: string | null;
  secretaryFullName: string;
  secretaryPostNominal: string | null;
}

const POST_NOM_FROM_NOTES = /\b(PPJGW|PPJGD|PPSGD|PPGSwdB|PPGStB|PPGReg|PPGSuptWks|PPGTreas|PPGPurs|PPAGDC|PAGDC|PAGStB|PJGD|ProvGStB|PPDepGDC|PPSGW)\b/;

/**
 * Pulls everything the summons template needs in one DB roundtrip.
 */
export async function buildSummonsModel(prisma: PrismaClient, ctx: SummonsContext): Promise<SummonsModel> {
  const meeting = await prisma.meeting.findUnique({
    where: { id: ctx.meetingId },
    include: {
      lodge: { include: { province: true } },
      ceremonyPlan: true,
    },
  });
  if (!meeting) throw new Error('Meeting not found');

  const officersRaw = await prisma.officer.findMany({
    where: { lodgeId: meeting.lodgeId, isActive: true, year: { lte: new Date().getFullYear() } },
    orderBy: [{ year: 'desc' }, { createdAt: 'asc' }],
    include: { member: { include: { honours: true } } },
  });

  const isPastMaster = (m: { honours: Array<{ fullTitle: string | null; rank: string | null }> }) =>
    m.honours.some((h) => h.fullTitle?.includes('Past Master'));
  const postNominalFor = (m: { honours: Array<{ rank: string | null }> }) => {
    const ranks = m.honours.map((h) => h.rank).filter(Boolean) as string[];
    return ranks.length ? ranks.join(' ') : null;
  };

  const seenOffice = new Set<string>();
  const officers: OfficerEntry[] = [];
  for (const o of officersRaw) {
    const key = String(o.office);
    const prefix: 'W. Bro.' | 'Bro.' = isPastMaster(o.member) ? 'W. Bro.' : 'Bro.';
    const entry = {
      office: key,
      label: OFFICE_LABELS[key as OfficeKey] ?? key.replace(/_/g, ' '),
      holder: `${o.member.firstName} ${o.member.lastName}`.trim(),
      prefix,
      postNominal: postNominalFor(o.member),
    };
    if (key === 'STEWARD') { officers.push(entry); continue; }
    if (seenOffice.has(key)) continue;
    seenOffice.add(key);
    officers.push(entry);
  }

  const members = await prisma.member.findMany({
    where: { lodgeId: meeting.lodgeId, status: { in: ['ACTIVE', 'HONORARY', 'COUNTRY_MEMBER'] } as any },
    include: { honours: true, user: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });
  const pastMasterTitles: string[] = [];
  for (const m of members) {
    const pm = m.honours.find((h) => h.fullTitle?.includes('Past Master'));
    if (pm) pastMasterTitles.push(`W. Bro. ${m.firstName} ${m.lastName}${pm.rank ? ` (${pm.rank})` : ''}`);
  }

  const wm = officers.find((o) => o.office === 'WORSHIPFUL_MASTER');
  const sec = officers.find((o) => o.office === 'SECRETARY');

  // Compose default agenda if none was set on the Meeting row.
  const agendaItemsRaw = (meeting.agendaItems as any[]) ?? defaultAgenda(meeting.ceremonyPlan?.degree, meeting.candidateName);
  const agendaItems: AgendaItem[] = agendaItemsRaw.map((item, i) => ({
    index: i + 1,
    text: typeof item === 'string' ? item : (item?.title ?? item?.text ?? ''),
  }));

  return {
    lodgeId: meeting.lodge.id,
    lodgeName: meeting.lodge.name,
    lodgeNumber: meeting.lodge.number,
    province: meeting.lodge.province.name,
    date: meeting.date,
    meetingTime: meeting.startTime ?? '7:00pm prompt',
    venue: meeting.venue ?? meeting.lodge.venue ?? 'The Masonic Hall',
    venueAddress: meeting.venue && meeting.lodge.venueAddress ? meeting.lodge.venueAddress : null,
    ceremonyType: meeting.ceremonyType ?? meeting.ceremonyPlan?.ceremonyType ?? null,
    candidateName: meeting.candidateName ?? null,
    agendaItems,
    diningCost: meeting.diningCost ?? meeting.lodge.diningCost ?? null,
    diningTime: meeting.diningTime ?? null,
    rsvpDeadline: null, // can be set per-summons later
    rehearsalNote: null,
    officers,
    pastMasters: pastMasterTitles,
    members: members.map((m) => ({
      memberId: m.id,
      firstName: m.firstName,
      lastName: m.lastName,
      email: m.user?.email ?? m.email ?? null,
      prefix: (isPastMaster(m) ? 'W. Bro.' : 'Bro.') as 'W. Bro.' | 'Bro.',
      postNominal: postNominalFor(m),
    })),
    wmFullName: wm?.holder ?? '',
    wmPostNominal: wm?.postNominal ?? null,
    secretaryFullName: sec?.holder ?? '',
    secretaryPostNominal: sec?.postNominal ?? null,
  };
}

function defaultAgenda(degree: string | null | undefined, candidateName: string | null | undefined): string[] {
  const base = [
    'To Open the Lodge.',
    'To Confirm the Minutes of the previous Meeting.',
  ];
  if (degree === 'FIRST') base.push(`To Initiate ${candidateName ?? 'the candidate'}.`);
  else if (degree === 'SECOND') base.push(`To Pass ${candidateName ?? 'the candidate'} to the Second Degree.`);
  else if (degree === 'THIRD') base.push(`To Raise ${candidateName ?? 'the candidate'} to the Third Degree.`);
  else if (degree === 'INSTALLATION') base.push('To Install the Worshipful Master Elect.');
  base.push(
    "To Receive the Almoner's Report.",
    'To Receive a Charity Report.',
    'To Receive a Daily Advancement in Masonic Knowledge.',
    'To Receive Propositions.',
    'To Receive Communications.',
    'To Close the Lodge.',
  );
  return base;
}

function formatDateUK(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function formatGBP(amount: number | null): string {
  if (amount == null) return '';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
}

/**
 * HTML email body for an individual member's summons.
 *
 * Mirrors the printed Vulcan summons layout: top province banner, lodge
 * name + number, WM name, salutation/letter, agenda, lodge notices, MCF
 * reminder, officers list, address list, members list, past masters list.
 * The only LodgeKey-specific addition is the RSVP button below the agenda.
 */
export function renderSummonsEmailHtml(
  m: SummonsModel,
  recipient: { firstName: string; lastName: string },
  rsvpUrl: string,
  pdfUrl: string,
): string {
  const dateStr = formatDateUK(m.date);
  const wmTitle = `W. Bro. ${m.wmFullName}${m.wmPostNominal ? ' ' + m.wmPostNominal : ''}`;
  const secTitle = `W. Bro. ${m.secretaryFullName}${m.secretaryPostNominal ? ' ' + m.secretaryPostNominal : ''}`;

  const agenda = m.agendaItems
    .map((a) => `<li style="margin:6px 0;color:#0F2547;">${escapeHtml(a.text)}</li>`)
    .join('');

  const officersList = m.officers
    .map((o) => `
      <tr>
        <td style="padding:3px 12px 3px 0;color:#0F2547;white-space:nowrap;">${escapeHtml(o.prefix)} ${escapeHtml(o.holder.toUpperCase())}${o.postNominal ? ' <span style="color:#7A8AA3;">' + escapeHtml(o.postNominal) + '</span>' : ''}</td>
        <td style="padding:3px 0;color:#0F2547;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;">${escapeHtml(o.label)}</td>
      </tr>`)
    .join('');

  const membersList = m.members
    .map((mem) => `<div style="padding:2px 0;color:#0F2547;">${escapeHtml(mem.prefix)} ${escapeHtml(mem.firstName)} ${escapeHtml(mem.lastName)}${mem.postNominal ? ' <span style="color:#7A8AA3;">' + escapeHtml(mem.postNominal) + '</span>' : ''}</div>`)
    .join('');

  const pastMastersList = m.pastMasters.length
    ? m.pastMasters.map((pm) => `<div style="padding:2px 0;color:#0F2547;">${escapeHtml(pm)}</div>`).join('')
    : '';

  const dining = m.diningCost != null
    ? `<p style="margin:6px 0;color:#0F2547;"><strong>Festive Board:</strong> Brethren, please confirm your intention to dine to the DC. Cost ${formatGBP(m.diningCost)} per head.</p>`
    : `<p style="margin:6px 0;color:#0F2547;"><strong>Festive Board:</strong> Brethren, please confirm your intention to dine to the DC.</p>`;

  return `<!doctype html>
<html><body style="font-family:Georgia,'Times New Roman',serif;background:#F4F1EA;color:#0F2547;margin:0;padding:24px;">
  <div style="max-width:680px;margin:0 auto;background:#FFFFFF;border:1px solid #C9A24A;padding:32px 36px;">

    <!-- Top banner -->
    <div style="text-align:center;border-bottom:2px solid #0F2547;padding-bottom:14px;margin-bottom:18px;">
      <p style="margin:0;font-size:13px;letter-spacing:0.04em;color:#0F2547;font-weight:700;text-transform:uppercase;">Antient Free &amp; Accepted Masons of England</p>
      <p style="margin:4px 0 0 0;font-size:13px;color:#0F2547;font-style:italic;">${escapeHtml(m.province)}</p>
    </div>

    <!-- Lodge name + crest -->
    <div style="text-align:center;margin-bottom:18px;">
      <img src="${process.env.API_BASE_URL || 'https://api.freemasons.app'}/public/_lodges/${escapeHtml(m.lodgeId)}/crest" alt="${escapeHtml(m.lodgeName)} crest" width="90" height="90" style="display:block;margin:0 auto 8px;border:0;" />
      <h1 style="font-family:'Playfair Display',Georgia,serif;font-size:38px;color:#0F2547;margin:0;letter-spacing:0.02em;font-style:italic;">${escapeHtml(m.lodgeName)}</h1>
      <p style="margin:4px 0 0 0;font-family:'Playfair Display',Georgia,serif;font-size:24px;color:#0F2547;font-style:italic;">No. ${escapeHtml(m.lodgeNumber)}</p>
    </div>

    <!-- Worshipful Master block -->
    <div style="text-align:center;background:#0F2547;color:#FFFFFF;padding:14px;margin:18px 0;">
      <p style="margin:0;font-size:16px;font-weight:700;letter-spacing:0.04em;">${escapeHtml(wmTitle)}</p>
      <p style="margin:4px 0 0 0;font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:#C9A24A;">Worshipful Master</p>
    </div>

    <!-- Letter -->
    <p style="margin:18px 0 12px 0;color:#0F2547;">Dear Sir and Brother,</p>
    <p style="margin:0 0 16px 0;color:#0F2547;line-height:1.55;">By command of ${escapeHtml(wmTitle)}, Worshipful Master, you are hereby summoned to attend the duties of this Lodge at the Regular Meeting to be held at <strong>${escapeHtml(m.venue)}${m.venueAddress ? ', ' + escapeHtml(m.venueAddress) : ''}</strong>, on <strong>${escapeHtml(dateStr)}</strong>, at <strong>${escapeHtml(m.meetingTime)}</strong>.</p>
    <p style="margin:0 0 4px 0;color:#0F2547;">Yours faithfully and fraternally,</p>
    <p style="margin:0 0 16px 0;color:#0F2547;font-style:italic;">${escapeHtml(secTitle)}, Secretary</p>
    <p style="margin:0 0 6px 0;color:#0F2547;font-weight:700;">Dress: Dinner Suit and White Gloves.</p>
    <p style="margin:0 0 18px 0;color:#5C6678;font-size:12px;font-style:italic;line-height:1.45;">From Antient Times no Master or fellow could be absent from his Lodge, especially when warned to appear at it, without incurring a severe censure, unless it appeared to the Master or Wardens that pure necessity hindered. — Antient Charge.</p>

    <!-- Agenda -->
    <div style="border-top:1px solid #C9A24A;border-bottom:1px solid #C9A24A;padding:12px 0;margin:18px 0;text-align:center;">
      <h2 style="font-family:'Playfair Display',Georgia,serif;font-size:20px;color:#0F2547;margin:0;letter-spacing:0.06em;">AGENDA</h2>
      <p style="margin:2px 0 0 0;font-size:13px;color:#0F2547;font-style:italic;">${escapeHtml(dateStr)}</p>
    </div>
    <ol style="margin:0 0 18px 0;padding-left:24px;line-height:1.65;">${agenda}</ol>

    <!-- Festive board / RSVP CTA + PDF -->
    ${dining}
    <div style="text-align:center;margin:18px 0;">
      <a href="${rsvpUrl}" style="display:inline-block;background:#0F2547;color:#FFFFFF;font-family:Inter,Arial,sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;font-size:13px;padding:14px 28px;border:1px solid #C9A24A;text-decoration:none;margin:0 6px 6px 0;">RSVP for the Festive Board</a>
      <a href="${pdfUrl}" style="display:inline-block;background:#FFFFFF;color:#0F2547;font-family:Inter,Arial,sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;font-size:13px;padding:13px 24px;border:1px solid #0F2547;text-decoration:none;margin:0 6px 6px 0;">Download printable summons (PDF)</a>
    </div>
    <p style="margin:0 0 18px 0;font-size:12px;color:#5C6678;text-align:center;">If the buttons don't work, paste this link into your browser:<br><code style="word-break:break-all;color:#7B6A2A;">${escapeHtml(rsvpUrl)}</code></p>

    <!-- MCF reminder -->
    <div style="border-top:1px solid #C9A24A;padding-top:14px;margin-top:18px;">
      <p style="margin:0;font-weight:700;color:#0F2547;letter-spacing:0.04em;">MASONIC CHARITABLE FOUNDATION (MCF)</p>
      <p style="margin:6px 0;color:#0F2547;font-size:13px;line-height:1.5;">Brethren are reminded that if they are in need of confidential advice, or assistance in relation to financial, healthcare or family needs, then please contact in total confidence:</p>
      <p style="margin:0;color:#0F2547;font-size:13px;">Freephone <strong>0800 035 60 90</strong> · Email <a href="mailto:help@mcf.org.uk" style="color:#7B6A2A;">help@mcf.org.uk</a></p>
    </div>

    <!-- Officers of the Lodge -->
    <div style="margin-top:22px;">
      <h3 style="font-family:'Playfair Display',Georgia,serif;text-align:center;font-size:18px;color:#0F2547;border-bottom:1px solid #C9A24A;padding-bottom:6px;letter-spacing:0.04em;margin:0 0 12px 0;">OFFICERS OF THE LODGE</h3>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">${officersList}</table>
    </div>

    <!-- Members of the Lodge -->
    ${m.members.length ? `
    <div style="margin-top:22px;">
      <h3 style="font-family:'Playfair Display',Georgia,serif;text-align:center;font-size:18px;color:#0F2547;border-bottom:1px solid #C9A24A;padding-bottom:6px;letter-spacing:0.04em;margin:0 0 12px 0;">MEMBERS OF THE LODGE</h3>
      <div style="font-size:12px;column-count:2;column-gap:24px;">${membersList}</div>
    </div>` : ''}

    <!-- Past Masters of the Lodge -->
    ${pastMastersList ? `
    <div style="margin-top:22px;">
      <h3 style="font-family:'Playfair Display',Georgia,serif;text-align:center;font-size:18px;color:#0F2547;border-bottom:1px solid #C9A24A;padding-bottom:6px;letter-spacing:0.04em;margin:0 0 12px 0;">PAST MASTERS OF THE LODGE</h3>
      <div style="font-size:12px;column-count:2;column-gap:24px;">${pastMastersList}</div>
    </div>` : ''}

    <!-- Footer -->
    <div style="margin-top:24px;border-top:2px solid #0F2547;padding-top:14px;text-align:center;">
      <p style="margin:0;color:#0F2547;font-size:12px;font-style:italic;">${escapeHtml(m.lodgeName)} is a Grand Patron of the Royal Masonic Trust for Girls and Boys.</p>
      <p style="margin:8px 0 0 0;color:#7A8AA3;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;">Sent via LodgeKey</p>
    </div>
  </div>
</body></html>`;
}

export function renderSummonsEmailText(
  m: SummonsModel,
  _recipient: { firstName: string; lastName: string },
  rsvpUrl: string,
  pdfUrl: string,
): string {
  const dateStr = formatDateUK(m.date);
  const wmTitle = `W. Bro. ${m.wmFullName}${m.wmPostNominal ? ' ' + m.wmPostNominal : ''}`;
  const secTitle = `W. Bro. ${m.secretaryFullName}${m.secretaryPostNominal ? ' ' + m.secretaryPostNominal : ''}`;
  const dining = m.diningCost != null ? ` Cost ${formatGBP(m.diningCost)} per head.` : '';
  const officers = m.officers
    .map((o) => `  ${o.prefix} ${o.holder.toUpperCase()}${o.postNominal ? ' ' + o.postNominal : ''} — ${o.label}`)
    .join('\n');
  const members = m.members.length
    ? '\n\nMEMBERS OF THE LODGE\n' + m.members.map((mem) => `  ${mem.prefix} ${mem.firstName} ${mem.lastName}${mem.postNominal ? ' ' + mem.postNominal : ''}`).join('\n')
    : '';
  const pastMasters = m.pastMasters.length ? '\n\nPAST MASTERS OF THE LODGE\n' + m.pastMasters.map((pm) => `  ${pm}`).join('\n') : '';

  return `ANTIENT FREE & ACCEPTED MASONS OF ENGLAND
${m.province}

${m.lodgeName} No. ${m.lodgeNumber}
${wmTitle} — Worshipful Master

Dear Sir and Brother,

By command of ${wmTitle}, Worshipful Master, you are hereby summoned to attend the duties
of this Lodge at the Regular Meeting to be held at ${m.venue}${m.venueAddress ? ', ' + m.venueAddress : ''},
on ${dateStr}, at ${m.meetingTime}.

Yours faithfully and fraternally,
${secTitle}, Secretary

Dress: Dinner Suit and White Gloves.

From Antient Times no Master or fellow could be absent from his Lodge, especially when
warned to appear at it, without incurring a severe censure, unless it appeared to the
Master or Wardens that pure necessity hindered. — Antient Charge.

AGENDA — ${dateStr}
${m.agendaItems.map((a) => `${a.index}. ${a.text}`).join('\n')}

Festive Board: please confirm your intention to dine to the DC.${dining}
RSVP: ${rsvpUrl}
Printable summons (PDF): ${pdfUrl}

MASONIC CHARITABLE FOUNDATION (MCF)
Confidential help: Freephone 0800 035 60 90 · help@mcf.org.uk

OFFICERS OF THE LODGE
${officers}${members}${pastMasters}

${m.lodgeName} is a Grand Patron of the Royal Masonic Trust for Girls and Boys.
`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
