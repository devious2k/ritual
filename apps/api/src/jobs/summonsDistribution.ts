import type { PrismaClient } from '@prisma/client';
import { sendBulkEmail } from '../services/emailService.js';

export async function runSummonsDistribution(prisma: PrismaClient) {
  // Find summonses that have been generated but not yet sent
  const pendingSummonses = await prisma.summons.findMany({
    where: {
      generatedAt: { not: null },
      sentAt: null,
    },
    include: {
      meeting: true,
      lodge: {
        include: {
          members: {
            where: {
              status: { in: ['ACTIVE', 'COUNTRY_MEMBER'] },
              email: { not: null },
            },
          },
        },
      },
    },
  });

  for (const summons of pendingSummonses) {
    const memberEmails = summons.lodge.members
      .map((m) => m.email)
      .filter((e): e is string => !!e);

    if (memberEmails.length === 0) continue;

    const meetingDate = summons.meeting.date.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    try {
      await sendBulkEmail(
        memberEmails,
        `Summons — ${summons.lodge.name} No. ${summons.lodge.number} — ${meetingDate}`,
        `
          <h2>Summons</h2>
          <h3>${summons.lodge.name} No. ${summons.lodge.number}</h3>
          <p>You are hereby summoned to attend a meeting of the lodge on
          <strong>${meetingDate}</strong> at <strong>${summons.meeting.startTime || 'the usual time'}</strong>
          at <strong>${summons.meeting.venue || summons.lodge.venue || 'the usual venue'}</strong>.</p>
          ${summons.rsvpDeadline ? `<p>Please respond by ${summons.rsvpDeadline.toLocaleDateString('en-GB')}.</p>` : ''}
          <p>By order of the Worshipful Master.</p>
        `,
      );

      await prisma.summons.update({
        where: { id: summons.id },
        data: {
          sentAt: new Date(),
          recipientCount: memberEmails.length,
        },
      });
    } catch (err) {
      console.error(`Failed to send summons ${summons.id}:`, err);
    }
  }
}
