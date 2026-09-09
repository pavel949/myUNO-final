# PROCESS_MAP.md — Canonical Company Process Map

Every process must be implemented/spec'd with this passport:

```text
Process ID
User job / outcome
Trigger
Participants and fallback owner
Scope and permissions
Inputs and validation
Happy path
State transitions
SLA / timezone
Money
Communications
Exceptions
Completion evidence
Handover / next process
Primary route/screen
Loading/empty/error/permission states
Acceptance scenario
```

## CO01 — Lead intake and first action
Channel/campaign → lead → match/create Identity → responsible inbox → owner assignment → first qualifying action. Completion: contact/CRM profile and, where appropriate, opportunity with next action. Never drop a lead because no assignee exists yet.

## CO02 — Qualification to conversion
Requirements → qualification → shortlist/proposal → quote → negotiation → accepted commercial result. Handover may be Booking, ServiceOrder, Mandate/Onboarding, Referral or another typed transaction.

## CO03 — External partner sourcing
No suitable internal offer → sourcing request → partner terms → customer proposal → fulfillment evidence → referral/commission receivable. External property/service is not silently converted into managed inventory.

## CO04 — Owner acquisition
Lead → property context → inspection/qualification → management model → commercial proposal → contract/mandate → onboarding case.

## CO05 — Property/unit onboarding
Draft → identity/asset → owner/authority → pricing/compliance/content → operations/team/services → readiness → approved/live capability.

## CO06 — Rate and distribution change
Rule proposal → preview → authority validation → approval if required → version activation → distribution sync → health check.

## CO07 — Stay booking
Search → canonical quote → availability hold → identity → payment/request → confirmation → arrival work.

## CO08 — Pre-arrival
Confirmed stay → guest details → ETA/transfer/services → payment/access prerequisites → housekeeping/maintenance readiness → blocker ownership.

## CO09 — Check-in
Arrival → identity/compliance where applicable → readiness check → access release → welcome → checked-in event/evidence.

## CO10 — In-stay request
Request → triage → task/service order/case → acknowledgment SLA → execution → verification → guest-visible resolution.

## CO11 — Housekeeping
Turnover/recurring entitlement → assignment → checklist → exception → supervisor verification where required → readiness contribution. Cleaning complete is not automatically villa-ready; maintenance/access blockers remain independent.

## CO12 — Maintenance
Preventive/reactive trigger → diagnosis → impact/blocking → estimate → approval threshold → parts/vendor → repair → evidence → inspection/reopen.

## CO13 — F&B
Order/entitlement → pax/allergy/access data → kitchen/vendor assignment → production/delivery → completion → money/stock/waste record as applicable. Do not invent restaurant/menu/capacity that is not configured.

## CO14 — Service/product/rental order
Need → offer/quote → terms acceptance → funding → resource/provider → fulfillment → acceptance/problem → settlement.

## CO15 — Checkout
Departure → access return → inspection → claim/problem if any → final finance → turnover → post-stay.

## CO16 — Cancellation/reschedule/extension/no-show
Change command → policy snapshot → capacity check → price delta → funding/refund → linked services reconciliation → final state.

## CO17 — Complaint/incident/dispute
Open case → preserve evidence → responsible approver → investigate → decision → remedy/refund/adjustment → close/reopen rules.

## CO18 — Procurement
Requisition → supplier quote → approval → purchase → partial/full receipt → discrepancy → invoice/payable → payment/reconciliation.

## CO19 — Period financial close
Transactions → receipts → refunds → earnings/fees/costs → obligations → statements → sign-off → allocations/payout → reconciliation exceptions.

## CO20 — Owner approval / capex
Need → owner context → estimate/budget → approval/decline → procurement/work → evidence → finance/asset history.

## CO21 — Owner stay
Owner request → ownership/effective authority → availability → block/booking → services/cleaning → stay → turnover.

## CO22 — Staff lifecycle
Create/invite → membership → role/scope → shift/work → password/reset → suspend/deactivate → session revoke → task/account reassignment.

## CO23 — Provider lifecycle
Application → organization resolution → categories/coverage → documents → commercial terms → payout → vetting → active → monitor → suspend/offboard.

## CO24 — Content/media lifecycle
Create → rights/provenance → localize → review → publish → freshness review → archive/update.

## CO25 — Standards
Standard version → applicability → evidence → assessment → exception → corrective task → reassess → public endorsement if eligible.

## CO26 — Guest to buyer to owner
Guest relationship → qualified property interest → opportunity → viewing/diligence → transaction milestone → legal ownership evidence → management relationship. CRM stage alone never creates ownership.

## CO27 — Ownership/operator change
Effective-date change → future obligations → authority cutover → access/session updates → booking/service responsibility → finance/settlement split → historical preservation.

## CO28 — Property/partner offboarding
Decision → future guest/owner obligations → provider/work closure → export/handover → access revoke → financial reconciliation → archive.

## CO29 — Integration failure/recovery
Detection → affected scope → queue/fallback → operator alert → retry/reconcile → replay/dedup → recovery evidence → root cause.

## CO30 — Leadership period review
Portfolio facts → exceptions → CRM/pipeline → money → standards → provider/network → decisions → action owners/deadlines → follow-up.

## Implementation rule
A process is not specified merely because a module/table exists. Every CO process needs exact transition matrix, permission checks, transaction boundaries, failure/retry behavior, user-visible status, event/evidence and next-process handover.
