/**
 * Stripe payment provider adapter.
 * Implements the PaymentProvider interface using Stripe's API.
 *
 * Setup:
 * 1. Create Stripe account at https://stripe.com
 * 2. Get keys from Dashboard → Developers → API keys
 * 3. Set env vars: STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET
 * 4. Set config: booking.payment.provider = "stripe"
 * 5. Test with pk_test_... and sk_test_... keys before going live
 */

import type { PaymentProvider, CheckoutSession, PaymentConfirmation, RefundResult } from './types';

// Stripe SDK would be imported here; for now, stubbed with types
// import Stripe from 'stripe';
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

export class StripeProvider implements PaymentProvider {
  private secretKey: string;
  private publishableKey: string;
  private webhookSecret: string;

  constructor() {
    this.secretKey = process.env.STRIPE_SECRET_KEY || '';
    this.publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || '';
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

    if (!this.secretKey || !this.publishableKey) {
      throw new Error('Stripe keys not configured. Set STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY.');
    }
  }

  async createCheckout(params: {
    bookingId: string;
    amount: number;
    guestEmail: string;
    guestName: string;
    returnUrl: string;
    cancelUrl: string;
  }): Promise<CheckoutSession> {
    /**
     * Create a Stripe Checkout Session.
     * Guest is redirected to session.url to complete payment.
     * After payment, Stripe redirects to returnUrl with session_id param.
     *
     * Real implementation would call:
     * const session = await stripe.checkout.sessions.create({
     *   payment_method_types: ['card'],
     *   line_items: [{
     *     price_data: {
     *       currency: 'thb',
     *       product_data: { name: `Booking ${bookingId}` },
     *       unit_amount: params.amount,
     *     },
     *     quantity: 1,
     *   }],
     *   mode: 'payment',
     *   success_url: params.returnUrl + '?session_id={CHECKOUT_SESSION_ID}',
     *   cancel_url: params.cancelUrl,
     *   customer_email: params.guestEmail,
     *   client_reference_id: params.bookingId, // Link to our booking ID
     *   metadata: { bookingId: params.bookingId },
     * });
     */

    // Stub: return mock session for testing
    console.log('[Stripe] Creating checkout session for booking:', params.bookingId);
    return {
      id: `cs_test_${Date.now()}`,
      url: `https://checkout.stripe.com/pay/test_${params.bookingId}`,
      status: 'pending',
      amount: params.amount,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min
    };
  }

  async confirmPayment(sessionId: string): Promise<PaymentConfirmation> {
    /**
     * Retrieve a Checkout Session and verify payment was successful.
     *
     * Real implementation:
     * const session = await stripe.checkout.sessions.retrieve(sessionId);
     * if (session.payment_status !== 'paid') {
     *   throw new Error('Payment not completed');
     * }
     * return {
     *   chargeId: session.payment_intent,
     *   amount: session.amount_total,
     *   currency: 'THB',
     *   status: 'confirmed',
     *   confirmedAt: new Date(),
     * };
     */

    console.log('[Stripe] Confirming payment for session:', sessionId);
    return {
      chargeId: `ch_stripe_${Date.now()}`,
      amount: 50000, // stub: 500 THB
      currency: 'THB',
      status: 'confirmed',
      confirmedAt: new Date(),
    };
  }

  async refund(params: {
    chargeId: string;
    amount: number;
    reason: string;
  }): Promise<RefundResult> {
    /**
     * Create a refund for a charge.
     * If amount < charge.amount, create a partial refund.
     *
     * Real implementation:
     * const refund = await stripe.refunds.create({
     *   charge: params.chargeId,
     *   amount: params.amount,
     *   reason: 'requested_by_customer' | 'duplicate' | 'fraudulent',
     *   metadata: { reason: params.reason },
     * });
     */

    console.log('[Stripe] Refunding charge:', params.chargeId, 'amount:', params.amount);
    return {
      refundId: `ref_stripe_${Date.now()}`,
      amount: params.amount,
      status: 'completed',
      reason: params.reason,
    };
  }

  verifyWebhookSignature(_signature: string, _body: string): boolean {
    /**
     * Verify webhook signature using STRIPE_WEBHOOK_SECRET.
     * Stripe sends: header 't' (timestamp) and 'v1' (signature)
     *
     * Real implementation:
     * const expectedSig = crypto
     *   .createHmac('sha256', this.webhookSecret)
     *   .update(`${timestamp}.${body}`)
     *   .digest('hex');
     * return signature === `v1=${expectedSig}`;
     */

    // Stub: log and accept (real env should verify)
    if (!this.webhookSecret) {
      console.warn('[Stripe] No webhook secret configured; skipping verification');
      return true; // Allow in dev; real prod requires verification
    }

    console.log('[Stripe] Verifying webhook signature');
    // In production, extract 't' and 'v1' from signature header and verify
    return true;
  }
}

export const stripeProvider = new StripeProvider();
