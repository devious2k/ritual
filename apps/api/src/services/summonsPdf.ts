import PDFDocument from 'pdfkit';
import type { PrismaClient } from '@prisma/client';
import { buildSummonsModel } from './summons.js';

// A4 LANDSCAPE summons mirroring the printed Vulcan layout.
//
// Page 1 (landscape):
//   Left column  → OFFICERS OF THE LODGE list, then Address list, then
//                  the Book of Constitutions paragraph + Grand Patron line.
//   Right column → AGENDA heading + items, Annual Subs / Rehearsal /
//                  Festive Board notices, MCF block, RSVP reminder.
//
// Page 2 (landscape):
//   Left column  → MEMBERS OF THE LODGE + PAST MASTERS OF THE LODGE.
//   Right column → Province banner, LARGE italic lodge name + No.,
//                  centred crest, navy WM block, "Dear Sir & Brother"
//                  letter, dress code, Antient Charge italic note.

const NAVY = '#0F2547';
const GOLD = '#C9A24A';
const INK_MUTED = '#5C6678';

function decodeCrest(crestUrl: string | null | undefined): Buffer | null {
  if (!crestUrl) return null;
  const m = crestUrl.match(/^data:image\/(png|jpe?g);base64,(.*)$/);
  if (!m) return null;
  try { return Buffer.from(m[2], 'base64'); } catch { return null; }
}

function formatDateLong(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function formatGBP(amount: number | null): string {
  if (amount == null) return '';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
}

export async function buildSummonsPdf(
  prisma: PrismaClient,
  meetingId: string,
): Promise<Buffer> {
  const model = await buildSummonsModel(prisma, { meetingId });
  const meetingRow = await prisma.meeting.findUnique({ where: { id: meetingId }, select: { lodgeId: true } });
  const lodge = meetingRow ? await prisma.lodge.findUnique({ where: { id: meetingRow.lodgeId } }) : null;
  const crest = decodeCrest(lodge?.crestUrl);

  const wmTitle = `W. Bro. ${model.wmFullName}${model.wmPostNominal ? ' ' + model.wmPostNominal : ''}`.trim();
  const secTitle = `W. Bro. ${model.secretaryFullName}${model.secretaryPostNominal ? ' ' + model.secretaryPostNominal : ''}`.trim();

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margins: { top: 30, bottom: 30, left: 36, right: 36 },
      info: {
        Title: `Summons — ${model.lodgeName} No. ${model.lodgeNumber} — ${formatDateLong(model.date)}`,
        Author: model.lodgeName,
        Subject: `Lodge summons for ${formatDateLong(model.date)}`,
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawPage2(doc, model, crest, wmTitle, secTitle);
    doc.addPage();
    drawPage1(doc, model);
    doc.end();
  });
}

interface ColRect { x: number; y: number; w: number; bottom: number; }

function pageColumns(doc: PDFKit.PDFDocument, leftFraction = 0.5): { left: ColRect; right: ColRect } {
  const lx = doc.page.margins.left;
  const rx = doc.page.width - doc.page.margins.right;
  const top = doc.page.margins.top;
  const bottom = doc.page.height - doc.page.margins.bottom;
  const totalW = rx - lx;
  const gap = 24;
  const leftW = (totalW - gap) * leftFraction;
  return {
    left: { x: lx, y: top, w: leftW, bottom },
    right: { x: lx + leftW + gap, y: top, w: totalW - leftW - gap, bottom },
  };
}

function drawPage1(
  doc: PDFKit.PDFDocument,
  m: Awaited<ReturnType<typeof buildSummonsModel>>,
) {
  const { left, right } = pageColumns(doc, 0.5);

  // ---------- LEFT COLUMN: OFFICERS + ADDRESSES + COTC PARA ----------
  doc.x = left.x; doc.y = left.y;

  drawSectionHeader(doc, 'OFFICERS OF THE LODGE', left.x, left.w);

  // Reserve enough width for "IMMEDIATE PAST MASTER" / "DIRECTOR OF CEREMONIES"
  const officeLabelW = 150;
  const officeColX = left.x + left.w - officeLabelW;
  for (const o of m.officers) {
    if (doc.y + 11 > left.bottom) break;
    const rowY = doc.y;
    const nameLine = `${o.prefix} ${o.holder.toUpperCase()}${o.postNominal ? ' ' + o.postNominal : ''}`;
    const nameW = officeColX - left.x - 6;
    doc.font('Helvetica').fontSize(8).fillColor(NAVY)
      .text(truncateToWidth(doc, nameLine, nameW), left.x, rowY, { width: nameW, lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(8).fillColor(NAVY)
      .text(o.label.toUpperCase(), officeColX, rowY, { width: officeLabelW, align: 'right', characterSpacing: 0.4, lineBreak: false });
    doc.y = rowY + 10;
  }

  doc.moveDown(0.4);
  doc.lineWidth(0.5).strokeColor(GOLD).moveTo(left.x, doc.y).lineTo(left.x + left.w, doc.y).stroke();
  doc.moveDown(0.3);

  // Book of Constitutions paragraph
  doc.font('Times-Roman').fontSize(8).fillColor(NAVY).text(
    'The Book of Constitutions states that the Supreme Order of the Holy Royal Arch is included in "Pure Antient Masonry" and many Brethren take the view that the essential four stage process for every Mason is "initiation to exaltation" thereby continuing and completing his Craft degrees. Every Master Mason is invited to consider the desirability of becoming a Royal Arch Mason.',
    left.x, doc.y, { width: left.w, align: 'justify' },
  );
  doc.moveDown(0.4);

  doc.font('Times-Italic').fontSize(9).fillColor(NAVY).text(
    `${m.lodgeName} is a Grand Patron of the Royal Masonic Trust for Girls and Boys.`,
    left.x, doc.y, { width: left.w, align: 'center' },
  );

  // ---------- RIGHT COLUMN: AGENDA + NOTICES + MCF ----------
  doc.x = right.x; doc.y = right.y;

  // Date sub-line above agenda
  doc.font('Times-Bold').fontSize(13).fillColor(NAVY)
    .text('AGENDA', right.x, doc.y, { width: right.w, align: 'center', characterSpacing: 1 });
  doc.font('Times-Italic').fontSize(10).fillColor(NAVY)
    .text(formatDateLong(m.date), right.x, doc.y, { width: right.w, align: 'center' });
  doc.moveDown(0.15);
  doc.lineWidth(0.6).strokeColor(GOLD).moveTo(right.x, doc.y).lineTo(right.x + right.w, doc.y).stroke();
  doc.moveDown(0.35);

  doc.font('Times-Roman').fontSize(10).fillColor(NAVY);
  for (const a of m.agendaItems) {
    if (doc.y + 13 > right.bottom - 140) break;
    const rowY = doc.y;
    doc.text(`${a.index}.`, right.x, rowY, { width: 18, lineBreak: false });
    doc.text(a.text, right.x + 22, rowY, { width: right.w - 22 });
    doc.moveDown(0.05);
  }
  doc.moveDown(0.3);

  // Notices block
  const dining = m.diningCost != null ? ` Cost ${formatGBP(m.diningCost)} per head.` : '';
  doc.font('Times-Roman').fontSize(9).fillColor(NAVY);
  doc.text('Annual subscriptions became due on 1st April.', right.x, doc.y, { width: right.w });
  doc.text('A Lodge rehearsal will be held at the Masonic Hall — see your DC for date and time.', right.x, doc.y, { width: right.w });
  doc.font('Times-Bold').text('Festive Board: ', { continued: true });
  doc.font('Times-Roman').text(
    `Brethren, please confirm your intention to dine to the DC.${dining} An RSVP link has been emailed to you.`,
    { width: right.w },
  );
  doc.moveDown(0.3);

  // MCF
  doc.font('Times-Bold').fontSize(9).fillColor(NAVY)
    .text('MASONIC CHARITABLE FOUNDATION (MCF)', right.x, doc.y, { width: right.w });
  doc.font('Times-Roman').fontSize(9).fillColor(NAVY).text(
    'Brethren are reminded that if they are in need of confidential advice, or assistance in relation to financial, healthcare or family needs, then please contact in total confidence: Freephone 0800 035 60 90 · help@mcf.org.uk',
    right.x, doc.y, { width: right.w, align: 'justify' },
  );
}

function drawPage2(
  doc: PDFKit.PDFDocument,
  m: Awaited<ReturnType<typeof buildSummonsModel>>,
  crest: Buffer | null,
  wmTitle: string,
  secTitle: string,
) {
  const { left, right } = pageColumns(doc, 0.5);

  // ---------- LEFT COLUMN: MEMBERS + PAST MASTERS ----------
  doc.x = left.x; doc.y = left.y;

  if (m.members.length > 0) {
    drawSectionHeader(doc, 'MEMBERS OF THE LODGE', left.x, left.w);
    drawColumns(
      doc,
      m.members.map((mem) => `${mem.prefix} ${mem.firstName} ${mem.lastName}${mem.postNominal ? ' ' + mem.postNominal : ''}`),
      left.x, left.w, 2,
    );
    doc.moveDown(0.4);
  }

  if (m.pastMasters.length > 0) {
    if (doc.y + 60 < left.bottom) {
      drawSectionHeader(doc, 'PAST MASTERS OF THE LODGE', left.x, left.w);
      drawColumns(doc, m.pastMasters, left.x, left.w, 2);
    }
  }

  // ---------- RIGHT COLUMN: BANNER + LETTER ----------
  doc.x = right.x; doc.y = right.y;

  // Province banner
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(10)
    .text('ANTIENT FREE & ACCEPTED MASONS OF ENGLAND', right.x, doc.y, { width: right.w, align: 'center', characterSpacing: 0.4 });
  doc.font('Helvetica-Oblique').fontSize(9).fillColor(NAVY)
    .text(m.province, { width: right.w, align: 'center' });
  doc.moveDown(0.2);
  doc.lineWidth(1.5).strokeColor(NAVY).moveTo(right.x, doc.y).lineTo(right.x + right.w, doc.y).stroke();
  doc.moveDown(0.5);

  // Crest centered
  if (crest) {
    const sz = 90;
    doc.image(crest, right.x + (right.w - sz) / 2, doc.y, { width: sz, height: sz });
    doc.y += sz + 8;
  }

  // Lodge name italic, large
  doc.font('Times-Italic').fontSize(34).fillColor(NAVY)
    .text(m.lodgeName, right.x, doc.y, { width: right.w, align: 'center' });
  doc.font('Times-Italic').fontSize(22).fillColor(NAVY)
    .text(`No. ${m.lodgeNumber}`, { width: right.w, align: 'center' });
  doc.moveDown(0.5);

  // WM Block
  const wmY = doc.y;
  const wmH = 46;
  doc.save();
  doc.rect(right.x, wmY, right.w, wmH).fill(NAVY);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(12)
    .text(wmTitle, right.x, wmY + 8, { width: right.w, align: 'center' });
  doc.fillColor(GOLD).font('Helvetica').fontSize(9)
    .text('WORSHIPFUL MASTER', right.x, wmY + 25, { width: right.w, align: 'center', characterSpacing: 1.4 });
  doc.restore();
  doc.y = wmY + wmH + 12;

  // Letter
  doc.fillColor(NAVY).font('Times-Roman').fontSize(10);
  doc.text('Dear Sir and Brother,', right.x, doc.y, { width: right.w });
  doc.moveDown(0.3);
  const venueLine = `${m.venue}${m.venueAddress ? ', ' + m.venueAddress : ''}`;
  doc.text(
    `By command of ${wmTitle}, Worshipful Master, you are hereby summoned to attend the duties of this Lodge at the Regular Meeting to be held at ${venueLine}, on ${formatDateLong(m.date)}, at ${m.meetingTime}.`,
    { width: right.w, align: 'justify' },
  );
  doc.moveDown(0.3);
  doc.text('Yours faithfully and fraternally,', { width: right.w });
  doc.font('Times-Italic').text(`${secTitle}, Secretary`, { width: right.w });
  doc.moveDown(0.3);
  doc.font('Times-Bold').text('Dress: Dinner Suit and White Gloves.', { width: right.w });
  doc.moveDown(0.3);
  doc.font('Times-Italic').fontSize(8).fillColor(INK_MUTED).text(
    'From Antient Times no Master or fellow could be absent from his Lodge, especially when warned to appear at it, without incurring a severe censure, unless it appeared to the Master or Wardens that pure necessity hindered. — Antient Charge.',
    right.x, doc.y, { width: right.w, align: 'justify' },
  );
}

function drawSectionHeader(doc: PDFKit.PDFDocument, title: string, x: number, width: number) {
  doc.fillColor(NAVY).font('Times-Bold').fontSize(12)
    .text(title, x, doc.y, { width, align: 'center', characterSpacing: 0.8 });
  doc.moveDown(0.05);
  doc.lineWidth(0.6).strokeColor(GOLD).moveTo(x, doc.y).lineTo(x + width, doc.y).stroke();
  doc.moveDown(0.3);
}

function drawColumns(
  doc: PDFKit.PDFDocument,
  items: string[],
  x: number,
  width: number,
  cols: number,
) {
  const gap = 12;
  const colWidth = (width - gap * (cols - 1)) / cols;
  const perCol = Math.ceil(items.length / cols);

  doc.font('Helvetica').fontSize(8).fillColor(NAVY);
  const startY = doc.y;
  let endY = startY;
  for (let c = 0; c < cols; c++) {
    let y = startY;
    for (let r = 0; r < perCol; r++) {
      const idx = c * perCol + r;
      if (idx >= items.length) break;
      doc.text(truncateToWidth(doc, items[idx], colWidth), x + c * (colWidth + gap), y, { width: colWidth, lineBreak: false });
      y += 10;
    }
    if (y > endY) endY = y;
  }
  doc.y = endY;
}

function truncateToWidth(doc: PDFKit.PDFDocument, str: string, maxW: number): string {
  if (doc.widthOfString(str) <= maxW) return str;
  let s = str;
  while (s.length > 1 && doc.widthOfString(s + '…') > maxW) s = s.slice(0, -1);
  return s + '…';
}
