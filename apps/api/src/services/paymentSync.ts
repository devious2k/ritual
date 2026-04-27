import type { PrismaClient } from '@prisma/client';

export async function handleCheckoutCompleted(
  prisma: PrismaClient,
  session: any,
): Promise<void> {
  const metadata = session.metadata || {};
  const lodgeId = metadata.lodgeId;
  const memberId = metadata.memberId;
  const paymentType = metadata.type || 'OTHER';

  const payment = await prisma.payment.create({
    data: {
      type: paymentType,
      status: 'SUCCEEDED',
      amount: (session.amount_total || 0) / 100, // Convert from pence to pounds
      currency: session.currency || 'gbp',
      description: metadata.description || 'Payment via checkout',
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: session.payment_intent || null,
      memberId: memberId || null,
      lodgeId,
      paidAt: new Date(),
    },
  });

  // Create corresponding transaction
  if (lodgeId) {
    const account = await prisma.account.findFirst({
      where: { lodgeId, type: 'GENERAL' },
    });

    if (account) {
      await prisma.transaction.create({
        data: {
          type: 'INCOME',
          amount: (session.amount_total || 0) / 100,
          description: metadata.description || 'Stripe checkout payment',
          date: new Date(),
          reference: session.id,
          accountId: account.id,
          memberId: memberId || null,
          paymentId: payment.id,
          category: paymentType,
        },
      });
    }
  }

  // Update dining fee if applicable
  if (paymentType === 'DINING' && metadata.meetingId && memberId) {
    await prisma.diningFee.updateMany({
      where: { memberId, meetingId: metadata.meetingId },
      data: {
        status: 'SUCCEEDED',
        paidDate: new Date(),
        paymentMethod: 'stripe',
        stripeCheckoutSessionId: session.id,
      },
    });
  }

  // Update charity donation if applicable
  if (paymentType === 'DONATION' && metadata.donationId) {
    await prisma.charityDonation.update({
      where: { id: metadata.donationId },
      data: {
        paymentMethod: 'stripe',
        stripeCheckoutSessionId: session.id,
      },
    });
  }
}

export async function handleInvoicePaid(
  prisma: PrismaClient,
  invoice: any,
): Promise<void> {
  const metadata = invoice.metadata || {};
  const lodgeId = metadata.lodgeId;
  const memberId = metadata.memberId;

  // Create or update payment record
  const payment = await prisma.payment.create({
    data: {
      type: 'DUES',
      status: 'SUCCEEDED',
      amount: (invoice.amount_paid || 0) / 100,
      currency: invoice.currency || 'gbp',
      description: `Dues invoice ${invoice.number || invoice.id}`,
      stripeInvoiceId: invoice.id,
      stripePaymentIntentId: invoice.payment_intent || null,
      memberId: memberId || null,
      lodgeId,
      paidAt: new Date(),
    },
  });

  // Update dues record
  if (metadata.duesRecordId) {
    await prisma.duesRecord.update({
      where: { id: metadata.duesRecordId },
      data: {
        status: 'CURRENT',
        paidDate: new Date(),
        paidAmount: (invoice.amount_paid || 0) / 100,
        paymentMethod: 'stripe',
        stripeInvoiceId: invoice.id,
      },
    });
  }

  // Create transaction
  if (lodgeId) {
    const account = await prisma.account.findFirst({
      where: { lodgeId, type: 'GENERAL' },
    });

    if (account) {
      await prisma.transaction.create({
        data: {
          type: 'INCOME',
          amount: (invoice.amount_paid || 0) / 100,
          description: `Dues payment - Invoice ${invoice.number || invoice.id}`,
          date: new Date(),
          reference: invoice.id,
          accountId: account.id,
          memberId: memberId || null,
          paymentId: payment.id,
          category: 'DUES',
        },
      });
    }
  }
}

export async function handleChargeRefunded(
  prisma: PrismaClient,
  charge: any,
): Promise<void> {
  const paymentIntentId = charge.payment_intent;

  if (!paymentIntentId) return;

  // Find and update existing payment
  const existingPayment = await prisma.payment.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
  });

  if (existingPayment) {
    const isFullRefund = charge.amount_refunded === charge.amount;

    await prisma.payment.update({
      where: { id: existingPayment.id },
      data: {
        status: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
        refundedAt: new Date(),
      },
    });

    // Create reverse transaction
    if (existingPayment.lodgeId) {
      const account = await prisma.account.findFirst({
        where: { lodgeId: existingPayment.lodgeId, type: 'GENERAL' },
      });

      if (account) {
        await prisma.transaction.create({
          data: {
            type: 'EXPENSE',
            amount: (charge.amount_refunded || 0) / 100,
            description: `Refund - ${existingPayment.description || 'Payment refund'}`,
            date: new Date(),
            reference: charge.id,
            accountId: account.id,
            memberId: existingPayment.memberId,
            paymentId: existingPayment.id,
            category: 'Refund',
          },
        });
      }
    }
  }
}
