import type { PrismaClient } from '@prisma/client';
import { XeroService } from '../services/xeroService.js';

export async function runXeroSync(prisma: PrismaClient) {
  const lodges = await prisma.lodge.findMany({
    where: { xeroTenantId: { not: null } },
  });

  const xero = new XeroService();

  for (const lodge of lodges) {
    if (!lodge.xeroTenantId) continue;

    try {
      // Sync new members as contacts
      const unsyncedMembers = await prisma.member.findMany({
        where: {
          lodgeId: lodge.id,
          status: 'ACTIVE',
        },
      });

      for (const member of unsyncedMembers) {
        try {
          await xero.createContact(lodge.xeroTenantId, {
            Name: `${member.firstName} ${member.lastName}`,
            EmailAddress: member.email,
            FirstName: member.firstName,
            LastName: member.lastName,
          });
        } catch {
          // Contact may already exist — skip
        }
      }

      // Sync recent transactions as invoices
      const recentTransactions = await prisma.transaction.findMany({
        where: {
          account: { lodgeId: lodge.id },
          xeroInvoiceId: null,
          type: 'INCOME',
          createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) }, // Last 15 mins
        },
        include: { account: true },
      });

      for (const txn of recentTransactions) {
        try {
          const invoice = await xero.createInvoice(lodge.xeroTenantId, {
            Type: 'ACCREC',
            Contact: { Name: txn.description },
            LineItems: [
              {
                Description: txn.description,
                Quantity: 1,
                UnitAmount: txn.amount,
                AccountCode: txn.account.xeroAccountCode || '200',
              },
            ],
            Date: txn.date.toISOString().split('T')[0],
            DueDate: txn.date.toISOString().split('T')[0],
            Status: 'AUTHORISED',
          });

          await prisma.transaction.update({
            where: { id: txn.id },
            data: { xeroInvoiceId: invoice.InvoiceID },
          });
        } catch (err) {
          console.error(`Failed to sync transaction ${txn.id} to Xero:`, err);
        }
      }

      // Update lodge sync timestamp
      await prisma.lodge.update({
        where: { id: lodge.id },
        data: { xeroLastSyncAt: new Date() },
      });
    } catch (err) {
      console.error(`Xero sync failed for lodge ${lodge.id}:`, err);
    }
  }
}
