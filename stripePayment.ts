import Stripe from 'stripe';
/**
 * Stripe Payment Service
 * 
 * Handles payment processing for:
 * - Agent Marketplace purchases (one-time payments)
 * - Mercury Trading subscriptions (monthly/annual)
 * - Custom pricing plans
 */

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-11-17.clover',
});

export interface CreateCheckoutSessionParams {
  userId: number;
  userEmail: string;
  items: {
    name: string;
    description?: string;
    amount: number; // in cents
    quantity: number;
    metadata?: Record<string, string>;
  }[];
  successUrl: string;
  cancelUrl: string;
  mode: 'payment' | 'subscription';
  metadata?: Record<string, string>;
}

export interface CreateSubscriptionParams {
  userId: number;
  userEmail: string;
  priceId: string; // Stripe Price ID
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

/**
 * Create a Stripe Checkout session for one-time payments
 */
export async function createCheckoutSession(params: CreateCheckoutSessionParams): Promise<Stripe.Checkout.Session> {
  try {
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = params.items.map((item) => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.name,
          description: item.description,
          metadata: item.metadata,
        },
        unit_amount: item.amount,
      },
      quantity: item.quantity,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: params.mode,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      customer_email: params.userEmail,
      client_reference_id: params.userId.toString(),
      metadata: {
        userId: params.userId.toString(),
        ...params.metadata,
      },
    });

    return session;
  } catch (error) {
    console.error('Stripe checkout session error:', error);
    throw error;
  }
}

/**
 * Create a Stripe Checkout session for subscriptions
 */
export async function createSubscriptionCheckout(params: CreateSubscriptionParams): Promise<Stripe.Checkout.Session> {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: params.priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      customer_email: params.userEmail,
      client_reference_id: params.userId.toString(),
      metadata: {
        userId: params.userId.toString(),
        ...params.metadata,
      },
    });

    return session;
  } catch (error) {
    console.error('Stripe subscription checkout error:', error);
    throw error;
  }
}

/**
 * Create a Stripe product (for Agent Marketplace listings)
 */
export async function createProduct(params: {
  name: string;
  description?: string;
  price: number; // in cents
  metadata?: Record<string, string>;
}): Promise<{ productId: string; priceId: string }> {
  try {
    // Create product
    const product = await stripe.products.create({
      name: params.name,
      description: params.description,
      metadata: params.metadata,
    });

    // Create price
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: params.price,
      currency: 'usd',
    });

    return {
      productId: product.id,
      priceId: price.id,
    };
  } catch (error) {
    console.error('Stripe product creation error:', error);
    throw error;
  }
}

/**
 * Create a subscription plan (for Mercury Trading)
 */
export async function createSubscriptionPlan(params: {
  name: string;
  description?: string;
  price: number; // in cents
  interval: 'month' | 'year';
  metadata?: Record<string, string>;
}): Promise<{ productId: string; priceId: string }> {
  try {
    // Create product
    const product = await stripe.products.create({
      name: params.name,
      description: params.description,
      metadata: params.metadata,
    });

    // Create recurring price
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: params.price,
      currency: 'usd',
      recurring: {
        interval: params.interval,
      },
    });

    return {
      productId: product.id,
      priceId: price.id,
    };
  } catch (error) {
    console.error('Stripe subscription plan creation error:', error);
    throw error;
  }
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(payload: string | Buffer, signature: string, secret: string): Stripe.Event {
  try {
    return stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    throw error;
  }
}

/**
 * Handle successful payment
 */
export async function handleSuccessfulPayment(session: Stripe.Checkout.Session): Promise<void> {
  try {
    const userId = parseInt(session.client_reference_id || '0');
    const metadata = session.metadata || {};

    console.log('Payment successful:', {
      userId,
      sessionId: session.id,
      amount: session.amount_total,
      metadata,
    });

    // TODO: Update database with purchase record
    // - For Agent Marketplace: create agentPurchases record
    // - For Mercury Trading: activate subscription
  } catch (error) {
    console.error('Handle successful payment error:', error);
    throw error;
  }
}

/**
 * Handle failed payment
 */
export async function handleFailedPayment(session: Stripe.Checkout.Session): Promise<void> {
  try {
    const userId = parseInt(session.client_reference_id || '0');
    
    console.log('Payment failed:', {
      userId,
      sessionId: session.id,
    });

    // TODO: Notify user of payment failure
  } catch (error) {
    console.error('Handle failed payment error:', error);
    throw error;
  }
}

/**
 * Get customer portal URL (for subscription management)
 */
export async function createCustomerPortalSession(customerId: string, returnUrl: string): Promise<string> {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return session.url;
  } catch (error) {
    console.error('Customer portal session error:', error);
    throw error;
  }
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  try {
    return await stripe.subscriptions.cancel(subscriptionId);
  } catch (error) {
    console.error('Cancel subscription error:', error);
    throw error;
  }
}

/**
 * Get subscription details
 */
export async function getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  try {
    return await stripe.subscriptions.retrieve(subscriptionId);
  } catch (error) {
    console.error('Get subscription error:', error);
    throw error;
  }
}

export { stripe };
