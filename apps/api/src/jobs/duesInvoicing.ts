import type { PrismaClient } from '@prisma/client';
import { createInvoice } from '../services/stripeService.js';

export async function runDuesInvoicing(prisma: PrismaClient) {
  const lodges = await prisma.lodge.findMany({
    where: {
      stripeAccountId: { not: null },
      stripeOnboardingComplete: true,
    },
    include: {
      members: {
        where: {
          status: 'ACTIVE',
          stripeCustomerId: { not: null },
        },
      },
    },
  });

  for (const lodge of lodges) {
    if (!lodge.annualDues || !lodge.stripeAccountId) continue;

    const currentYear = new Date().getFullYear();

    for (const member of lodge.members) {
      const existing = await prisma.duesRecord.findUnique({
        where: {
          memberId_lodgeId_year: {
            memberId: member.id,
            lodgeId: lodge.id,
            year: currentYear,
          },
        },
      });

      if (existing) continue;

      try {
        const invoice = await createInvoice({
          accountId: lodge.stripeAccountId,
          customerId: member.stripeCustomerId!,
          amount: lodge.annualDues,
          description: `Annual dues ${currentYear}/${currentYear + 1} — ${lodge.name} No. ${lodge.number}`,
        });

        await prisma.duesRecord.create({
          data: {
            year: currentYear,
            amount: lodge.annualDues,
            grandLodgePortion: lodge.grandLodgeDues,
            provincialPortion: lodge.provincialDues,
            lodgePortion: lodge.annualDues - (lodge.grandLodgeDues || 0) - (lodge.provincialDues || 0),
            status: 'CURRENT',
            dueDate: new Date(currentYear, 8, 1), // 1st September
            stripeInvoiceId: invoice.id,
            memberId: member.id,
            lodgeId: lodge.id,
          },
        });
      } catch (err) {
        console.error(`Failed to create dues invoice for member ${member.id}:`, err);
      }
    }
  }
}
