import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getStripe } from '../services/stripeService.js';

export async function stripeWebhookRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma;

  // POST /stripe/webhook — NO auth middleware, needs raw body
  fastify.post('/stripe/webhook', {
    config: { rawBody: true },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const sig = request.headers['stripe-signature'] as string;

    if (!sig) {
      return reply.status(400).send({ error: 'Missing stripe-signature header' });
    }

    let event;
    try {
      event = getStripe().webhooks.constructEvent(
        (request as any).rawBody || request.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      fastify.log.error(`Webhook signature verification failed: ${message}`);
      return reply.status(400).send({ error: `Webhook Error: ${message}` });
    }

    // Always return 200 quickly — process event asynchronously
    try {
      await handleStripeEvent(prisma, event, fastify.log);
    } catch (err) {
      // Log but don't fail the webhook
      fastify.log.error({ err, eventType: event.type }, 'Error processing Stripe event');
    }

    return reply.status(200).send({ received: true });
  });
}

async function handleStripeEvent(prisma: any, event: any, log: any) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const metadata = session.metadata || {};

      if (metadata.type === 'dining') {
        await prisma.diningFee.updateMany({
          where: { stripeCheckoutSessionId: session.id },
          data: {
            status: 'SUCCEEDED',
            paidDate: new Date(),
            paymentMethod: 'stripe',
          },
        });

        // Create payment record
        await prisma.payment.create({
          data: {
            type: 'DINING',
            status: 'SUCCEEDED',
            amount: session.amount_total / 100,
            description: `Dining payment`,
            stripeCheckoutSessionId: session.id,
            stripePaymentIntentId: session.payment_intent,
            memberId: metadata.memberId || null,
            lodgeId: metadata.lodgeId,
            paidAt: new Date(),
          },
        });

        // Create transaction
        const generalAccount = await prisma.account.findFirst({
          where: { lodgeId: metadata.lodgeId, type: 'GENERAL' },
        });

        if (generalAccount) {
          await prisma.transaction.create({
            data: {
              type: 'INCOME',
              amount: session.amount_total / 100,
              description: `Dining payment - Stripe checkout`,
              category: 'Dining',
              accountId: generalAccount.id,
              memberId: metadata.memberId || null,
            },
          });
        }
      } else if (metadata.type === 'donation') {
        await prisma.charityDonation.create({
          data: {
            amount: session.amount_total / 100,
            fund: metadata.fund || 'General',
            giftAid: metadata.giftAid === 'true',
            paymentMethod: 'stripe',
            stripeCheckoutSessionId: session.id,
            memberId: metadata.memberId || null,
            lodgeId: metadata.lodgeId,
          },
        });

        await prisma.payment.create({
          data: {
            type: 'DONATION',
            status: 'SUCCEEDED',
            amount: session.amount_total / 100,
            description: `Donation - ${metadata.fund || 'General'}`,
            stripeCheckoutSessionId: session.id,
            stripePaymentIntentId: session.payment_intent,
            memberId: metadata.memberId || null,
            lodgeId: metadata.lodgeId,
            paidAt: new Date(),
          },
        });

        const charityAccount = await prisma.account.findFirst({
          where: { lodgeId: metadata.lodgeId, type: 'CHARITY' },
        });

        if (charityAccount) {
          await prisma.transaction.create({
            data: {
              type: 'INCOME',
              amount: session.amount_total / 100,
              description: `Donation - ${metadata.fund || 'General'}`,
              category: 'Charity',
              accountId: charityAccount.id,
              memberId: metadata.memberId || null,
            },
          });
        }
      }
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object;

      // Update dues record linked to this invoice
      const duesRecord = await prisma.duesRecord.findFirst({
        where: { stripeInvoiceId: invoice.id },
      });

      if (duesRecord) {
        await prisma.duesRecord.update({
          where: { id: duesRecord.id },
          data: {
            status: 'CURRENT',
            paidDate: new Date(),
            paidAmount: invoice.amount_paid / 100,
            paymentMethod: 'stripe',
          },
        });

        await prisma.payment.create({
          data: {
            type: 'DUES',
            status: 'SUCCEEDED',
            amount: invoice.amount_paid / 100,
            description: `Dues payment - Invoice ${invoice.number}`,
            stripeInvoiceId: invoice.id,
            stripePaymentIntentId: invoice.payment_intent,
            memberId: duesRecord.memberId,
            lodgeId: duesRecord.lodgeId,
            paidAt: new Date(),
          },
        });

        const generalAccount = await prisma.account.findFirst({
          where: { lodgeId: duesRecord.lodgeId, type: 'GENERAL' },
        });

        if (generalAccount) {
          await prisma.transaction.create({
            data: {
              type: 'INCOME',
              amount: invoice.amount_paid / 100,
              description: `Dues payment - ${duesRecord.year}`,
              category: 'Dues',
              accountId: generalAccount.id,
              memberId: duesRecord.memberId,
            },
          });
        }
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;

      const duesRecord = await prisma.duesRecord.findFirst({
        where: { stripeInvoiceId: invoice.id },
      });

      if (duesRecord) {
        await prisma.duesRecord.update({
          where: { id: duesRecord.id },
          data: { status: 'OVERDUE' },
        });

        // Notify member and treasurer
        const member = await prisma.member.findUnique({
          where: { id: duesRecord.memberId },
          include: { user: true },
        });

        if (member?.user) {
          await prisma.notification.create({
            data: {
              type: 'payment_failed',
              title: 'Dues Payment Failed',
              body: `Your dues payment for ${duesRecord.year} could not be processed. Please update your payment method.`,
              link: '/dues',
              userId: member.user.id,
              lodgeId: duesRecord.lodgeId,
            },
          });
        }

        // Notify treasurer
        const treasurerAccess = await prisma.userLodgeAccess.findFirst({
          where: { lodgeId: duesRecord.lodgeId, role: 'TREASURER' },
        });

        if (treasurerAccess) {
          await prisma.notification.create({
            data: {
              type: 'payment_failed',
              title: 'Member Dues Payment Failed',
              body: `Payment failed for ${member?.firstName} ${member?.lastName} - ${duesRecord.year} dues.`,
              link: '/dues',
              userId: treasurerAccess.userId,
              lodgeId: duesRecord.lodgeId,
            },
          });
        }
      }
      break;
    }

    case 'charge.refunded': {
      const charge = event.data.object;
      const paymentIntentId = charge.payment_intent;

      if (paymentIntentId) {
        const payment = await prisma.payment.findFirst({
          where: { stripePaymentIntentId: paymentIntentId },
        });

        if (payment) {
          const isFullRefund = charge.amount_refunded === charge.amount;
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
              refundedAt: new Date(),
            },
          });

          // Create reverse transaction
          const generalAccount = await prisma.account.findFirst({
            where: { lodgeId: payment.lodgeId, type: 'GENERAL' },
          });

          if (generalAccount) {
            await prisma.transaction.create({
              data: {
                type: 'EXPENSE',
                amount: charge.amount_refunded / 100,
                description: `Refund - ${payment.description}`,
                category: 'Refund',
                accountId: generalAccount.id,
                memberId: payment.memberId,
                paymentId: payment.id,
              },
            });
          }
        }
      }
      break;
    }

    case 'account.updated': {
      const account = event.data.object;

      const lodge = await prisma.lodge.findFirst({
        where: { stripeAccountId: account.id },
      });

      if (lodge) {
        const onboardingComplete = account.charges_enabled && account.payouts_enabled;
        await prisma.lodge.update({
          where: { id: lodge.id },
          data: { stripeOnboardingComplete: onboardingComplete },
        });
      }
      break;
    }

    case 'payment_intent.succeeded': {
      // Idempotent fallback — check if payment already recorded
      const pi = event.data.object;
      const existing = await prisma.payment.findFirst({
        where: { stripePaymentIntentId: pi.id },
      });

      if (!existing) {
        log.info({ paymentIntentId: pi.id }, 'payment_intent.succeeded with no matching payment record — may be handled by checkout.session.completed');
      }
      break;
    }

    default:
      log.info({ eventType: event.type }, 'Unhandled Stripe event type');
  }
}
