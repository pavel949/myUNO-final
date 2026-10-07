# Operations architecture audit: inventory, PMS and money

Assessed source: `pavel949/myUNO-final`, main `24138a2d717773534d923244a102631987aad641`, 2026-10-08. This is a read-only architectural assessment. No DB writes, roles, bookings, provider operations, financial transactions, code changes or publication were performed by this worker. File/line references describe this baseline; concurrent work outside these files is not evidence that findings are deployed or fixed.

## Executive assessment

The modular monolith has the right primary records: one physical Unit, canonical Booking and BlockedDate, category/RatePlan pricing, append-only ledger and scoped operating spaces. Several critical write paths already serialize capacity or payments and use DB constraints rather than relying on UI. The main weakness is **uneven enforcement across writers**: payment and direct booking paths are comparatively disciplined, while task transitions, recurrence generation, rate overrides, group linking and manual ledger corrections lack comparable concurrency/idempotency boundaries.

A green build cannot certify resort operation. In particular, blocked turnover status can escape check-in readiness; a task advertised as blocking inventory has no effect on canonical sellability; financial corrections/remittance can drift across repeated requests or mutable state. These require targeted integration proof before full PMS/resort activation.

Severity: P1 = confirmed source path capable of important operational, authorization or money failure; P2 = reliability/scale/data quality gap. No live incident or production exploit was reproduced. P0-class financial/inventory consequences remain possible in several scenarios, but source deductions are distinguished from runtime proof.

## Domain map and writer boundaries

| Business fact | Canonical records / authority | Current paths | Architectural assessment |
|---|---|---|---|
| Physical inventory | Project → InventoryCategory → Unit | projects/core services, admin onboarding | Correct shared asset foundation; resort/condo/portfolio must not duplicate physical units. |
| Operating portfolio | OperatingSpace, OperatingSpaceUnit, OperatingSpaceMember, OperatingTeam | `operating-space.service.ts`, `/ops/spaces` | A grouping/permission layer over assets, not a second occupancy store. Effective dates/capabilities are inconsistently applied downstream. |
| MC mandate | RoleAssignment + UnitEngagement | `getMCManagedUnits`, `hasManagedUnitMcAccess` | Same project+organization and active engagement enforced; effective starts/ends are omitted. |
| Sold capacity / holds | Booking + exclusion constraint | `createBooking`, request response, date change | Per-unit advisory locking and half-open ranges are strong; check-in/out transitions need fresh locked state. |
| Offline capacity | BlockedDate | manual block, iCal/source protection | Shared per-unit locking protects booking-vs-block conflict. OperationalTask.blocksInventory is not linked to this authority. |
| Price / restrictions | Category + BAR RatePlan + PricingRule + scoped config | canonical quote, override and tariff editor | Canonical quote reused for calendar/booking; rule insertion overlap protection is race-prone. |
| Money received | Payment + LedgerEntry | cash/transfer/verified provider confirmation | Atomic confirmation/ledger boundaries exist; provider state verified before confirmation. |
| Disbursement | Payout + ledger allocation | atomic payout services, DB unique indexes | Recorded payout+ledger is atomic; remittance calculation still uses mutable recognition date/current commission. |
| Readiness / work | OperationalTask / PreventiveMaintenancePlan | checkout upserts, task APIs, scheduler | One canonical task table; transition/recurrence CAS and capability checks incomplete. |
| Grouped reservation | ReservationGroup with Booking children | group service, manual desk | Not a duplicate booking store; create-group conditional linking is robust, attach/remove are weaker. |

## Confirmed findings with failure scenarios

### O-01 — P1: blocked turnover task does not block canonical check-in

Evidence: `src/modules/booking/booking.service.ts:769–776` checks turnover tasks in `planned, assigned, in_progress, inspected`, omitting `blocked`. Canonical task `OPEN_STATUSES` includes `blocked` at `src/modules/ops/operational-task.service.ts:7`; `assertUnitReadyForCheckIn` includes it at lines 55–61.

Scenario: turnover cleaning starts, worker discovers a serious issue and marks task blocked. Next arrival uses `checkInBooking`; the blocking task disappears from its predicate, and the booking can become checked_in. UI readiness can disagree with canonical writer.

Plan: one shared readiness predicate used by readers and all check-in writers; include blocked turnover and distinguish cancelled from fulfilled obligations. Integration test must create blocked cleaning/inspection and assert no booking transition, no TM30/key-release side effects.

### O-02 — P1: blocksInventory is a descriptive flag, not actual capacity protection

Evidence: task writer stores Boolean at `operational-task.service.ts:269`, recurrence copies it at line 400, API accepts it at `src/app/api/ops/tasks/route.ts:106`. Housekeeping uses it to display maintenance state at `src/app/ops/housekeeping/page.tsx:72`. `checkAvailability` (`availability.service.ts:149–174`) and `createBooking` (`booking.service.ts:337–360`) read Booking/BlockedDate, not tasks. Repository reference scan found no task-to-BlockedDate writer or canonical availability consumption.

Scenario: operator checks “blocks inventory” on maintenance; PMS says maintenance/blocks inventory, but direct or category booking can still sell the unit unless someone separately creates a BlockedDate. This is not solved by adding task rows to a second occupancy store.

Plan: explicit unavailable-date interval and reason, transactional canonical BlockedDate creation under unit lock, linked task/block lifecycle. Closing task must not blindly remove independent owner/OTA/lease blocks. Concurrency test booking vs maintenance block and category-capacity reduction.

### O-03 — P1: operational task transitions are not compare-and-swap

Evidence: `operational-task.service.ts:88–110` reads current task then validates transition and performs unconditional `update(where:id)`. An ordinary transaction at default isolation does not serialize those reads; no row/advisory lock or expected status/version condition exists.

Scenario: two workers read in_progress. A sets ready, B sets blocked based on stale state. Both legal against old state, but B overwrites terminal ready, contrary to TRANSITIONS where ready has no outgoing transitions (lines 71–81). Assignments/notes similarly overwrite each other.

Plan: lock task row or `updateMany(id,status/version)` with explicit conflict result, preserve append-only transition event actor/evidence. Barrier-controlled concurrent integration test, not a sequential mock test.

### O-04 — P1: overdue recurring maintenance can generate duplicate tasks

Evidence: `generateDuePreventiveMaintenanceTasks` reads candidates outside transaction at lines 344–350, claims using `nextDueAt <= now` at lines 355–359, and writes `candidate.nextDueAt + frequency` at lines 362–365. If candidate is more than one interval overdue, new date remains <=now. Second worker can pass the same predicate and write the same stale next date. Schema `OperationalTask` has a nonunique `[preventiveMaintenancePlanId,dueAt]` index (`prisma/schema.prisma:2427`), not an occurrence identity constraint.

Scenario: two scheduler invocations after downtime generate the same plan/unit/dueAt tasks twice. Sequential scheduler invocations can also perform slow catch-up with unclear policy.

Plan: CAS exact expected nextDueAt, stable `(planId,unitId,occurrenceDate)` unique identity, explicit missed-occurrence policy (catch up/coalesce/skip), bounded batches and retry cursor. Test concurrent overdue claims and failure rollback halfway through portfolio expansion.

### O-05 — P1: task PATCH bypasses OperatingSpace capability policy used by POST

Evidence: POST validates `manage_tasks` and `assign_tasks` for body.operatingSpaceId at `src/app/api/ops/tasks/route.ts:72–91`. PATCH loads only id/project/unit at `src/app/api/ops/tasks/[id]/route.ts:48–51`, authorizes any listed staff department or active MC unit mandate (lines 18–37), and permits assignToMe/status changes (lines 72–76), without reading task.operatingSpaceId or its membership capabilities.

Scenario: user retains broad legacy project/MC authority but loses space manage_tasks/assign_tasks. Creation is denied when space is supplied, yet known task id can still be reassigned/completed through PATCH. This is a confirmed policy inconsistency, not proof of cross-property leakage.

Plan: one operation-specific authorization resolver used by GET/POST/PATCH; intersect effective unit mandate, task space, membership capability, assignment privilege and state. Negative tests for read-only/expired/revoked space member and non-assigned worker.

### O-06 — P1: rate overlap check is not atomic with insertion

Evidence: `src/modules/core/availability.service.ts:377–399` queries overlapping rules then calls create without unit lock/transaction; PricingRule has only an index at `prisma/schema.prisma:1180`. No exclusion constraint was found for PricingRule. Canonical quote orders rules deterministically (`canonical-pricing.service.ts:239–249`), so old comment about arbitrary findFirst is outdated, but duplicate overlapping rates still violate writer intention.

Scenario: two revenue managers create overlapping date overrides concurrently; both prechecks see no rule and both commit. Guest quote picks one ordered winner, while operator believes each override governs its dates.

Plan: per-unit lock + overlap check inside transaction; optionally range exclusion constraint after existing overlap reconciliation. Keep explicit precedence if overlap is intentionally supported; never rely on silent winner. Test parallel inserts and quote source trace.

### O-07 — P1: provider remittance recognizes mutable updatedAt and current take-rate

Evidence: `src/modules/finance/payout.service.ts:158–170` selects fulfilled orders by updatedAt; lines 175–179 resolve current global services.take_rate_pct. Refund clawback is restricted to payments for orders selected in that period (lines 185–205).

Scenario: a fulfilled order edited in next period moves remittance recognition; commission configuration change retroactively changes calculation. Late refund on an already-paid earlier-period order may never appear in current-period clawback. Frozen accepted economics are not consumed here.

Plan: immutable fulfillment/financial recognition event/date and transaction terms snapshot, append-only settlement allocations/adjustments, late refund obligation carried into next open period. Test edit after fulfillment, take-rate change, late refund after payout and provider-collects vs platform-collects.

### O-08 — P1: ledger reversal is repeatable and audit failure creates false failure

Evidence: `src/modules/finance/ledger.service.ts:148–182` loads original and creates adjustment without reversal-of linkage/unique idempotency key. LedgerEntry schema lines 1386–1425 has no reversal identity. `src/app/api/admin/ledger/[entryId]/reverse/route.ts:25–28` commits reversal before audit create; catch returns 500 at lines 53–55.

Scenario: audit sink write fails after reversal; client sees failure and retries, creating second negative adjustment. Concurrent admins can reverse the same original twice. Backdated reversal into original occurredOn can also be inconsistent with already-closed statement adjustment policy if no downstream open-period accounting handles it.

Plan: exact correction identity / reversalOfId, atomic correction+audit/outbox or durable acknowledgment, explicit closed-period adjustment rules. Test duplicate POST, concurrent reverse, audit failure and closed statement. Do not rewrite historical entries.

### O-09 — P1: check-in/out validates stale booking state before acquiring lock

Evidence: `booking.service.ts:737–752` reads and assesses check-in outside unit lock; inside lines 767–793 checks readiness then updates by id without rechecking status/date prerequisites. Checkout reads and verifies checked_in at lines 812–819, locks at 825, then unconditional update.

Scenario: cancellation/date change or another check-in/out changes booking between initial read and lock. Later transition can overwrite newer state or old prerequisite assessment. Advisory lock helps only if every conflicting writer uses same resource key and rechecks after acquiring it.

Plan: locked fresh booking re-read and shared state transition/CAS; define lock ordering unit→booking→payment consistently to avoid deadlocks. Test check-in vs cancellation, double check-out and date move while check-in pending.

### O-10 — P1: attach/remove reservation-group linking can overwrite concurrent association

Evidence: `src/modules/booking/reservation-group.service.ts:91–130` reads booking group then updates by id; remove at 135–147 reads target group then unconditionally clears by id. In contrast createGroup uses conditional updateMany and count validation at lines 62–69.

Scenario: simultaneous attach to two active groups both read null; last update wins, leaving first command acknowledged but its association missing. Remove racing an attach can clear newly selected group.

Plan: conditional update where expected current group/null and same guest/scope; explicit conflict response. Group creation/linking should remain a relationship over canonical Booking, not duplicate inventory.

### O-11 — P1: manual reservation creation and grouping are separate commits, without request identity

Evidence: `src/app/api/ops/reservations/route.ts:144–161` commits createBooking, then `attachBookingToReservationGroup` at 164–168. No Idempotency-Key/client command ID read in route. Booking exclusion prevents duplicate blocking instant holds, but requested reservations intentionally do not block.

Scenario: group attachment fails after successful reservation → 400 implies nothing created. Retry can create duplicate requested Booking, or conflict against successfully created instant hold while operator never received its ID.

Plan: one application transaction or resumable command record returning committed booking with explicit partial group result; stable request id dedup; same command body hash validation. Test response timeout after commit and group changed mid-command.

### O-12 — P2: effective-date scope is incompletely enforced

Evidence: MC reader `src/modules/projects/mc.service.ts:25–49` and guard `src/app/libs/projectScope.ts:77–87` check status active but not UnitEngagement.startsOn/endsOn. OperatingSpace units reader `operating-space.service.ts:62–72` checks endsOn only, not startsOn; task creation/generation have similar filters (operational-task.service.ts:222–230,370–374).

Scenario: future mandate/space-unit relation marked active exposes/operates inventory before effective start; expired mandate remains effective until separate status change. Scheduled status hygiene is not equivalent to server effective-date enforcement.

Plan: shared effective relationship predicate at action time, with timezone/business-date semantics. Test start tomorrow, ends yesterday, renewal overlap and revoked roles with cached session.

### O-13 — P2: cost receipt accepted but not persisted; manual cost replay duplicates fact

Evidence: RecordCostInput includes receiptMediaId (`ledger.service.ts:9`); route forwards it (`src/app/api/ledger/record-cost/route.ts:74`); ledger create lines 24–35 ignores it. Same create has no command identity/deduplication.

Scenario: operator records expense believing receipt attached; evidence is lost. Network retry creates a second expense. Lack of evidence/unique source reference limits accounting reconciliation.

Plan: canonical Expense/cost-evidence relation over ledger fact, private scoped media permission, command id/source reference, reject unauthorized receipt link. Test receipt retrievable by allowed actor and replay same cost once.

## Positive safeguards already implemented

- **Capacity:** createBooking uses per-unit pg_advisory_xact_lock, reasserts Layantara authority inside transaction, expires old holds, checks Booking and BlockedDate, and has retry handling (`booking.service.ts:320–403`). SQL exclusion constraint (`20260818000014_booking_no_overlap_exclusion/migration.sql:48`) is an independent last line of defense. Applied production migration is not verified here.
- **Half-open dates:** booking and block readers use start<requestedEnd/end>requestedStart. Checkout night is reusable. Unit locks serialize manual blocks vs booking (`availability.service.ts:249–290`).
- **Server price:** guest booking recomputes canonical price and caps against accepted maximum (`booking.service.ts:280–315`). Client supplied totals do not own booking money.
- **Payment atomicity:** cash uses booking/order locks and exact amount/payer/status checks; payment+ledger+state commit together (`finance.service.ts:140–225`). Verified provider confirmation locks payment then booking/order, rejects mismatching amount and another succeeded initial payment (`finance.service.ts:465–525`). Mock confirmation forbidden in production (438–446).
- **Checkout readiness generation:** checkout state+turnover upserts commit in one transaction; bookingId/taskType unique protects duplicate canonical turnover tasks (`booking.service.ts:824–850`, schema:2421).
- **Payout atomicity:** payout row and append-only consequence are one transaction (`payout-ledger.service.ts:33–62`); unique owner-statement/provider-period/payout ledger indexes in `20260912010000_payout_ledger_integrity` protect recorded obligation duplication.
- **Event durability:** DB triggers emit booking/block/payment/refund/ledger events within originating transaction (`20260928090000_unified_domain_event_outbox/migration.sql:29–130`). This is stronger than best-effort analytics, but actual migration, consumers, lag and recovery are not proven here.
- **Projection reuse:** shared calendar reads canonical Booking/BlockedDate and delegates rates to canonical quote rather than inventing a second writable calendar/rate table (`ops/calendar/board/page.tsx:180–215`, `canonical-pricing.service.ts:388–421`).

## Scaling and failure-mode analysis

| Load/failure | Current boundary | Risk / next measurement |
|---|---|---|
| 100–1,000 units × 30 nights | Calendar batches price computations 12 units at a time; no portfolio paging; full visible grid (`board/page.tsx:170–192`). | DB quote/config fan-out + serialized batches increase response time; request/connection budgets and P95 measured only after real fixture. Snapshot shared config once per scope/version, bulk rate reader, paginate/collapse hierarchy; preserve canonical quote parity. |
| Day grid every 15 seconds for many staff | Client refresh per tab + event-cursor refresh (`UnifiedStayCalendar.tsx:97–126`). | Thundering refresh across tabs/operators; add jitter/shared invalidation, conditional cursors and scope-bounded rate cache. Do not cache private portfolio across identities. |
| Years of cancelled/stay records | Stay work queue reads all included statuses with no range/take (`ops/stays/page.tsx:43–60`); tasks/readiness broad lists (`operational-task.service.ts:131–176`). | Correctness fix avoids arbitrary truncation, but scalable approach is separate actionable queue + bounded history using state/date predicates and pagination. |
| Payment captured, hold expired/cancelled | verifyAndConfirm rejects non-pending_payment state after provider confirms charge (`finance.service.ts:486`). | Correctly refuses invented booking success, but funds now need durable exception/reconciliation/refund workflow; error text alone is insufficient. Test webhook retries and expired hold after provider charge. |
| Scheduler overlap / downtime | Preventive claim take200, one transaction per plan, sequential task writes per scoped unit. | CAS/occurrence gap above; very large space expansion exceeds transaction timeout and rolls back entire plan. Batch with stable occurrence identity and resumable cursor. |
| Database outage after provider operation | Provider confirmed outside DB tx; ledger transactional only locally. | Pending/unknown external result must be reconciled with stored provider reference; do not blindly reissue refund/capture. Exercise restore plus external statement reconciliation. |
| Simultaneous writes | Lock keys often hashtext(unitId), hashtext(bookingId), hashtext(paymentId). | 32-bit collisions cause accidental serialization; mixed key/order conventions complicate reasoning. Define resource-key namespace and total lock order; instrument conflict/deadlock retry metrics. |
| Resort source unavailable | assertLayantaraBookingAuthority and source exclusion gates exist. | Verify freshness/cutover authority fail-closed through actual source outage fixtures; imported public catalogue/read models do not grant booking write authority. |

## Tests and evidence quality

Executed read-only attempt: seven files requested. **Six files passed, 19 tests passed**: canonical-calendar-rate, pms-readiness, calendar-projection, reservation-desk, operational-task.service, channel-health. `availability.service.test.ts` could not initialize because **DATABASE_URL_TEST is absent**; test utility explicitly prevents accidental live DB use. No substitute production database was used.

- Calendar parity tests use mocked scoped config/records; they establish calculator reuse but not production tariff correctness.
- Reservation desk tests are source/schema assertions, not concurrent booking/group tests.
- Operational task tests are sequential mocks; they do not exercise PostgreSQL isolation, lost updates or overdue dual scheduler claims.
- Existing integration files cover double-booking concurrency, manual blocks, cash/provider confirm, refund/payout, RLS and project scope. Their existence is not a passing result in this audit.
- Missing targeted proof: blocked readiness, maintenance blocksInventory capacity, task PATCH space capabilities, concurrent rate inserts, overdue preventive CAS, reversal retries/audit failure, attach/remove CAS, duplicate manual requested reservation and mutable remittance recognition.
- No full authenticated user journey, migration replay, production permission denial, OTA ARI, source cutoff/restore or live financial reconciliation was run.

## Concrete repair sequence and release criteria

1. **Readiness/capacity vertical slice:** unify readiness predicate, explicit maintenance unavailable interval, canonical task→block linkage. Lock/capacity tests plus denied/blocked check-in. No second occupancy model.
2. **Mutation discipline:** task CAS, preventive occurrence identity/CAS and attach/remove CAS; stable request id for reservation/cost/reversal commands. Expand migration first, reconcile duplicates/overlaps, enforce indexes after safe backfill.
3. **Authorization discipline:** operation-specific shared resolver for legacy staff/MC/OperatingSpace; effective-date predicates on every read/write; fixture matrix two disjoint managers, read-only staff, task assignee, expired member, owner/admin.
4. **Money discipline:** immutable financial recognition/accepted terms; append-only late refunds/closed period corrections; reversal linkage and atomic audit/event. Golden ledger fixtures across retries and failure injection.
5. **Scale slice:** instrument SQL/quote count, DB pool usage, P95 for 39/100/1,000 units and 7/14/30 days; bulk shared read model with private scope cache and canonical parity tests; bounded actionable queues/history.
6. **Production gate:** fresh migration replay/drift check, restoration rehearsal, source authority/data reconciliation, deployed multi-role smoke, exact served commit and rollback evidence. Only then declare single unit/condominium portfolio/resort fully operable.

For this audit: specification/code inspection **partial**, migration/data/config/deployment/runtime **not checked**, permissions **partial**, test evidence **partial**. Code architecture is a viable foundation with named gaps; real deployed resort operating readiness is **not established**.


## Follow-up review: refund identity and completion concurrency

### O-14 — P1: card refund command loses the exact newly-created Refund identity

Evidence: `src/modules/finance/finance.service.ts:591–608` holds a payment advisory lock, validates remaining refund budget and inserts processing Refund, but returns only refundablePayment. Lines 610–613 later rediscover Refund by payment/amount/reason/actor/status with newest createdAt. Lines 618–621 call provider then overwrite providerRefundId on the rediscovered row. Opn adapter (`src/modules/finance/providers/opn.ts:235–244`) posts charge refund with amount; no local Refund command id is supplied as provider idempotency identity.

Confirmed source failure interleaving: remaining budget covers two partial refunds of equal amount. A creates R1 and releases payment lock; B creates R2 and releases it before A's lookup. A and B can both select newest R2, both issue external refunds, and both update R2.providerRefundId, leaving R1 processing and one provider reference lost. The payment lock **does** prevent exceeding reserved local budget in the insertion transaction; it **does not** bind the later provider operation to the inserted row. This is identity corruption even when two refunds were intentionally requested and their combined amount is permitted. No external provider call was executed during audit.

Plan: return `{payment, refund}` directly from transaction and use exact Refund.id throughout; stable external command/idempotency identity where provider supports it, durable provider execution/outcome record and unknown-result reconciliation. Barrier-controlled integration test must force B insertion before A lookup; assert distinct row/provider references and no stranded processing record. Repeat same caller command should return the same Refund, not reserve a second budget slice.

### O-15 — P1: concurrent refund completion can apply booking liability twice despite one ledger consequence

Evidence: `markRefundSucceeded` reads status before any explicit row lock/CAS (`finance.service.ts:635–645`), updates by id regardless of original status (647), conditionally creates ledger only if absent (648–669), but unconditionally invokes applySucceededRefundToBooking (670). Helper reads liability then writes `max(0, old - amount)` at lines 99–106.

Confirmed source interleaving under default PostgreSQL Read Committed: A and B both read processing. A updates Refund, creates refund_out, reduces booking liability and commits. B's unconditional Refund update waits on A's row update and then succeeds; its subsequent ledger query sees A's committed ledger, so it creates **no second refund_out**. Nevertheless B still invokes the liability helper and subtracts this same Refund amount again from the now-reduced accrual. Thus the existing ledger check can prevent a duplicate ledger row in this interleaving while **not** preventing duplicate financial-state application. If initial accrual is greater than this partial refund, the result understates outstanding refund obligation; the zero clamp conceals rather than repairs overapplication. Separately, two different refund completions can lose a subtraction through the helper's booking read/overwrite when their refund-row locks are disjoint.

Plan: lock/CAS Refund status and let only the winner apply all consequences in one transaction; serialize booking liability changes or derive outstanding liability from immutable accrual and succeeded-refund allocations. Use stable refund allocation identity and DB uniqueness for refund_out as an additional defense, not a substitute for transition ownership. Test duplicate webhook completion concurrently with liability larger than refund, then concurrent distinct partial refunds; assert one financial application per Refund, exact remaining liability and one refund_out per Refund. No production completion was invoked.
