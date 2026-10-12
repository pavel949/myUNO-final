# End-to-end code audit — 2026-10-11

Scope: booking & payment, owner finance & payouts, ops/services/comms/compliance/cron,
auth & access (all 227 route files pattern-scanned, ~70 read in full), CRM/content/config/boundaries.
Method: five independent read-only static reviews of `main` at `82f7171c`.
**Nothing was run: no database, no app, no tests. Every item below is "verified by reading code", not by runtime.**
Verify each item (reproduce, ideally with a test) before fixing. Commercial decisions are marked **[DECISION]**.

Production note (separate from this audit): migrations `20261010070000/102000/103000/104000` were not yet applied to the
production database when this was written; see `AI_MAIN_AUDIT_2026-10-11.md`.

## P0 — wrong money in owner statements

| # | Finding | Evidence | Fix direction |
|---|---|---|---|
| F1 | Cancelled bookings are excluded from gross, but their `refund_out` is still deducted → NOI negative; the retained cancellation fee is credited to nobody. No test. | `statement-snapshot.ts:36` (`REVENUE_BOOKING_STATUSES`), `booking.service.ts:807`, `admin/statements/generate/route.ts:260` | **[DECISION]** how a retained fee is recognised; then count cancelled = gross − refund, mirror in freshness check |
| F2 | After an ownership transfer, statements/payouts still go to the previous owner; engagement cannot be repaired (`Engagement owner no longer matches…`). | `generate/route.ts:428`, `ownership.service.ts:40-168`, `engagement.service.ts:~100` | close engagement on transfer; refuse/split periods spanning two owners; resolve recipient by `getOwnerAt` |
| F3 | Statement periods can overlap or be open (duplicate check = exact match only; no `periodEnd < today`) → same revenue in two statements, two owner payouts. | `generate/route.ts:186,89`, schema ~1534 | overlap constraint/lock + require closed period in project tz |

## P1 — money / compliance / security

Booking & payment
- B1 Cash/bank-transfer holds never expire; `POST /api/bookings` unrated (`booking-occupancy.ts:51`, `bookings/route.ts`). **[DECISION]** TTL.
- B2 Failed/expired Opn charge never recorded → retry returns dead URL, then blocked (`provider-webhook.service.ts:51`, `finance.service.ts:400`).
- B3 Card charge can succeed after hold expiry (charge 60 min vs hold 30) → `payment_unallocated`, no auto-refund (`providers/opn.ts`, `finance.service.ts:575`).
- B4 Webhook-first confirmation sends no confirmation notification (`webhooks/opn` path lacks `notifyBookingConfirmed`).
- B5 Cancel commits before refund issuance; failure leaves cancelled booking with no refund row (`bookings/[id]/cancel/route.ts:139`).
- B6 Cash/transfer cancellation refund stays `requested` forever; nothing settles it (`finance.service.ts:94,275`).
- B7 Host-initiated cancellation applies guest policy to the guest (`cancel/route.ts:121`). **[DECISION]**
- B8 Opn refund: no idempotency key; `succeeded→failed` flip; refund found by non-unique tuple (`finance.service.ts:718-741,855`, `provider-webhook.service.ts:78`).
- B9 Deposit "pre-auth" fabricated without provider call; positive ledger adjustment on "capture" (`deposits.service.ts:151,267`); config default `off`.
- B10 Cron 2×/day vs 6 h TM30 escalation window; no ops-lead fallback; failed TM30 terminal (`vercel.json`, `tm30-filing.service.ts:243-282`).
- B11 (P2) Input validation of guest counts/dates; date change without booking lock; check-in without status guard; service-order late card payment throws instead of reconciling.

Owner finance
- O1 Ledger append-only enforced by DB only for manual-cost/reversal rows; replace-regeneration nulls `statement_id` on all linked rows incl. `payout_owner`.
- O2 Provider payouts: free-form periods, no order→payout link → double pay; late refunds lost (`admin/payouts/provider/route.ts`, `remittance.service.ts:~118`).
- O3 Dispute decision and `resolveFailedRefund` not atomic/guarded (can refund twice; write-off on a succeeded refund) (`dispute.service.ts:165`, `payout.service.ts:340-383`).
- O4 `fulfillServiceOrder` non-atomic; duplicate/missing commission (`service-order.service.ts:~468`).
- O5 `/api/admin/fees/calculate` trusts client totals, non-idempotent.
- O6 System ledger rows use `new Date()` (UTC) but statements sweep at UTC midnight → up to 7 h boundary drift.
- O7 Gross = booking total, not cash collected; unpaid balances counted.
- O8 (P2) negative fee base, unswept deposit/dispute adjustments, owner-stay cleaning stored positive, performance-fee contract lookup ignores window, reconcile message prints satang as baht, Int32 cap ฿21.47M.

Ops / compliance
- C1 Passport scan "deletion" removes only the DB row; blob is public and never deleted; cancelled/no-show bookings never scrubbed (`retention.service.ts:21-63`, `media.service.ts:30-63`). Latent (scan path unused in UI).
- C2 TM30 `failed` cannot be filed; escalation can notify nobody and can double-notify; guest added after check-in gets no filing; `dueAt` from `startDate` not arrival.
- C3 SLA/expiry/verification jobs only in nightly `run-all` (12 h accept SLA becomes 12–36 h).
- C4 Order expiry marks `expired` before refund, no transaction/retry, orderer not notified.
- C5 Ticket SLA breach writes an event only; no notifications; ticket thread has only the reporter.
- C6 Notification sends are fire-and-forget (serverless may freeze; no retry sweeper).
- C7 Decrypted guest names stored plaintext in `notification.params`.

Access & security
- S1 `core.can()` ignores the `scope:` column; project-scoped `mc_member` matches any unit in the project. Routes relying on `can()` alone: `record-transfer`, `deposit-claim`, `internal-note`, `pricing-rules`, `availability-blocks`, `owner/units/[unitId]/contract`, announcements (`permissions.ts:~323-395`).
- S2 `GET /api/bookings/[id]` returns `internalNote`, `creationKey/Fingerprint`, `cancelledByIdentityId`, etc. to the guest/owner (`route.ts:~33,110`).
- S3 Sessions stateless, 30-day, not revoked by password reset/logout (`auth/session.ts`).
- S4 Pre-registration account takeover: unverified email → active session; Google sign-in links by email only (`auth.ts:~87`, `callback/google/route.ts:~130`).
- S5 In-memory rate limiter ineffective on Vercel; lead/auth/claim/webhook endpoints (`libs/rateLimit.ts`).
- S6 ~30 admin pages rely on `layout.tsx` alone (defence in depth; bypass not runtime-verified).

CRM / config
- L1 Lead consent + CRM record lost on any CRM failure (`.catch(console.error)`), `{ok:true}` returned (`api/leads/route.ts:86-108`).
- L2 Lead endpoint attaches records/consent to any existing identity by email/phone; attribution/referrer fields unvalidated; no E.164 normalisation.
- L3 Deposit pre-auth failure swallowed (`finance.service.ts:249,661`, `booking.service.ts:771`).
- L4 Hardcoded fee fallbacks on money paths: `?? 12`, `?? 15`, `?? 15`, `?? 20`, `?? 5` (`mc.service.ts:601,623`, `service-order.service.ts:253`, `canonical-pricing.service.ts:326,328`) — contradicts "no guessing"; check doc 04 registration.

## P2 (selected)
Open redirects (`claim-client.tsx:36`, `login-form.tsx:63` allows `//evil.com`); account-state leakage and `error.message` in 500s; PII in logs (register email, Google user object); unescaped `firstName` in verification email HTML; SVG upload to public blob; client-supplied media ids not ownership-checked; `robots.ts` blocks `/owner` prefix → also `/owners` which the sitemap lists; lifecycle transition log gaps and 500 on bad stage; 112 non-test imports bypassing module `index.ts`; heavy `listPublicDiscoveryUnits` (200 units, full media); `react-beautiful-dnd` unmaintained; non-timing-safe cron secret compare; email not lowercased; encryption key has no version id; retention deletion re-runs forever; `completeMobilizationStep` skips `assertUnitReadyForActivation`.

## Checked and fine (as reported)
Integer satang, one `Math.round` per aggregate; owner payout unique per statement; sign-off lock order + snapshot verification; NOI-cap refusal; owner routes scoped by owner; cron routes fail closed on `CRON_SECRET`; iCal/Layantara/Opn webhooks token/HMAC/re-fetch protected; IDOR checks passed for bookings, tickets, threads, statements, receipts, service-orders, checkout, TM30 passport; cookie flags; NEXT_PUBLIC_* clean.

## Not checked
Runtime behaviour of anything; RLS; RSC layout bypass on Next 14.2.35; Vercel x-forwarded-for trust and plan timeouts; admin refund UI; `npm audit`; i18n literal lint; doc 04 registration of the fallbacks; tests.

## Suggested order
1. Apply pending prod migrations (not an audit item, blocks everything).
2. F1–F3 (statement correctness) — need **[DECISION]** on retained cancellation fees; add tests first.
3. S1, S2, S4, S3 (access/security).
4. B2, B3, B6, B8, O3 (payment state machines).
5. C1–C3, L1 (compliance/consent).
6. Rate-limit store, cron cadence, P2 items.
