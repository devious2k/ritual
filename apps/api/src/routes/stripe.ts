import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { lodgeScope } from '../middleware/lodgeScope.js';
import { requireRole } from '../middleware/roleGuard.js';
import {
  createConnectedAccount,
  createAccountLink,
  getAccountStatus,
  createCheckoutSession,
  createInvoice,
  processRefund,
  generateDashboardLink,
} from '../services/stripeService.js';

export async function stripeRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma;

  // All routes require auth + lodge scope
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', lodgeScope);

  // POST /stripe/connect/onboard — Create Stripe connected account + account link
  fastify.post('/connect/onboard', {
    preHandler: [requireRole('TREASURER', 'WORSHIPFUL_MASTER', 'SECRETARY', 'PROVINCE_ADMIN')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;

    const lodge = await prisma.lodge.findUnique({ where: { id: lodgeId } });
    if (!lodge) {
      return reply.status(404).send({ error: 'Lodge not found' });
    }

    if (lodge.stripeAccountId) {
      // Already has an account, just create a new account link
      const accountLink = await createAccountLink(lodge.stripeAccountId);
      return reply.send({ url: accountLink.url, accountId: lodge.stripeAccountId });
    }

    // Get treasurer email for the account
    const { email } = request.body as { email?: string };
    const accountEmail = email || request.user.email;

    const account = await createConnectedAccount(lodge.name, accountEmail);

    await prisma.lodge.update({
      where: { id: lodgeId },
      data: { stripeAccountId: account.id },
    });

    const accountLink = await createAccountLink(account.id);

    return reply.send({ url: accountLink.url, accountId: account.id });
  });

  // GET /stripe/connect/status — Check onboarding completion
  fastify.get('/connect/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;

    const lodge = await prisma.lodge.findUnique({
      where: { id: lodgeId },
      select: { stripeAccountId: true, stripeOnboardingComplete: true },
    });

    if (!lodge?.stripeAccountId) {
      return reply.send({ connected: false, onboardingComplete: false });
    }

    const account = await getAccountStatus(lodge.stripeAccountId);
    const onboardingComplete = account.charges_enabled && account.payouts_enabled;

    if (onboardingComplete && !lodge.stripeOnboardingComplete) {
      await prisma.lodge.update({
        where: { id: lodgeId },
        data: { stripeOnboardingComplete: true },
      });
    }

    return reply.send({
      connected: true,
      onboardingComplete,
      accountId: lodge.stripeAccountId,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
    });
  });

  // POST /stripe/checkout/dining — Create dining checkout session
  fastify.post('/checkout/dining', async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const { meetingId, memberId, guestCount } = request.body as {
      meetingId: string;
      memberId: string;
      guestCount?: number;
    };

    const lodge = await prisma.lodge.findUnique({ where: { id: lodgeId } });
    if (!lodge?.stripeAccountId || !lodge.stripeOnboardingComplete) {
      return reply.status(400).send({ error: 'Stripe not configured for this lodge' });
    }

    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, lodgeId },
    });
    if (!meeting) {
      return reply.status(404).send({ error: 'Meeting not found' });
    }

    const diningCost = meeting.diningCost || lodge.diningCost || 0;
    const guests = guestCount || 0;
    const totalAmount = Math.round((diningCost * (1 + guests)) * 100); // Convert to pence

    const session = await createCheckoutSession({
      accountId: lodge.stripeAccountId,
      amount: totalAmount,
      description: `Dining - ${meeting.type} meeting ${new Date(meeting.date).toLocaleDateString('en-GB')}`,
      successUrl: `${process.env.WEB_URL || 'https://freemasons.app'}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${process.env.WEB_URL || 'https://freemasons.app'}/meetings/${meetingId}`,
      metadata: {
        type: 'dining',
        lodgeId,
        meetingId,
        memberId,
        guestCount: String(guests),
      },
    });

    // Create or update dining fee record
    await prisma.diningFee.upsert({
      where: { memberId_meetingId: { memberId, meetingId } },
      create: {
        amount: diningCost,
        guestAmount: guests > 0 ? diningCost * guests : undefined,
        guestCount: guests,
        memberId,
        meetingId,
        stripeCheckoutSessionId: session.id,
      },
      update: {
        stripeCheckoutSessionId: session.id,
        guestCount: guests,
        guestAmount: guests > 0 ? diningCost * guests : undefined,
      },
    });

    return reply.send({ url: session.url, sessionId: session.id });
  });

  // POST /stripe/checkout/donation — Create donation checkout session
  fastify.post('/checkout/donation', async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const { amount, fund, memberId, giftAid } = request.body as {
      amount: number;
      fund: string;
      memberId?: string;
      giftAid?: boolean;
    };

    const lodge = await prisma.lodge.findUnique({ where: { id: lodgeId } });
    if (!lodge?.stripeAccountId || !lodge.stripeOnboardingComplete) {
      return reply.status(400).send({ error: 'Stripe not configured for this lodge' });
    }

    const amountInPence = Math.round(amount * 100);

    const session = await createCheckoutSession({
      accountId: lodge.stripeAccountId,
      amount: amountInPence,
      description: `Donation - ${fund}`,
      successUrl: `${process.env.WEB_URL || 'https://freemasons.app'}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${process.env.WEB_URL || 'https://freemasons.app'}/charity`,
      metadata: {
        type: 'donation',
        lodgeId,
        fund,
        memberId: memberId || '',
        giftAid: giftAid ? 'true' : 'false',
      },
    });

    return reply.send({ url: session.url, sessionId: session.id });
  });

  // POST /stripe/invoices/dues — Create/send dues invoice
  fastify.post('/invoices/dues', {
    preHandler: [requireRole('TREASURER', 'SECRETARY', 'WORSHIPFUL_MASTER', 'PROVINCE_ADMIN')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const { memberId, year, amount } = request.body as {
      memberId: string;
      year: number;
      amount?: number;
    };

    const lodge = await prisma.lodge.findUnique({ where: { id: lodgeId } });
    if (!lodge?.stripeAccountId || !lodge.stripeOnboardingComplete) {
      return reply.status(400).send({ error: 'Stripe not configured for this lodge' });
    }

    const member = await prisma.member.findFirst({
      where: { id: memberId, lodgeId },
    });
    if (!member) {
      return reply.status(404).send({ error: 'Member not found' });
    }

    if (!member.stripeCustomerId) {
      return reply.status(400).send({ error: 'Member has no Stripe customer ID. Set up their payment details first.' });
    }

    const duesAmount = amount || lodge.annualDues || 0;
    const amountInPence = Math.round(duesAmount * 100);

    const invoice = await createInvoice({
      accountId: lodge.stripeAccountId,
      customerId: member.stripeCustomerId,
      amount: amountInPence,
      description: `Annual Dues ${year}-${year + 1} - ${lodge.name} No. ${lodge.number}`,
    });

    // Create or update dues record
    await prisma.duesRecord.upsert({
      where: { memberId_lodgeId_year: { memberId, lodgeId, year } },
      create: {
        year,
        amount: duesAmount,
        grandLodgePortion: lodge.grandLodgeDues,
        provincialPortion: lodge.provincialDues,
        lodgePortion: duesAmount - (lodge.grandLodgeDues || 0) - (lodge.provincialDues || 0),
        memberId,
        lodgeId,
        stripeInvoiceId: invoice.id,
        dueDate: new Date(),
      },
      update: {
        stripeInvoiceId: invoice.id,
        amount: duesAmount,
      },
    });

    return reply.send({ invoiceId: invoice.id, status: invoice.status });
  });

  // POST /stripe/invoices/:id/remind — Send payment reminder
  fastify.post('/invoices/:id/remind', {
    preHandler: [requireRole('TREASURER', 'SECRETARY', 'WORSHIPFUL_MASTER', 'PROVINCE_ADMIN')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const lodgeId = (request as any).lodgeId;

    const lodge = await prisma.lodge.findUnique({ where: { id: lodgeId } });
    if (!lodge?.stripeAccountId) {
      return reply.status(400).send({ error: 'Stripe not configured for this lodge' });
    }

    // Find the dues record with this invoice
    const duesRecord = await prisma.duesRecord.findFirst({
      where: { stripeInvoiceId: id, lodgeId },
    });

    if (!duesRecord) {
      return reply.status(404).send({ error: 'Invoice not found' });
    }

    // Stripe doesn't have a direct "remind" API for standard invoices,
    // so we void and re-send or use the send endpoint
    const { stripe } = await import('../services/stripeService.js');
    await stripe.invoices.sendInvoice(id, {
      stripeAccount: lodge.stripeAccountId,
    });

    return reply.send({ message: 'Reminder sent' });
  });

  // POST /stripe/refund — Process refund
  fastify.post('/refund', {
    preHandler: [requireRole('TREASURER', 'WORSHIPFUL_MASTER', 'PROVINCE_ADMIN')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { paymentId, amount } = request.body as {
      paymentId: string;
      amount?: number;
    };
    const lodgeId = (request as any).lodgeId;

    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, lodgeId },
    });

    if (!payment || !payment.stripePaymentIntentId) {
      return reply.status(404).send({ error: 'Payment not found or not a Stripe payment' });
    }

    const amountInPence = amount ? Math.round(amount * 100) : undefined;
    const refund = await processRefund(payment.stripePaymentIntentId, amountInPence);

    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: amount ? 'PARTIALLY_REFUNDED' : 'REFUNDED',
        stripeRefundId: refund.id,
        refundedAt: new Date(),
      },
    });

    return reply.send({
      refundId: refund.id,
      status: refund.status,
      amount: refund.amount / 100,
    });
  });

  // GET /stripe/payments — List payments for lodge
  fastify.get('/payments', async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const { page = '1', limit = '20', type, status } = request.query as {
      page?: string;
      limit?: string;
      type?: string;
      status?: string;
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where: any = { lodgeId };
    if (type) where.type = type;
    if (status) where.status = status;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: { member: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.payment.count({ where }),
    ]);

    return reply.send({
      payments,
      pagination: { page: parseInt(page), limit: take, total, pages: Math.ceil(total / take) },
    });
  });

  // GET /stripe/dashboard-link — Generate Stripe Express Dashboard link
  fastify.get('/dashboard-link', {
    preHandler: [requireRole('TREASURER', 'WORSHIPFUL_MASTER', 'SECRETARY', 'PROVINCE_ADMIN')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;

    const lodge = await prisma.lodge.findUnique({ where: { id: lodgeId } });
    if (!lodge?.stripeAccountId) {
      return reply.status(400).send({ error: 'Stripe not configured for this lodge' });
    }

    const loginLink = await generateDashboardLink(lodge.stripeAccountId);
    return reply.send({ url: loginLink.url });
  });
}
