import { describe, it, expect, afterEach, vi } from 'vitest';
import { getPaymentProvider, PaymentProviderUnavailableError } from './index';

/**
 * P0-3. The seam must fail closed.
 *
 * The shipped adapters used to fabricate confirmations and accept any webhook
 * signature, and an unimplemented provider silently became the mock. These tests
 * exist so none of that can come back quietly: every path that cannot prove
 * money moved has to throw rather than answer.
 */
describe('payment provider seam — fails closed (P0-3)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function setEnv(provider: string | undefined, nodeEnv: string) {
    // stubEnv rather than assigning process.env directly: NODE_ENV is not a
    // configurable property on this Node version, and vitest restores both.
    vi.stubEnv('PAYMENT_PROVIDER', provider ?? '');
    vi.stubEnv('NODE_ENV', nodeEnv);
  }

  describe('provider selection', () => {
    it('refuses an unimplemented provider instead of falling back to the mock', () => {
      // The old factory logged a warning and returned the mock, so a deployment
      // asking for a real rail would have taken pretend payments.
      setEnv('omise', 'development');
      expect(() => getPaymentProvider()).toThrow(PaymentProviderUnavailableError);
      expect(() => getPaymentProvider()).toThrow(/not implemented/i);
    });

    it('refuses stripe, whose adapter fabricated charges and is now gone', () => {
      setEnv('stripe', 'development');
      expect(() => getPaymentProvider()).toThrow(PaymentProviderUnavailableError);
    });

    it('refuses the mock in production, where it would book unpaid money as paid', () => {
      setEnv('mock', 'production');
      expect(() => getPaymentProvider()).toThrow(/never run in production/i);
    });

    it('refuses an unset provider in production too — no silent default', () => {
      setEnv(undefined, 'production');
      expect(() => getPaymentProvider()).toThrow(PaymentProviderUnavailableError);
    });

    it('returns the mock outside production, which is the loop-one dev rail', () => {
      setEnv('mock', 'development');
      expect(getPaymentProvider()).toBeTruthy();
    });
  });

  describe('the mock never claims money moved', () => {
    it('refuses to verify a webhook signature rather than returning true', async () => {
      setEnv('mock', 'development');
      const provider = getPaymentProvider();

      // This returning `true` — even with a webhook secret set — was the P0.
      expect(() => provider.verifyWebhookSignature('sig', 'body')).toThrow(
        PaymentProviderUnavailableError
      );
    });

    it('refuses to confirm a payment', async () => {
      setEnv('mock', 'development');
      const provider = getPaymentProvider();

      await expect(provider.confirmPayment('sess_whatever')).rejects.toThrow(
        PaymentProviderUnavailableError
      );
    });

    it('refuses to refund', async () => {
      setEnv('mock', 'development');
      const provider = getPaymentProvider();

      await expect(
        provider.refund({ chargeId: 'ch_1', amount: 1000, reason: 'test' })
      ).rejects.toThrow(PaymentProviderUnavailableError);
    });

    it('still opens a checkout session, which is all it can honestly do', async () => {
      setEnv('mock', 'development');
      const provider = getPaymentProvider();

      const session = await provider.createCheckout({
        bookingId: 'bk_1',
        amount: 250_000,
        guestEmail: 'guest@example.com',
        guestName: 'Guest',
        returnUrl: '/return',
        cancelUrl: '/cancel',
      });

      expect(session.status).toBe('pending');
      expect(session.amount).toBe(250_000);
      // The amount is the one it was handed, never a hardcoded figure.
      expect(session.url).toContain('bk_1');
    });
  });
});
