# Frontend ↔ Backend Contract Audit — 2026-09-28

Scope: PR #137, process-centred admin and canonical property → stay → financial close. This is a source/CI audit, not a production sign-off.

## Canonical chain

| UI entry | API/service | Canonical record | Notes |
|---|---|---|---|
| Add property | POST /api/admin/projects → projects.createProject | Project | Onboarding continues at /app/admin/properties/[id]/onboarding. |
| Category / home | POST /api/admin/projects/[id]/catalog and POST /api/admin/units → projects.createUnit | InventoryCategory, Unit | UnitType must match Prisma enum; category rate is expressed in baht at UI/API boundary then stored in satang. |
| Rate plans | POST /api/admin/projects/[id]/catalog, action=rate_plan | RatePlan | No independent UI pricing calculator. |
| Reservation | POST /api/bookings → booking.createBooking | Booking | Server recomputes guest-stay quote; booking exclusion constraint and blocked dates protect inventory. |
| Admin booking list | GET /api/admin/bookings | Booking + succeeded initial Payment | amountThb is satang internally; UI totalThb is baht; balanceDueSatang is exact for initial payment only. |
| Cash | POST /api/bookings/[id]/record-cash-payment → finance.recordCashPayment | Payment + Booking + LedgerEntry | Financial transition is atomic, notification best-effort after commit. |
| Transfer | POST /api/bookings/[id]/record-transfer → finance.recordBankTransfer | Payment + Booking + LedgerEntry | Exact amount/payer/state validated under booking lock. |
| Card | POST /api/checkout/confirm → finance.verifyAndConfirm | Payment + Booking + LedgerEntry | Authorization precedes even simulated decline; provider verification, transaction and post-commit notifications. |
| Stay | POST /api/bookings/[id]/checkin and /check-out → booking service | Same Booking, ConditionReport, TM30 | Ancillary reports/notifications are best effort after state transition. |
| Owner reporting | POST /api/admin/statements/generate | OwnerStatement + StatementLineItem | Rental receipts exclude deposit purpose. |
| Booking journey | Server-side Prisma projection | Booking plus linked Payment/Ledger/Statements | Read-only; no second reservation, ledger or status table. |
| Operations map | Server-side getProcessState projection | Canonical counts | Diagnostic only, no mutable workflow status. |

## Findings repaired in this branch
1. Duplicate front-end refresh calls after booking note update.
2. Rounding of booking total at frontend/API boundary before using amount for transfer. UI now displays baht and sends exact satang.
3. A request-status fixture attempted to record a payment without approval. Fixture now respects pending_payment.
4. New content keys were not seeded. Registered review-required translations.
5. Payment confirmation's simulated decline used session ID before access authorization. Authorization now precedes any mutation.
6. Notification failure after committed payment/stay previously surfaced a failure to the UI; notifications are post-commit best-effort.
7. Media upload success was shown without checking if the uploaded asset had been attached to the property.
8. A positive-value booking with zero receipts and zero ledger entries could be shown as reconciled (0 = 0). This is now blocked.
9. Cash, transfer and card confirmation validate state and avoid duplicate initial or balance charges.
10. Owner statement rental receipts exclude deposit-purpose payments.
11. Mock checkout was not consistently denied in production when the provider adapter was bypassed. Provider availability is now checked before creating payment rows; mock confirmations are denied in production and Opn sessions require Opn verification.
12. Checkout display now returns the actual provider and exact baht decimals; the real-provider view hides mock pay/decline controls.
13. Simulated declines validate payer, provider and pending status before a conditional state transition, preventing a completed payment from being overwritten as failed.

## Required gates before merge
- Latest commit lint, migration replay/drift, build, and integration suite all pass.
- Authenticated browser smoke: project → category → unit → rate → readiness → booking → payment → check-in → check-out → owner statement; verify counts and exact satang/baht boundary.
- Verify owner/agent/staff cross-scope access and unit isolation.
- Verify production payment provider and webhook with a non-mock environment.
- Verify OTA ARI sync or explicitly maintain manual closeout controls.
- Verify owner statement date allocation for stays crossing an accounting-period boundary; current statement generation filters to bookings fully contained in period and therefore requires an explicit accounting rule.
- Verify payment collection never returns a false failure after successful commit, and that any failed notification has operational retry visibility.
- Vercel build-rate limit must be resolved and preview deployed; do not infer production from a GitHub commit.

## Known limitations not resolved here
- Operations Map contains portfolio-wide admin aggregates, not per-role task queues.
- Booking Journey reads owner-statement links; it does not itself approve/distribute statements or initiate payouts.
- Full browser E2E and real provider/OTA integrations are not proven by the database integration test.
