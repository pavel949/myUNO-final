# Card checkout policy follow-up - 9 October 2026 (Phuket)

Checked application commit: `79dcba041362ff933d938c39c018cfaf1fc945f1` on `codex/night-booking-integrity-20261008`. This is one isolated follow-up after preserved checkpoint `4fd5c2702884cd0cb5fbea054d241bcd6ed67cfa`. Both commits remain local. Evidence assembled at 2026-10-08T21:28:05.816027+00:00.

## Reproduced issue and acceptance

P1: disabling `booking.payment.methods_enabled.card_provider` did not prevent a new provider checkout through resume, balance or service-order payment. The canonical finance writer did not consult the setting. A cached project override also allowed a new direct booking after another process disabled cards. On unchanged checkpoint code, the valid synthetic regression baseline was **12 failed / 10 passed out of 22**; failures were actual unexpected checkout/booking creation, not a provider outage.

Authority: [configuration table](../04_configuration.md) declares project payment rails with cash/bank-transfer defaults; [payment purposes](../10_payments.md) requires configured settlement rails for stay, stay_balance and service_order. Deposit preauthorization remains separate and card-only. No specification contradiction was needed to implement this correction.

Acceptance is now covered by 26 new DB/API cases and two additional component cases:

| Path | Verified result |
|---|---|
| New canonical stay, balance, service-order checkout | Disabled/missing card permission rejects before Payment insertion or provider call. |
| Guest resume | Typed 409 PAYMENT_METHOD_UNAVAILABLE; saved booking, hold and dates unchanged. |
| Direct booking | Disabled card rejects before booking creation; fresh lookup also blocks the warm-cache/other-server case. |
| Scope | Booking uses actual unit project; service order uses persisted project; standalone commerce uses global policy. Another project's permission does not authorize it. |
| Existing pending provider session | Same payment ID, provider session and decrypted URL remain recoverable after disable; provider called once. |
| Preparation/ambiguous result | Durable claim remains; CHECKOUT_PREPARING or CHECKOUT_RECONCILIATION_REQUIRED preserves evidence and does not create another payment. |
| Confirmed/checked-in date increase | Dates and unpaid balance remain committed; successful response reports pricing.checkoutIssue when checkout is unavailable; Trip displays the saved-date/unpaid-balance notice. |
| Outstanding balance or refund credit | Checkout amount uses stored total balance due; an old attempt with a changed amount goes to reconciliation; an increase fully covered by accrued refund credit does not request payment. |

The fresh configuration read runs under the existing source lock immediately before a **new** claim. Recovery/reconciliation is evaluated before the card permission gate. Fresh reads neither consume nor populate the process cache. Provider calls remain outside database locks. No schema/migration, production credentials, cash settlement, capture/refund writer, media-readiness rule or access-control setting was changed. Existing successful-card test fixtures opt in explicitly; assertions and guard rules were retained.

## Verification on the application commit

| Check | Result |
|---|---|
| Targeted regressions and related tests | PASS: 143/143 in 10 files. |
| Complete Vitest discovery | PASS: 2,794/2,794 in 332 files; six sequential groups, one worker; 0 failed, skipped, todo; every actual file set matches its discovery manifest. |
| Separate Node tests: inventory, agent guard, cutover evidence | PASS: 17/17; 0 failed/cancelled/skipped/todo. These only test the guards; no production command was run. |
| Full ESLint | PASS: zero warnings. |
| Production TypeScript | PASS. |
| Prisma generation and Next production build | PASS, local single-worker build. |
| Migration reproducibility / RLS / grants / drift | PASS: 81 migrations, all five verification gates; disposable loopback scratch database dropped. No new migration in this follow-up. |
| Static inventory generation | PASS; static inventory is not runtime acceptance. |
| Browser E2E / authenticated live journeys | NOT RUN; existing supported-browser connection blocker remains open. Component checks use jsdom. |
| Real provider, webhook, refund, external integrations, scheduler, production content and deployment | NOT RUN. All new provider traffic is synthetic; local PostgreSQL only. |
| Production HTTP smoke on this commit | NOT RERUN. Prior 24/24 result belongs to fca67891 and is not promoted to this commit. |

The content review gate was disabled only for the synthetic local build, as in CI. This does not prove property content approval or production readiness. The Media Master, live bookings/payments and external integration settings were not touched. No push, merge, preview or deployment occurred.

Resource cleanup: the verified task-owned loopback PostgreSQL process was stopped after all gates; no verification scratch database remained. Its disposable data and logs were preserved. No other process was stopped.

## Review and delivery

Separate code diff: `git-show-79dcba04-card-policy.patch`, 37840 bytes, SHA-256 `3392bc95811d451bcdebffbdbea012745dbc78ca148f9f9a4e10ffe8722d09d6`. Library ID: `libfile_d61689257dd881919b4f131049d639fc`. Initial review note: `libfile_1c105a9a2b548191b0f06146203d4e1d` (written before the full gates).

Raw baseline/targeted logs, six full-suite reports, the file manifest, combined JSON, Node/TypeScript/database/build logs and runtime commands are preserved in the task workspace and final evidence archive. Independent review acceptance of this new diff is not inferred from the earlier review of fca67891.

Remaining release constraints are unchanged: browser acceptance, genuine media/availability/price source reconciliation, real integration tests, backup/restore and parent approval before publication or production changes.
