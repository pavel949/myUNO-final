import { describe, it, expect, vi } from 'vitest';
import { createOpnProvider, OpnApiError, OpnConfigurationError, type OpnTransport } from './opn';

/**
 * This directory once shipped a Stripe adapter with no SDK behind it, which
 * fabricated confirmations for a hardcoded amount. A deployment configured for
 * real payments would have taken fake ones and reported success.
 *
 * These tests exist to make that impossible to repeat quietly. They exercise
 * the two things that decide whether money is real: **what we send Opn** and
 * **what we conclude from what Opn sends back**.
 *
 * They do not prove the adapter works against a live account — no keys exist
 * yet. That smoke test is a separate, recorded step.
 */

const SECRET = 'skey_test_abc123';

function stub(responses: { status: number; body: unknown }[]): {
  transport: OpnTransport;
  calls: { path: string; method: string; headers: Record<string, string>; body?: string }[];
} {
  const calls: { path: string; method: string; headers: Record<string, string>; body?: string }[] = [];
  let index = 0;

  const transport: OpnTransport = async (path, init) => {
    calls.push({ path, method: init.method, headers: init.headers, body: init.body });
    const response = responses[Math.min(index, responses.length - 1)];
    index += 1;
    return { status: response.status, json: async () => response.body };
  };

  return { transport, calls };
}

const charge = (overrides: Record<string, unknown> = {}) => ({
  id: 'chrg_test_1',
  object: 'charge',
  amount: 450000,
  currency: 'thb',
  status: 'successful',
  paid: true,
  authorized: true,
  authorize_uri: 'https://pay.opn.ooo/chrg_test_1',
  created_at: '2026-08-24T04:00:00Z',
  ...overrides,
});

describe('the Opn adapter refuses to exist without a key', () => {
  it('throws rather than being constructed keyless', () => {
    expect(() => createOpnProvider({ secretKey: '' })).toThrow(OpnConfigurationError);
  });
});

describe('what we send Opn', () => {
  it('authenticates with the secret key as the username and an empty password', async () => {
    const { transport, calls } = stub([{ status: 200, body: charge() }]);
    const provider = createOpnProvider({ secretKey: SECRET, transport });

    await provider.createCheckout({
      bookingId: 'b-1',
      amount: 450000,
      guestEmail: 'a@example.com',
      guestName: 'Anna',
      returnUrl: 'https://myuno.example/return',
      cancelUrl: 'https://myuno.example/cancel',
    });

    const expected = `Basic ${Buffer.from(`${SECRET}:`).toString('base64')}`;
    expect(calls[0].headers.Authorization).toBe(expected);
  });

  it('pins the API version, so a change at Opn cannot silently reshape a charge', async () => {
    const { transport, calls } = stub([{ status: 200, body: charge() }]);
    const provider = createOpnProvider({ secretKey: SECRET, transport });

    await provider.createCheckout({
      bookingId: 'b-1',
      amount: 450000,
      guestEmail: 'a@example.com',
      guestName: 'Anna',
      returnUrl: 'https://myuno.example/return',
      cancelUrl: 'https://myuno.example/cancel',
    });

    expect(calls[0].headers['Omise-Version']).toBeTruthy();
  });

  it('sends satang straight through, with no arithmetic to lose a factor of a hundred in', async () => {
    // Opn's smallest-unit convention is ours. ฿4,500.00 is 450000 both sides.
    const { transport, calls } = stub([{ status: 200, body: charge() }]);
    const provider = createOpnProvider({ secretKey: SECRET, transport });

    await provider.createCheckout({
      bookingId: 'b-1',
      amount: 450000,
      guestEmail: 'a@example.com',
      guestName: 'Anna',
      returnUrl: 'https://myuno.example/return',
      cancelUrl: 'https://myuno.example/cancel',
    });

    const body = new URLSearchParams(calls[0].body);
    expect(body.get('amount')).toBe('450000');
    expect(body.get('currency')).toBe('thb');
  });

  it('carries the booking id in metadata, so a charge can be traced back', async () => {
    const { transport, calls } = stub([{ status: 200, body: charge() }]);
    const provider = createOpnProvider({ secretKey: SECRET, transport });

    await provider.createCheckout({
      bookingId: 'b-42',
      amount: 450000,
      guestEmail: 'a@example.com',
      guestName: 'Anna',
      returnUrl: 'https://myuno.example/return',
      cancelUrl: 'https://myuno.example/cancel',
    });

    expect(new URLSearchParams(calls[0].body).get('metadata[bookingId]')).toBe('b-42');
  });

  it('refuses a zero or negative charge before it reaches the network', async () => {
    const { transport } = stub([{ status: 200, body: charge() }]);
    const provider = createOpnProvider({ secretKey: SECRET, transport });

    await expect(
      provider.createCheckout({
        bookingId: 'b-1',
        amount: 0,
        guestEmail: 'a@example.com',
        guestName: 'Anna',
        returnUrl: 'https://myuno.example/return',
        cancelUrl: 'https://myuno.example/cancel',
      })
    ).rejects.toThrow(/positive amount/i);
  });
});

describe('what we conclude from what Opn sends back', () => {
  it('confirms only when the charge says it was paid', async () => {
    const { transport } = stub([{ status: 200, body: charge({ paid: true }) }]);
    const provider = createOpnProvider({ secretKey: SECRET, transport });

    const confirmation = await provider.confirmPayment('chrg_test_1');

    expect(confirmation.status).toBe('confirmed');
    expect(confirmation.amount).toBe(450000);
    expect(confirmation.chargeId).toBe('chrg_test_1');
  });

  it('does NOT confirm an authorized-but-uncaptured charge', async () => {
    // This is the trap. `status: successful` with `paid: false` is a hold, not
    // a payment — confirming it would hand over a stay nobody has been charged
    // for. `paid` is the only field that means the money moved.
    const { transport } = stub([
      { status: 200, body: charge({ status: 'successful', authorized: true, paid: false }) },
    ]);
    const provider = createOpnProvider({ secretKey: SECRET, transport });

    expect((await provider.confirmPayment('chrg_test_1')).status).toBe('failed');
  });

  it('does not confirm a failed charge', async () => {
    const { transport } = stub([
      {
        status: 200,
        body: charge({ status: 'failed', paid: false, failure_code: 'insufficient_fund' }),
      },
    ]);
    const provider = createOpnProvider({ secretKey: SECRET, transport });

    expect((await provider.confirmPayment('chrg_test_1')).status).toBe('failed');
  });

  it('treats an error body as an error even when the status code is 200', async () => {
    // Opn does not always pair an error object with a non-2xx status. Checking
    // the status alone would let an error through dressed as a charge.
    const { transport } = stub([
      {
        status: 200,
        body: { object: 'error', code: 'invalid_charge', message: 'Amount is too low' },
      },
    ]);
    const provider = createOpnProvider({ secretKey: SECRET, transport });

    await expect(provider.confirmPayment('chrg_test_1')).rejects.toThrow(OpnApiError);
  });

  it('refuses a checkout with nowhere to send the payer', async () => {
    const { transport } = stub([{ status: 200, body: charge({ authorize_uri: null, paid: false }) }]);
    const provider = createOpnProvider({ secretKey: SECRET, transport });

    await expect(
      provider.createCheckout({
        bookingId: 'b-1',
        amount: 450000,
        guestEmail: 'a@example.com',
        guestName: 'Anna',
        returnUrl: 'https://myuno.example/return',
        cancelUrl: 'https://myuno.example/cancel',
      })
    ).rejects.toThrow(/authorize_uri/);
  });
});

describe('refunds', () => {
  it('post the amount in satang against the charge', async () => {
    const { transport, calls } = stub([
      { status: 200, body: { id: 'rfnd_1', object: 'refund', amount: 120000 } },
    ]);
    const provider = createOpnProvider({ secretKey: SECRET, transport });

    const result = await provider.refund({
      chargeId: 'chrg_test_1',
      amount: 120000,
      reason: 'Guest cancelled within policy',
    });

    expect(calls[0].path).toBe('/charges/chrg_test_1/refunds');
    expect(new URLSearchParams(calls[0].body).get('amount')).toBe('120000');
    expect(result.status).toBe('completed');
    expect(result.amount).toBe(120000);
  });

  it('report a voided refund as failed rather than as done', async () => {
    const { transport } = stub([
      { status: 200, body: { id: 'rfnd_1', object: 'refund', amount: 120000, voided: true } },
    ]);
    const provider = createOpnProvider({ secretKey: SECRET, transport });

    const result = await provider.refund({ chargeId: 'chrg_1', amount: 120000, reason: 'x' });
    expect(result.status).toBe('failed');
  });
});

describe('webhooks', () => {
  it('refuse to validate a signature Opn never sends', async () => {
    // The old Stripe adapter returned `true` here unconditionally, which
    // accepted any request that reached the endpoint. Opn does not sign webhook
    // bodies at all, so the only honest answer is to refuse and point at the
    // check that works.
    const { transport } = stub([{ status: 200, body: charge() }]);
    const provider = createOpnProvider({ secretKey: SECRET, transport });

    expect(() => provider.verifyWebhookSignature('sig', '{}')).toThrow(OpnConfigurationError);
  });

  it('are verified by re-fetching the event from the API', async () => {
    const { transport, calls } = stub([
      { status: 200, body: { id: 'evnt_1', object: 'event', key: 'charge.complete' } },
    ]);
    const provider = createOpnProvider({ secretKey: SECRET, transport });

    await provider.fetchEvent('evnt_1');

    expect(calls[0].path).toBe('/events/evnt_1');
    expect(calls[0].method).toBe('GET');
  });
});

describe('the seam still fails closed', () => {
  it('never falls back to the mock when Opn is asked for without a key', async () => {
    vi.resetModules();
    const previous = { ...process.env };
    process.env.PAYMENT_PROVIDER = 'opn';
    delete process.env.OMISE_SECRET_KEY;

    const { getPaymentProvider, PaymentProviderUnavailableError } = await import('./index');
    expect(() => getPaymentProvider()).toThrow(PaymentProviderUnavailableError);

    process.env = previous;
  });

  it('refuses a live key outside production, so a test booking cannot become a real charge', async () => {
    vi.resetModules();
    const previous = { ...process.env };
    process.env.PAYMENT_PROVIDER = 'opn';
    process.env.OMISE_SECRET_KEY = 'skey_live_realmoney';

    const { getPaymentProvider } = await import('./index');
    expect(() => getPaymentProvider()).toThrow(/live Opn key/i);

    process.env = previous;
  });

  it('builds the adapter when a test key is present', async () => {
    vi.resetModules();
    const previous = { ...process.env };
    process.env.PAYMENT_PROVIDER = 'opn';
    process.env.OMISE_SECRET_KEY = SECRET;

    const { getPaymentProvider } = await import('./index');
    const provider = getPaymentProvider();
    expect(typeof provider.createCheckout).toBe('function');

    process.env = previous;
  });
});
