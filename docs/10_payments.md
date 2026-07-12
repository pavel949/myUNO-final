# 10 · Payments & Payouts — the money map

**What this document is.** Where every baht comes from, where it goes, who computes what, and the legal lines that are never crossed. Records are doc 02 §5; rates and policies are configuration (doc 04); flows are doc 07. Loop one is **THB only**.

**The two legal absolutes** (constitution): myUNO **never holds guest funds or deposits without a license** — collection, holds, and refunds run through a **licensed payment provider**; and myUNO **never operates FX** — currency needs are routed to a licensed exchanger, information-only.

---

## 1. The payment seam

There are **two settlement rails** (Q8), both writing the same `Payment`/`Refund`/`LedgerEntry` records so statements and reconciliation don't care which was used:

**Rail A — cash (the loop-one primary rail).** `recordCashPayment(purpose, amount, target, receivedBy, receiptRef) → Payment(method=cash, status=succeeded)` · `recordCashRefund(paymentId, amount, reason, paidBackBy)`. No checkout, no redirect — a staff/host action that captures **who took the money, when, and the receipt/чек reference** (doc 02 §5.1). This is the main way the Russian-speaking clientele pays in the first cycle.

**Rail B — the provider seam (cards / Thai methods, added later).** One interface (doc 01 D6, proven in the legacy clone): `createCheckout(purpose, amount, target, payer) → {checkoutUrl, sessionId}` · `verifyAndConfirm(sessionId)` (idempotent; callable from success-return **and** webhook — whichever lands first wins, the second is a no-op) · `refund(paymentId, amount, reason)` · `preauthorize / capture / void` (deposits, Q6). Adapters: **`mock`** (built-in checkout page, no real charge — every flow works end-to-end in dev/staging and until the provider contract lands) and **the licensed provider — default Opn (Omise)** (Q8; 2C2P / Stripe TH / GB Prime Pay remain alternatives — one adapter file when switched on). Webhook signatures verified; unsigned/invalid → 400 + alert.

**Crypto is not a rail** — accepting it is a licensed activity (SEC/BOT), the same class as operating FX; excluded by decision (Q21), not built.

Both rails: all amounts **server-computed**; **client-sent amounts are never trusted** (anti-tamper posture, doc 02 price breakdowns).

## 2. Charge types

| Purpose | When | Amount source |
|---|---|---|
| `stay` | F-GUEST-3 booking payment | `Booking.price_breakdown` total |
| `stay_balance` | F-GUEST-9 upward modification; F-GUEST-7 extension | `BookingChange.price_delta_thb` |
| `service_order` | F-SVC-2 order payment | `ServiceOrder.price_breakdown` total |
| `deposit_preauth` | Check-in minus N days when `[cfg] booking.deposit.mode=preauth` | `[cfg] booking.deposit.amount_thb` — **authorization only, never captured except a damage claim (F-DIS-1), auto-void after check-out inspection** |

Each purpose **except `deposit_preauth`** may settle by either rail — `cash` (recorded) or `card_provider` (seam) — per `[cfg] booking.payment.methods_enabled`. `deposit_preauth` is **card-only**: a cash-held deposit would be fund-holding, which is forbidden (Q6).

## 3. Who is merchant of record

- **Stays:** **Ignatev Estate Co., Ltd** (the operating entity, Q16) is merchant of record; rental revenue enters the unit's ledger whether paid **in cash** (recorded by the staff/host who received it) or by card through the provider; the owner's share is computed by engagement type (§4) and paid out (§6). This *is* the business, not fund-holding: the money is revenue under a management mandate. Cash collected is company revenue, recorded to the ledger the same day.
- **Service orders:** collected through the same provider checkout. **Fulfilment liability** follows `Service.fulfilment_mode` (referred = provider's responsibility, badge-vetted; operated = myUNO's). **Money** in both cases: the order total settles via the provider; the take-rate (`[cfg] services.take_rate_pct[.category]`, snapshotted per order) is myUNO's; the remainder is remitted to the provider on the payout cadence (§5). This keeps one checkout experience and one refund rail. *(Q3 refined: the operated-vs-referred fork governs liability and ops, not the checkout rail.)*
- **Buyer transactions:** never on the platform (Q1) — Capital-led, off-platform.

## 4. Commission by engagement type (the economics engine)

Applied by the statement generator (F-FIN-1) per the unit's **active `UnitEngagement`**, parameters from doc 04 §3 (per-mandate overrides beat config):

| Engagement | Rental money split |
|---|---|
| `direct_managed` | Compute **NOI** per period = rental revenue (+ season markup share per `[cfg] engagement.seasonal_markup_share_pct`) − unit costs from the ledger. **Owner = MIN(NOI, cap_pro_rata)**; **Estate = MAX(0, NOI − cap_pro_rata)** where `cap_pro_rata = noi_cap_annual_thb × period_days / 365`. Cap missing → generation refuses (no guessing). |
| `via_management_company` | myUNO's platform fee = `[cfg] engagement.via_mc.platform_fee_pct` × rental revenue of the unit (ledger entry `mc_platform_fee`); the rest of the economics are between MC and owner (their mandate), reported to each per doc 03 visibility rules. |
| `owner_direct` | myUNO's fee = `[cfg] engagement.owner_direct.booking_fee_pct` × booking revenue (`owner_direct_fee` entries); owner receives the remainder in the payout. |

Services commission (`service_commission` entries) and setup fees (`setup_fee`) book platform-side regardless of engagement. OTA-channel bookings record their channel commission as `ota_commission_cost` on the unit's ledger so NOI is honest.

## 5. Provider remittances

Per `[cfg] services.payout_period` (default weekly): report per provider = fulfilled orders' totals − take-rate − refunds clawed back; `Payout(payee_type=provider)` recorded when executed (manual bank transfer, loop one — Q18); provider sees the same report in their portal (N-23). Disputed/failed orders are excluded until resolved.

## 6. Owner payouts

After statement publication (the sign-off gate, F-FIN-1): `Payout(payee_type=owner)` records the transfer (amount = owner share, method `bank_transfer_thb`, bank reference, date). THB payouts go from **Bank of Ayudhya (Krungsri) 475-1-22131-3, SWIFT AYUDTHBK** (`finance.payout.default_thb_account`, Q18). Execution is **manual at the bank in loop one** — the platform is the record, not the rail. **International / non-THB owner payouts are a future decision (Q22)**; where an owner wants non-THB, it is **routing only** — the statement page may show licensed-exchanger information (`trust`/`legal` content keys); the platform never converts, quotes, or carries FX.

## 7. Deposits (⚠ Q6, provisional)

`preauth` mode: authorization placed via the provider before check-in; released (voided) automatically after a clean check-out inspection; damage claim (F-DIS-1) may capture up to the authorized amount after the 48h evidence window. Where the chosen provider cannot pre-auth, or mode is `off` (the default): **no deposit exists** — damage is claimed after the fact against the condition record and invoiced through the provider. In no case does a deposit sit in a myUNO account.

## 8. Refunds — always through the provider, never from a wallet

Every refund is a `Refund` row against the original `Payment`, executed by the provider back to the original instrument:

| Trigger | Amount |
|---|---|
| Guest cancels stay | Per the booking's **snapshotted** policy schedule (doc 04 §5) — computed and shown before confirmation |
| Platform/host cancels stay | 100% (`[cfg] cancellation.host_cancel_full_refund`) |
| Downward modification | The delta (`refund_accrued_thb`) |
| Orderer cancels service in window / provider declines / accept-SLA lapse / provider no-show | 100% (no-show also auto-tickets) |
| Orderer cancels service past window | 0 (stated plainly in the dialog) |
| Dispute resolution / goodwill | Admin-entered amount, decision-referenced, audit-logged |

⚠ Refund fails provider-side → `Refund.status=failed`, admin alert (N-10), visible in the reconciliation board until resolved; the user sees "processing" with support access — never silence.

## 9. Reconciliation (F-FIN-2)

Monthly rhythm, admin finance board: (1) provider settlement report ↔ card `Payment` rows — every settled charge matched, orphans flagged; (2) **cash `Payment` rows ↔ the cash actually banked** — each cash payment carries who received it and when, reconciled against the deposit slips into the Krungsri account; (3) `Refund` rows ↔ provider report / cash-refund log; (4) ledger sweep completeness (every confirmed booking/fulfilled order has its revenue entries); (5) payouts `recorded → reconciled` against bank statements; (6) failed refunds and expired pre-auths cleared. The v3 principle applies: this is where owner trust is won — **the cleanest audit trail in the business**, which is why the ledger is append-only and every number on a statement links to its source rows.

## 10. Unhappy paths already wired

Payment failure/abandonment (hold expiry frees dates); double-webhook (idempotent confirm); dates-taken race (409 before charge); balance-payment failure (modification not applied); refund failure (alert + board); pre-auth declined (specific messaging); reconciliation orphans (flagged, never auto-dropped). Every path leaves the money state explicit — no booking is ever "paid-ish."
