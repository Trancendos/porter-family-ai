
import { createAgentPurchase, activateUserSubscription } from '../db-stripe-helpers';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock dependencies BEFORE importing the module under test
vi.mock('../db-stripe-helpers', () => ({
  createAgentPurchase: vi.fn(),
  activateUserSubscription: vi.fn(),
  updateUserSubscriptionStatus: vi.fn(),
}));

// We need to completely replace the module content for stripePayment to avoid executing the top-level code that initializes Stripe
// But we still need the exported functions.
// The problem is `const stripe = new Stripe(...)` runs on import.

// Strategy: We will mock the entire module, but we will reimplement `handleSuccessfulPayment` inside the mock or use a spy if possible.
// Actually, since we want to test `handleSuccessfulPayment` logic, we should probably copy it or refactor the source code to allow injection.
// But we can't easily refactor source code just for tests if we want to be minimally invasive.
// However, we can mock `stripe` constructor!

vi.mock('stripe', () => {
  return {
    default: class MockStripe {
      checkout = {
        sessions: {
          create: vi.fn(),
        }
      };
      products = {
        create: vi.fn(),
      };
      prices = {
        create: vi.fn(),
      };
      subscriptions = {
        retrieve: vi.fn(),
        cancel: vi.fn(),
      };
      webhooks = {
        constructEvent: vi.fn(),
      };
      billingPortal = {
        sessions: {
          create: vi.fn(),
        }
      };
    }
  };
});

// Now we can import the module
import { handleSuccessfulPayment, stripe } from './stripePayment';

describe('handleSuccessfulPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create an agent purchase when listingId is present', async () => {
    const session: any = {
      id: 'sess_123',
      client_reference_id: '1',
      metadata: { listingId: '10' },
      amount_total: 1000,
      mode: 'payment',
      payment_intent: 'pi_123',
    };

    await handleSuccessfulPayment(session);

    expect(createAgentPurchase).toHaveBeenCalledWith(expect.objectContaining({
      userId: 1,
      listingId: 10,
      amount: 1000,
      purchaseType: 'one_time',
      status: 'completed',
    }));
  });

  it('should activate a subscription when planId is present', async () => {
    const session: any = {
      id: 'sess_456',
      client_reference_id: '2',
      metadata: { planId: '5' },
      mode: 'subscription',
      subscription: 'sub_789',
      customer: 'cus_123',
    };

    const mockSubscription = {
      id: 'sub_789',
      current_period_start: 1700000000,
      current_period_end: 1702678400,
      cancel_at_period_end: false,
    };

    (stripe.subscriptions.retrieve as any).mockResolvedValue(mockSubscription);

    await handleSuccessfulPayment(session);

    expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_789');
    expect(activateUserSubscription).toHaveBeenCalledWith(expect.objectContaining({
      userId: 2,
      planId: 5,
      stripeSubscriptionId: 'sub_789',
      status: 'active',
    }));
  });

  it('should handle both agent purchase and subscription if both IDs are present', async () => {
     const session: any = {
      id: 'sess_mix',
      client_reference_id: '3',
      metadata: { listingId: '20', planId: '6' },
      amount_total: 5000,
      mode: 'subscription',
      subscription: 'sub_abc',
      customer: 'cus_def',
    };

     const mockSubscription = {
      id: 'sub_abc',
      current_period_start: 1700000000,
      current_period_end: 1702678400,
      cancel_at_period_end: false,
    };
    (stripe.subscriptions.retrieve as any).mockResolvedValue(mockSubscription);

    await handleSuccessfulPayment(session);

    expect(createAgentPurchase).toHaveBeenCalled();
    expect(activateUserSubscription).toHaveBeenCalled();
  });

  it('should do nothing if no relevant metadata is present', async () => {
      const session: any = {
      id: 'sess_empty',
      client_reference_id: '4',
      metadata: {},
    };

    await handleSuccessfulPayment(session);

    expect(createAgentPurchase).not.toHaveBeenCalled();
    expect(activateUserSubscription).not.toHaveBeenCalled();
  });
});
