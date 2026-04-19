import Stripe from "stripe";

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-11-17.clover",
  typescript: true,
});

/**
 * Stripe Service Layer
 * Handles all Stripe API interactions for payments and subscriptions
 */

// ============================================================================
// PRODUCTS
// ============================================================================

export async function createProduct(params: {
  name: string;
  description?: string;
  price: number;
  currency?: string;
  image?: string;
}) {
  const product = await stripe.products.create({
    name: params.name,
    description: params.description,
    images: params.image ? [params.image] : undefined,
  });

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: Math.round(params.price * 100), // Convert to cents
    currency: params.currency || "usd",
  });

  return { product, price };
}

export async function listProducts() {
  const products = await stripe.products.list({ active: true });
  const prices = await stripe.prices.list({ active: true });

  return products.data.map((product) => {
    const price = prices.data.find((p) => p.product === product.id);
    return {
      ...product,
      price: price
        ? {
            id: price.id,
            amount: price.unit_amount ? price.unit_amount / 100 : 0,
            currency: price.currency,
          }
        : null,
    };
  });
}

// ============================================================================
// SUBSCRIPTION PLANS
// ============================================================================

export async function createSubscriptionPlan(params: {
  name: string;
  description?: string;
  price: number;
  currency?: string;
  interval: "month" | "year";
  intervalCount?: number;
  trialDays?: number;
  features?: string[];
}) {
  const product = await stripe.products.create({
    name: params.name,
    description: params.description,
    metadata: {
      features: JSON.stringify(params.features || []),
    },
  });

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: Math.round(params.price * 100),
    currency: params.currency || "usd",
    recurring: {
      interval: params.interval,
      interval_count: params.intervalCount || 1,
      trial_period_days: params.trialDays,
    },
  });

  return { product, price };
}

export async function listSubscriptionPlans() {
  const prices = await stripe.prices.list({
    active: true,
    type: "recurring",
    expand: ["data.product"],
  });

  return prices.data.map((price) => {
    const product = price.product as Stripe.Product;
    return {
      priceId: price.id,
      productId: product.id,
      name: product.name,
      description: product.description,
      price: price.unit_amount ? price.unit_amount / 100 : 0,
      currency: price.currency,
      interval: price.recurring?.interval || "month",
      intervalCount: price.recurring?.interval_count || 1,
      trialDays: price.recurring?.trial_period_days || 0,
      features: product.metadata.features
        ? JSON.parse(product.metadata.features)
        : [],
    };
  });
}

// ============================================================================
// CUSTOMERS
// ============================================================================

export async function createCustomer(params: {
  email: string;
  name?: string;
  userId: number;
}) {
  const customer = await stripe.customers.create({
    email: params.email,
    name: params.name,
    metadata: {
      userId: params.userId.toString(),
    },
  });

  return customer;
}

export async function getCustomer(stripeCustomerId: string) {
  return await stripe.customers.retrieve(stripeCustomerId);
}

// ============================================================================
// CHECKOUT SESSIONS
// ============================================================================

export async function createCheckoutSession(params: {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  mode: "payment" | "subscription";
  metadata?: Record<string, string>;
}) {
  const session = await stripe.checkout.sessions.create({
    customer: params.customerId,
    line_items: [
      {
        price: params.priceId,
        quantity: 1,
      },
    ],
    mode: params.mode,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: params.metadata,
  });

  return session;
}

// ============================================================================
// SUBSCRIPTIONS
// ============================================================================

export async function createSubscription(params: {
  customerId: string;
  priceId: string;
  trialDays?: number;
}) {
  const subscription = await stripe.subscriptions.create({
    customer: params.customerId,
    items: [{ price: params.priceId }],
    trial_period_days: params.trialDays,
  });

  return subscription;
}

export async function getSubscription(subscriptionId: string) {
  return await stripe.subscriptions.retrieve(subscriptionId);
}

export async function cancelSubscription(subscriptionId: string, atPeriodEnd = true) {
  if (atPeriodEnd) {
    return await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  } else {
    return await stripe.subscriptions.cancel(subscriptionId);
  }
}

export async function listCustomerSubscriptions(customerId: string) {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
  });

  return subscriptions.data;
}

// ============================================================================
// PAYMENT INTENTS
// ============================================================================

export async function createPaymentIntent(params: {
  amount: number;
  currency?: string;
  customerId: string;
  description?: string;
  metadata?: Record<string, string>;
}) {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(params.amount * 100),
    currency: params.currency || "usd",
    customer: params.customerId,
    description: params.description,
    metadata: params.metadata,
    automatic_payment_methods: {
      enabled: true,
    },
  });

  return paymentIntent;
}

// ============================================================================
// INVOICES
// ============================================================================

export async function listCustomerInvoices(customerId: string) {
  const invoices = await stripe.invoices.list({
    customer: customerId,
  });

  return invoices.data;
}

export async function getInvoice(invoiceId: string) {
  return await stripe.invoices.retrieve(invoiceId);
}

// ============================================================================
// CUSTOMER PORTAL
// ============================================================================

export async function createCustomerPortalSession(params: {
  customerId: string;
  returnUrl: string;
}) {
  const session = await stripe.billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl,
  });

  return session;
}

// ============================================================================
// WEBHOOKS
// ============================================================================

export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
  secret: string
) {
  return stripe.webhooks.constructEvent(payload, signature, secret);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount);
}

export { stripe };
