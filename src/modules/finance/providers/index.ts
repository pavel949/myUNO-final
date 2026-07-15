/**
 * Payment provider factory.
 * Returns the active payment provider based on config.
 * Swap providers by changing PAYMENT_PROVIDER env var.
 */

import { PaymentProvider, ProviderConfig } from './types';
import { stripeProvider } from './stripe';

// Mock provider for development
const mockProvider: PaymentProvider = {
  async createCheckout(params) {
    console.log('[Mock] Creating checkout session');
    return {
      id: `mock_${Date.now()}`,
      url: `/checkout/${params.bookingId}`, // Renders local checkout page
      status: 'pending',
      amount: params.amount,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    };
  },

  async confirmPayment(sessionId) {
    console.log('[Mock] Confirming payment:', sessionId);
    return {
      chargeId: `mock_charge_${Date.now()}`,
      amount: 50000,
      currency: 'THB',
      status: 'confirmed',
      confirmedAt: new Date(),
    };
  },

  async refund(params) {
    console.log('[Mock] Refunding:', params.chargeId);
    return {
      refundId: `mock_refund_${Date.now()}`,
      amount: params.amount,
      status: 'completed',
    };
  },

  verifyWebhookSignature(_signature, _body) {
    return true; // Mock always accepts
  },
};

/**
 * Get the active payment provider.
 * PAYMENT_PROVIDER env var selects which provider to use.
 * Default: 'mock' (safe for development).
 *
 * Options:
 * - 'mock': In-memory/local checkout page (loop 1, cash-first)
 * - 'stripe': Stripe Checkout Sessions (loop 2, card payments)
 * - 'omise': Omise hosted checkout (loop 2, Thailand-focused)
 * - 'yandex-kassa': Yandex.Kassa (Russian support)
 */
export function getPaymentProvider(): PaymentProvider {
  const provider = process.env.PAYMENT_PROVIDER || 'mock';

  switch (provider) {
    case 'stripe':
      return stripeProvider;
    case 'omise':
      // const omiseProvider = new OmiseProvider();
      // return omiseProvider;
      console.warn('Omise provider not yet implemented; falling back to mock');
      return mockProvider;
    case 'yandex-kassa':
      console.warn('Yandex.Kassa provider not yet implemented; falling back to mock');
      return mockProvider;
    case 'mock':
    default:
      return mockProvider;
  }
}

/**
 * Get provider configuration from environment.
 */
export function getProviderConfig(): ProviderConfig {
  const provider = (process.env.PAYMENT_PROVIDER || 'mock') as ProviderConfig['provider'];

  return {
    provider,
    publicKey: process.env.STRIPE_PUBLISHABLE_KEY || process.env.OMISE_PUBLIC_KEY,
    secretKey: process.env.STRIPE_SECRET_KEY || process.env.OMISE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || process.env.OMISE_WEBHOOK_SECRET,
    testMode: process.env.NODE_ENV !== 'production',
  };
}

export type { PaymentProvider, CheckoutSession, PaymentConfirmation, RefundResult } from './types';
