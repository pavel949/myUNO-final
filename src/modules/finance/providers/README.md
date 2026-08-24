# Payment providers

**The seam fails closed.** A provider that is not implemented throws. The mock refuses to load in production. Nothing here can ever assert that money arrived when it did not.

> This directory previously shipped a Stripe adapter that had no SDK behind it: it fabricated confirmations with a hardcoded charge id and a hardcoded amount, and asking for `omise` quietly returned the mock instead. A deployment configured for real payments would have taken fake ones and reported success. Everything below is shaped by not repeating that.

## The rails, and what each one honestly is

| Rail | What it is | Status |
|---|---|---|
| **Cash** | Money handed over, recorded by a named staff member with a receipt/чек number. No provider involved. | Working. The primary rail for loop one (doc 10). |
| **Bank transfer** | Money moved into the company's Krungsri account against a booking-derived reference, confirmed by a staff member against the bank statement. No provider involved. | Working. `finance.recordBankTransfer` — the honest sibling of cash, not of a provider. |
| **Opn (Omise)** | The licensed Thai provider. Cards and local methods, THB settlement. | **Adapter written, not yet exercised against a live account.** Needs a merchant account and keys. |
| **Mock** | Local development only. Records a payment without moving money. | Refuses to load in production. |

## Opn — the chosen provider (Q8, ruled 2026-08-24)

Thai-licensed, settles THB into the company account, and carries the local methods that matter here — PromptPay above all. Chosen over Stripe because Stripe's better tooling does not outweigh a payer in Phuket being offered a method they actually use.

**What card acceptance will and will not reach.** Russian-issued cards do not work with any Western processor: Visa and Mastercard cut them off from the international networks in 2022, and Mir is not accepted outside a handful of countries. Card acceptance reaches Russian-speaking guests holding a card issued *outside* Russia — Thai, UAE, Kazakh, Georgian — and nobody else. **Cash and transfer remain the primary rails by necessity, not by conservatism.**

### Switching it on

1. Open an Opn merchant account. Requires a Thai registered entity and KYC — an application Ignatev Estate makes; no code substitutes for it.
2. Set `PAYMENT_PROVIDER=opn` and `OMISE_SECRET_KEY=skey_test_…` in a non-production environment.
3. Run a charge end to end and record the result. **Until that smoke test exists, the adapter is "written and reviewed", not "proven".**
4. Add `card_provider` to `booking.payment.methods_enabled` (doc 04 §2).
5. Only then set a live key, and only in production — the seam refuses a `skey_live_` key anywhere else, so a test booking cannot become a real charge.

### Three things the adapter does deliberately

- **Confirms only on `paid: true`.** Opn reports `status: successful` with `paid: false` for an authorised-but-uncaptured charge. That is a hold, not a payment, and confirming it would hand over a stay nobody has been charged for.
- **Passes satang straight through.** Opn takes the currency's smallest unit, which is how this platform stores money — so there is no conversion between us and them, and no place to lose a factor of a hundred.
- **Refuses to validate a webhook signature.** Opn does not sign webhook bodies. `verifyWebhookSignature` throws and points at `fetchEvent`, which re-fetches the event from the API with the secret key — the request body is a hint that something happened; the API response is what establishes that it did.

## Not doing

- **Crypto.** A licensed activity under the SEC/BOT, same class as FX and fund-holding (Q21). Not a feature, not a roadmap item.
- **Holding funds.** myUNO is never the custodian. Charges settle with the provider; deposits are pre-authorizations (Q6); owner payouts are recorded, manually executed transfers (Q18).
- **FX.** Routing only, never operated (AMLO).
