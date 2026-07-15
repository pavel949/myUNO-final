# Payment Provider Adapters

Pluggable provider strategy supporting Stripe, Thai payment methods (PromptPay, Alipay), Russian methods (Yandex.Kassa), and currency exchange solutions.

## Architecture

Each provider implements the `PaymentProvider` interface:

```typescript
interface PaymentProvider {
  createCheckout(booking: Booking): Promise<CheckoutSession>;
  confirmPayment(sessionId: string): Promise<PaymentConfirmation>;
  refund(chargeId: string, amount: number): Promise<RefundResult>;
  preauthorize(amount: number, method?: string): Promise<PreAuthResult>;
}
```

Provider selection via `[cfg] booking.payment.provider` (active in first loop: "mock"; Q8 decision: "stripe" / "omise" / "custom").

## Current Providers

### 1. **Mock** (`mock.ts`)
- Dev/test only. Renders `/checkout/[reservationId]` form.
- Used in loop one (cash-first).

### 2. **Stripe** (planned for Q8 resolution)
- **When to use:** Card + international payments (USD, EUR, GBP).
- **Setup:** Live merchant account → API keys in `.env`.
- **Methods:** Visa, Mastercard, Apple Pay, Google Pay.
- **Region:** Global; additional Thai/Russian methods via Stripe sources.
- **Currency:** Multi-currency support (convert on client or server).
- **File:** `stripe.ts` (to be implemented).

### 3. **Omise** (alternative for Q8)
- **When to use:** Thailand-focused; strong local payment method support.
- **Setup:** Merchant account → public/secret keys.
- **Methods:** PromptPay (QR), TESCO Lotus Pay, Bangkok Bank, Thai Credit, Alipay, WeChat Pay, Visa, Mastercard.
- **Region:** Thailand + Asia.
- **Currency:** THB-native (no FX headache).
- **File:** `omise.ts` (to be implemented).
- **Trade-off:** Omise has higher take-rate but better Thai coverage.

### 4. **Yandex.Kassa** (optional for Russian owners)
- **When to use:** Russian/CIS owners paying in RUB; AMLO compliance.
- **Methods:** Bank card, Yandex.Wallet, Sberbank, Alfa-Bank.
- **Currency:** RUB.
- **File:** `yandex-kassa.ts` (future).

### 5. **Currency Exchange Partner** (optional for multi-currency)
- **When to use:** Owner payouts in multiple currencies without holding customer funds.
- **Model:** Forward exchange rate quotes; customer pays THB; payout via licensed exchanger in owner's currency.
- **Example:** Wise, OFX, SWIFT rail.
- **File:** `currency-exchange.ts` (future, post-Q8).

## Decision Tree (Q8)

1. **Primary use case?** Thailand-focused first-loop (cash + card).
   - → **Omise** (best Thai coverage) OR **Stripe** (global flexibility).

2. **Need Russian support for owner payouts?**
   - Yes → Add Yandex.Kassa adapter.
   - No → Stripe or Omise alone.

3. **Multi-currency payouts to owners?**
   - Yes → Partner with Wise/exchange provider.
   - No → Single-currency ledger (THB).

## Adapter Swap Process

To switch providers (e.g., mock → Stripe):

1. Edit `.env`: `PAYMENT_PROVIDER=stripe`
2. Provide secrets: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, etc.
3. Implement `stripe.ts` (or use pre-built):
   ```typescript
   import { PaymentProvider, CheckoutSession } from './types';
   export const stripeProvider: PaymentProvider = {
     async createCheckout(booking) { /* Stripe API call */ },
     async confirmPayment(sessionId) { /* Verify charge */ },
     async refund(chargeId, amount) { /* Refund via Stripe */ },
   };
   ```
4. Register in `index.ts`:
   ```typescript
   export function getPaymentProvider(): PaymentProvider {
     const provider = process.env.PAYMENT_PROVIDER || 'mock';
     switch (provider) {
       case 'stripe': return stripeProvider;
       case 'omise': return omiseProvider;
       default: return mockProvider;
     }
   }
   ```
5. Test `/checkout` flow in staging.
6. Deploy to production.

## Security Notes

- **Card data:** Never stored by myUNO; provider's hosted checkout only (PCI compliance).
- **Keys:** Environment-injected; never in code or .env file in repo.
- **Webhooks:** Signature-verified (`verify()` helper per provider).
- **Idempotency:** All operations idempotent (safe retries on network failure).

## Testing Providers

### Stripe Test Keys
```
Publishable: pk_test_...
Secret: sk_test_...
Card: 4242 4242 4242 4242 (exp: 12/25, CVC: 123)
```

### Omise Test Keys
```
Publishable: skey_test_...
Secret: skey_test_...
PromptPay QR: test_charge creates QR link (Omise Dashboard).
```

### Mock
```
Any amount, any card. Clicking "Pay" marks booking as confirmed.
```

## Roadmap

- ✅ Loop 1: Mock (cash-first).
- 🔴 Loop 2: Stripe OR Omise (Q8 decision).
- 🔮 Loop 3: Russian methods (Yandex.Kassa if needed).
- 🔮 Loop 4: Multi-currency payouts (Wise/exchange partner).
