import Stripe from 'stripe';

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

export { getStripe };

export async function createConnectedAccount(
  lodgeName: string,
  email: string,
): Promise<Stripe.Account> {
  return getStripe().accounts.create({
    type: 'standard',
    email,
    business_profile: {
      name: lodgeName,
      mcc: '8661', // Religious organisations
    },
    metadata: {
      platform: 'lodgekey',
    },
  });
}

export async function createAccountLink(
  accountId: string,
): Promise<Stripe.AccountLink> {
  return getStripe().accountLinks.create({
    account: accountId,
    refresh_url:
      process.env.STRIPE_CONNECT_REFRESH_URL ||
      'https://freemasons.app/settings/payments/retry',
    return_url:
      process.env.STRIPE_CONNECT_RETURN_URL ||
      'https://freemasons.app/settings/payments',
    type: 'account_onboarding',
  });
}

export async function getAccountStatus(
  accountId: string,
): Promise<Stripe.Account> {
  return getStripe().accounts.retrieve(accountId);
}

interface CheckoutSessionParams {
  accountId: string;
  amount: number;
  description: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export async function createCheckoutSession(
  params: CheckoutSessionParams,
): Promise<Stripe.Checkout.Session> {
  const platformFeePercent = Number(process.env.STRIPE_PLATFORM_FEE_PERCENT) || 2.5;
  const applicationFeeAmount = Math.round(params.amount * (platformFeePercent / 100));

  return getStripe().checkout.sessions.create(
    {
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: params.description,
            },
            unit_amount: params.amount, // Amount in pence
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: applicationFeeAmount,
      },
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: params.metadata || {},
    },
    {
      stripeAccount: params.accountId,
    },
  );
}

interface InvoiceParams {
  accountId: string;
  customerId: string;
  amount: number;
  description: string;
}

export async function createInvoice(
  params: InvoiceParams,
): Promise<Stripe.Invoice> {
  await getStripe().invoiceItems.create(
    {
      customer: params.customerId,
      amount: params.amount, // Amount in pence
      currency: 'gbp',
      description: params.description,
    },
    { stripeAccount: params.accountId },
  );

  const invoice = await getStripe().invoices.create(
    {
      customer: params.customerId,
      collection_method: 'send_invoice',
      days_until_due: 30,
      auto_advance: true,
    },
    { stripeAccount: params.accountId },
  );

  await getStripe().invoices.sendInvoice(invoice.id, {
    stripeAccount: params.accountId,
  });

  return invoice;
}

export async function processRefund(
  paymentIntentId: string,
  amount?: number,
): Promise<Stripe.Refund> {
  return getStripe().refunds.create({
    payment_intent: paymentIntentId,
    ...(amount && { amount }),
  });
}

export async function generateDashboardLink(
  accountId: string,
): Promise<Stripe.LoginLink> {
  return getStripe().accounts.createLoginLink(accountId);
}
