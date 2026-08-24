-- Bank transfer as a first-class payment method.
--
-- Loop one charges cash, with the card rail behind a provider seam that has no
-- provider (Q8). That left a real gap: a Russian-speaking clientele buying a
-- stay from abroad cannot hand over cash, and cannot pay by card either — so
-- the only way to take their money was off the books entirely.
--
-- A transfer is the same shape as cash: money arrives outside the platform, a
-- named person confirms it, and the ledger records it. It is not a provider
-- rail — nothing is authorized, captured or refunded automatically — which is
-- why it joins `cash` rather than pretending to be `opn`.
--
-- Money lands in the company account named in `merchant.*` configuration
-- (doc 04): Ignatev Estate Co., Ltd, Bank of Ayudhya (Krungsri).

ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'bank_transfer';
ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'bank_transfer';
