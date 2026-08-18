/**
 * Payment provider seam.
 *
 * Loop one charges cash (doc 10). The only non-cash rail is the local mock
 * checkout page, which records a payment without moving money — fine for
 * development and demos, catastrophic if it ever runs in production.
 *
 * This file used to ship a Stripe adapter and silent fallbacks. Both were
 * hazards rather than features: the adapter fabricated confirmations
 * (`amount: 50000`, a hardcoded charge id) without any SDK installed, and
 * asking for an unimplemented provider — `omise`, the one CLAUDE.md names as
 * the default — quietly returned the mock instead. A deployment configured for
 * real payments would have taken fake ones and reported success.
 *
 * The rule now: **the seam fails closed.** A provider that is not implemented
 * throws. The mock refuses to load in production. Nothing here can ever assert
 * that money arrived when it did not.
 */

import { PaymentProvider, ProviderConfig } from './types';

/** Providers with a real implementation. Add to this only with the real rail. */
const IMPLEMENTED_PROVIDERS = ['mock'] as const;

export class PaymentProviderUnavailableError extends Error {
  readonly code = 'PAYMENT_PROVIDER_UNAVAILABLE';
  constructor(message: string) {
    super(message);
    this.name = 'PaymentProviderUnavailableError';
  }
}

/**
 * The local development rail. It does not talk to a payment network, so it can
 * only ever be honest about that: it says a session was created, and it refuses
 * to answer questions that only a real provider can answer.
 */
const mockProvider: PaymentProvider = {
  async createCheckout(params) {
    return {
      id: `mock_${params.bookingId}`,
      url: `/checkout/${params.bookingId}`,
      status: 'pending',
      amount: params.amount,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    };
  },

  async confirmPayment() {
    // The old mock returned a fabricated confirmation for a hardcoded 500 THB.
    // Confirmation is settled against our own Payment row in
    // finance.verifyAndConfirm; a mock must never be the thing that says paid.
    throw new PaymentProviderUnavailableError(
      'The mock provider cannot confirm a payment. Confirmation goes through finance.verifyAndConfirm against the stored Payment row.'
    );
  },

  async refund() {
    throw new PaymentProviderUnavailableError(
      'The mock provider cannot refund. Loop one refunds cash — see finance.recordCashRefund.'
    );
  },

  verifyWebhookSignature() {
    // Returning true here was the P0: it accepted any signature, including when
    // a webhook secret was configured. There is no webhook route in loop one,
    // and a rail that cannot verify must not claim it did.
    throw new PaymentProviderUnavailableError(
      'No payment provider is configured, so no webhook signature can be verified. Refuse the request.'
    );
  },
};

/**
 * The active payment provider.
 *
 * Throws rather than degrading: an unimplemented provider is a misconfiguration,
 * and the mock is refused in production so a missing PAYMENT_PROVIDER can never
 * silently become "pretend the money arrived".
 */
export function getPaymentProvider(): PaymentProvider {
  const requested = process.env.PAYMENT_PROVIDER || 'mock';

  if (!IMPLEMENTED_PROVIDERS.includes(requested as (typeof IMPLEMENTED_PROVIDERS)[number])) {
    throw new PaymentProviderUnavailableError(
      `Payment provider "${requested}" is not implemented. Implemented: ${IMPLEMENTED_PROVIDERS.join(', ')}. Loop one charges cash (doc 10); wire a real adapter before selecting one.`
    );
  }

  if (process.env.NODE_ENV === 'production') {
    throw new PaymentProviderUnavailableError(
      'The mock payment provider must never run in production — it records payments without taking money. Charge cash, or wire a real provider.'
    );
  }

  return mockProvider;
}

/** Provider configuration from the environment. Secrets are never logged. */
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
