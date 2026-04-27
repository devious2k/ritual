import type { PrismaClient } from '@prisma/client';
import { sendEmail } from '../services/emailService.js';

export async function runPaymentReminders(prisma: PrismaClient) {
  // Find overdue dues records with associated member emails
  const overdueDues = await prisma.duesRecord.findMany({
    where: {
      status: { in: ['OVERDUE', 'ARREARS'] },
    },
    include: {
      member: true,
      lodge: true,
    },
  });

  for (const record of overdueDues) {
    if (!record.member.email) continue;

    try {
      await sendEmail(
        record.member.email,
        `Dues Reminder — ${record.lodge.name} No. ${record.lodge.number}`,
        `
          <h2>Annual Dues Reminder</h2>
          <p>Dear Bro ${record.member.firstName} ${record.member.lastName},</p>
          <p>This is a reminder that your annual dues of <strong>£${record.amount.toFixed(2)}</strong>
          for the ${record.year}/${record.year + 1} Masonic year are outstanding.</p>
          <p>Please arrange payment at your earliest convenience.</p>
          <p>Fraternal regards,<br/>${record.lodge.name} No. ${record.lodge.number}</p>
        `,
      );
    } catch (err) {
      console.error(`Failed to send reminder to ${record.member.email}:`, err);
    }
  }

  // Find unpaid dining fees
  const unpaidDining = await prisma.diningFee.findMany({
    where: { status: 'PENDING' },
    include: {
      member: true,
      meeting: { include: { lodge: true } },
    },
  });

  for (const fee of unpaidDining) {
    if (!fee.member.email) continue;

    try {
      await sendEmail(
        fee.member.email,
        `Dining Fee Reminder — ${fee.meeting.lodge.name}`,
        `
          <h2>Dining Fee Reminder</h2>
          <p>Dear Bro ${fee.member.firstName} ${fee.member.lastName},</p>
          <p>A dining fee of <strong>£${fee.amount.toFixed(2)}</strong> is outstanding
          for the meeting on ${fee.meeting.date.toLocaleDateString('en-GB')}.</p>
          <p>Fraternal regards,<br/>${fee.meeting.lodge.name}</p>
        `,
      );
    } catch (err) {
      console.error(`Failed to send dining reminder to ${fee.member.email}:`, err);
    }
  }
}
