/**
 * Payment provider interface and types.
 * All providers implement this contract; swap implementations via config.
 */

export interface CheckoutSession {
  id: string;
  url: string; // Redirect URL for guest to complete payment
  status: 'pending' | 'completed' | 'failed';
  amount: number; // satang (THB × 100)
  expiresAt: Date;
}

export interface PaymentConfirmation {
  chargeId: string;
  amount: number; // satang
  currency: 'THB';
  status: 'confirmed' | 'failed';
  confirmedAt: Date;
}

export interface RefundResult {
  refundId: string;
  amount: number; // satang
  status: 'pending' | 'completed' | 'failed';
  reason?: string;
}

export interface PreAuthResult {
  authId: string;
  amount: number; // satang
  status: 'authorized' | 'failed';
  expiresAt: Date;
  method?: string; // 'card', 'promptpay', etc.
}

export interface PaymentProvider {
  /**
   * Create a checkout session for a booking.
   * Returns a URL to redirect the guest to.
   * Session expires after HOLD_MINUTES if not confirmed.
   */
  createCheckout(params: {
    bookingId: string;
    amount: number; // satang
    guestEmail: string;
    guestName: string;
    returnUrl: string; // POST /api/checkout/confirm
    cancelUrl: string; // Guest cancels checkout
  }): Promise<CheckoutSession>;

  /**
   * Confirm a checkout session is paid.
   * Called after guest returns from provider's checkout page.
   * Idempotent: safe to call multiple times.
   */
  confirmPayment(sessionId: string): Promise<PaymentConfirmation>;

  /**
   * Refund a charge (full or partial).
   * Idempotent: safe to retry on failure.
   */
  refund(params: {
    chargeId: string;
    amount: number; // satang; if less than charge, partial refund
    reason: string;
  }): Promise<RefundResult>;

  /**
   * Pre-authorize an amount (hold card without charging).
   * Used for deposits. Must be captured or voided within provider's SLA.
   * Optional for providers that don't support pre-auth.
   */
  preauthorize?(params: {
    amount: number; // satang
    method?: string; // 'card', 'promptpay', etc.
  }): Promise<PreAuthResult>;

  /**
   * Verify webhook signature (for idempotent confirm on callback).
   * Called before processing webhook data.
   */
  verifyWebhookSignature(signature: string, body: string): boolean;
}

export interface ProviderConfig {
  provider: 'mock' | 'stripe' | 'omise' | 'yandex-kassa';
  publicKey?: string; // Publishable/public key (safe for client)
  secretKey?: string; // Secret key (server-only)
  webhookSecret?: string; // For webhook signature verification
  testMode?: boolean; // Use test keys instead of live
}
