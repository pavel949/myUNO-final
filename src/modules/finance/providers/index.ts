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
import { createOpnProvider } from './opn';

/** Providers with a real implementation. Add to this only with the real rail. */
const IMPLEMENTED_PROVIDERS = ['mock', 'opn'] as const;

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

  if (requested === 'opn') {
    const secretKey = process.env.OMISE_SECRET_KEY;
    if (!secretKey) {
      // Falling back to the mock here would be the original sin of this file:
      // a deployment asking for real payments and quietly getting fake ones.
      throw new PaymentProviderUnavailableError(
        'PAYMENT_PROVIDER is "opn" but OMISE_SECRET_KEY is not set. Refusing to fall back to the mock — that would take fake payments and report success.'
      );
    }

    // A live key in a non-production environment is how a test booking becomes
    // a real charge on somebody's card. The key names its own mode, so this is
    // checkable rather than a matter of care.
    const isLiveKey = secretKey.startsWith('skey_live_');
    if (isLiveKey && process.env.NODE_ENV !== 'production') {
      throw new PaymentProviderUnavailableError(
        'A live Opn key is configured outside production. Use a test key (skey_test_…) anywhere that is not production.'
      );
    }

    return createOpnProvider({ secretKey });
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
    // Opn only. The Stripe fallbacks that used to sit here were left over from
    // the fabricating adapter this file replaced, and a half-configured Stripe
    // key silently satisfying an Opn deployment is exactly the kind of quiet
    // mismatch that ends in a payment nobody can trace.
    publicKey: process.env.OMISE_PUBLIC_KEY,
    secretKey: process.env.OMISE_SECRET_KEY,
    webhookSecret: process.env.OMISE_WEBHOOK_SECRET,
    testMode: process.env.NODE_ENV !== 'production',
  };
}

export type { PaymentProvider, CheckoutSession, PaymentConfirmation, RefundResult } from './types';
export { createOpnProvider, OpnConfigurationError, OpnApiError } from './opn';
