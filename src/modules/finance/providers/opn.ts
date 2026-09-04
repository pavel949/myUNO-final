import {
  PaymentProvider,
  CheckoutSession,
  PaymentConfirmation,
  RefundResult,
} from './types';

/**
 * Opn Payments (formerly Omise) — the licensed Thai provider named in D6/Q8.
 *
 * ## What this is, and what it deliberately is not
 *
 * This directory once shipped a Stripe adapter with **no SDK behind it**: it
 * fabricated confirmations with a hardcoded charge id and a hardcoded amount,
 * so a deployment configured for real payments would have taken fake ones and
 * reported success. That is the mistake this file exists not to repeat.
 *
 * So: every method here talks to the real API over HTTPS, and every method that
 * cannot answer truthfully **throws instead of guessing**. Nothing returns a
 * confirmation it did not receive from Opn.
 *
 * ## Why satang needs no conversion
 *
 * Opn takes amounts in the currency's smallest unit — satang for THB — which is
 * exactly how this platform stores money (CLAUDE.md). There is no arithmetic
 * between us and them, which removes the single likeliest place to lose a
 * factor of a hundred.
 *
 * ## Webhooks are verified by re-fetching, not by a signature
 *
 * Opn does not sign webhook bodies with an HMAC the way Stripe does. The
 * documented way to establish that an event is genuine is to **retrieve it from
 * the API with your secret key** and trust the response, not the request body.
 * `verifyWebhookSignature` therefore refuses rather than returning `true` — a
 * rail that cannot verify must never claim it did. Use `fetchEvent` and act on
 * what the API says.
 *
 * ## Status: implemented, not yet exercised against a live account
 *
 * The request shaping and response mapping below are covered by tests against a
 * stubbed transport. What has **not** happened is a charge against a real Opn
 * test account, because no keys exist yet. Until that smoke test is run and
 * recorded, treat this as "written and reviewed", not "proven".
 */

const API_BASE = 'https://api.omise.co';

/** Opn pins its API shape by date; sending it stops a silent change breaking us. */
const API_VERSION = '2019-05-29';

export class OpnConfigurationError extends Error {
  readonly code = 'OPN_NOT_CONFIGURED';
  constructor(message: string) {
    super(message);
    this.name = 'OpnConfigurationError';
  }
}

export class OpnApiError extends Error {
  readonly code = 'OPN_API_ERROR';
  constructor(
    message: string,
    readonly status: number,
    readonly opnCode?: string
  ) {
    super(message);
    this.name = 'OpnApiError';
  }
}

/**
 * A charge as Opn reports it, narrowed to the fields any decision here rests on.
 * Deliberately not the whole object: fields nobody reads are fields nobody has
 * checked the meaning of.
 */
interface OpnCharge {
  id: string;
  object: 'charge';
  amount: number;
  currency: string;
  status: 'pending' | 'successful' | 'failed' | 'expired' | 'reversed';
  paid: boolean;
  authorized: boolean;
  authorize_uri?: string | null;
  failure_code?: string | null;
  failure_message?: string | null;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

interface OpnRefund {
  id: string;
  object: 'refund';
  amount: number;
  /** Opn marks a refund voided when it did not go through. */
  voided?: boolean;
}

export interface OpnTransport {
  (path: string, init: { method: string; headers: Record<string, string>; body?: string }): Promise<{
    status: number;
    json: () => Promise<unknown>;
  }>;
}

export interface OpnAdapterOptions {
  secretKey: string;
  /**
   * Injected so the adapter can be exercised without a network. Production
   * passes nothing and gets `fetch`.
   */
  transport?: OpnTransport;
}

/** Basic auth, secret key as the username with an empty password. */
function authHeader(secretKey: string): string {
  return `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;
}

export function createOpnProvider(options: OpnAdapterOptions): PaymentProvider & {
  fetchEvent: (eventId: string) => Promise<unknown>;
} {
  const { secretKey } = options;

  if (!secretKey) {
    throw new OpnConfigurationError(
      'OMISE_SECRET_KEY is not set. Opn cannot take a payment without it, and this adapter will not pretend otherwise.'
    );
  }

  const transport: OpnTransport =
    options.transport ??
    (async (path, init) => {
      const response = await fetch(`${API_BASE}${path}`, init);
      return { status: response.status, json: () => response.json() };
    });

  async function call<T>(
    path: string,
    method: 'GET' | 'POST',
    form?: Record<string, string | number | undefined>
  ): Promise<T> {
    const body =
      form === undefined
        ? undefined
        : new URLSearchParams(
            Object.entries(form)
              .filter(([, value]) => value !== undefined)
              .map(([key, value]) => [key, String(value)])
          ).toString();

    const response = await transport(path, {
      method,
      headers: {
        Authorization: authHeader(secretKey),
        'Omise-Version': API_VERSION,
        ...(body !== undefined ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      },
      ...(body !== undefined ? { body } : {}),
    });

    const payload = (await response.json()) as Record<string, unknown>;

    // Opn signals failure with an object of `object: "error"`, and does not
    // always pair it with a non-2xx status. Checking only the status code would
    // let an error body through as if it were a charge.
    if (response.status >= 400 || payload?.object === 'error') {
      throw new OpnApiError(
        typeof payload?.message === 'string' ? payload.message : 'Opn rejected the request',
        response.status,
        typeof payload?.code === 'string' ? payload.code : undefined
      );
    }

    return payload as T;
  }

  function confirmationFrom(charge: OpnCharge): PaymentConfirmation {
    // `paid` is the only field that means the money moved. `status` can read
    // `successful` on an authorized-but-uncaptured charge, and treating that as
    // payment would confirm a booking nobody has been charged for.
    const settled = charge.paid === true;

    return {
      chargeId: charge.id,
      amount: charge.amount,
      currency: 'THB',
      status: settled ? 'confirmed' : 'failed',
      confirmedAt: charge.created_at ? new Date(charge.created_at) : new Date(),
    };
  }

  return {
    async createCheckout(params): Promise<CheckoutSession> {
      if (!Number.isInteger(params.amount) || params.amount <= 0) {
        throw new OpnApiError('A charge must be a positive amount in satang', 400);
      }

      const charge = await call<OpnCharge>('/charges', 'POST', {
        // Satang straight through: Opn's smallest-unit convention is ours.
        amount: params.amount,
        currency: 'thb',
        return_uri: params.returnUrl,
        description: `myUNO booking ${params.bookingId}`,
        'metadata[bookingId]': params.bookingId,
        ...(params.paymentId ? { 'metadata[paymentId]': params.paymentId } : {}),
      });

      if (!charge.authorize_uri) {
        // Without somewhere to send the payer there is no checkout, and
        // returning a session with an empty URL would fail later and further
        // from the cause.
        throw new OpnApiError(
          `Opn created charge ${charge.id} with no authorize_uri, so the payer cannot be sent anywhere`,
          502
        );
      }

      return {
        id: charge.id,
        url: charge.authorize_uri,
        status: charge.paid ? 'completed' : 'pending',
        amount: charge.amount,
        // Opn's own authorize_uri lifetime; the platform's hold is the shorter
        // of this and `booking.hold_minutes`, enforced on our side.
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      };
    },

    async confirmPayment(sessionId: string): Promise<PaymentConfirmation> {
      const charge = await call<OpnCharge>(`/charges/${encodeURIComponent(sessionId)}`, 'GET');
      return confirmationFrom(charge);
    },

    async refund(params): Promise<RefundResult> {
      if (!Number.isInteger(params.amount) || params.amount <= 0) {
        throw new OpnApiError('A refund must be a positive amount in satang', 400);
      }

      const refund = await call<OpnRefund>(
        `/charges/${encodeURIComponent(params.chargeId)}/refunds`,
        'POST',
        { amount: params.amount, 'metadata[reason]': params.reason }
      );

      return {
        refundId: refund.id,
        amount: refund.amount,
        status: refund.voided ? 'failed' : 'completed',
        reason: params.reason,
      };
    },

    verifyWebhookSignature(): boolean {
      // Opn does not sign webhook bodies. Returning `true` here — which the old
      // Stripe adapter did, even with a secret configured — would accept any
      // request that reached the endpoint. The genuine check is to re-fetch the
      // event from the API, so this refuses and points at the way that works.
      throw new OpnConfigurationError(
        'Opn does not sign webhooks. Verify by re-fetching the event with fetchEvent() and trusting the API response, never the request body.'
      );
    },

    /**
     * Retrieve an event by id. This is the webhook verification path: whatever
     * arrived on the wire is only a hint that something happened, and this is
     * what establishes that it did.
     */
    async fetchEvent(eventId: string): Promise<unknown> {
      return call(`/events/${encodeURIComponent(eventId)}`, 'GET');
    },
  };
}
