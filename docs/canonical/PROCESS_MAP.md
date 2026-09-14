# PROCESS_MAP.md — Canonical Company Process Map

This file is the canonical process catalog. The executable contract for every process is in [`PROCESS_PASSPORTS.md`](./PROCESS_PASSPORTS.md). Each CO01–CO30 implementation MUST comply with its corresponding passport before it may be marked complete.

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
Transaction boundary
Idempotency / retry
Completion evidence
Handover / next process
Primary route/screen
Loading/empty/error/permission states
Acceptance scenario
```

## CO01 — Lead intake and first action
Channel/campaign → lead → match/create Identity → responsible inbox → owner assignment → first qualifying action. Completion: contact/CRM profile and, where appropriate, opportunity with next action. Never drop a lead because no assignee exists yet. **Passport:** `PROCESS_PASSPORTS.md#co01--lead-intake-and-first-action`.

## CO02 — Qualification to conversion
Requirements → qualification → shortlist/proposal → quote → negotiation → accepted commercial result. Handover may be Booking, ServiceOrder, Mandate/Onboarding, Referral or another typed transaction. **Passport:** `PROCESS_PASSPORTS.md#co02--qualification-to-conversion`.

## CO03 — External partner sourcing
No suitable internal offer → sourcing request → partner terms → customer proposal → fulfillment evidence → referral/commission receivable. External property/service is not silently converted into managed inventory. **Passport:** `PROCESS_PASSPORTS.md#co03--external-partner-sourcing`.

## CO04 — Owner acquisition
Lead → property context → inspection/qualification → management model → commercial proposal → contract/mandate → onboarding case. **Passport:** `PROCESS_PASSPORTS.md#co04--owner-acquisition`.

## CO05 — Property/unit onboarding
Draft → identity/asset → owner/authority → pricing/compliance/content → operations/team/services → readiness → approved/live capability. **Passport:** `PROCESS_PASSPORTS.md#co05--propertyunit-onboarding`.

## CO06 — Rate and distribution change
Rule proposal → preview → authority validation → approval if required → version activation → distribution sync → health check. **Passport:** `PROCESS_PASSPORTS.md#co06--rate-and-distribution-change`.

## CO07 — Stay booking
Search → canonical quote → availability hold → identity → payment/request → confirmation → arrival work. **Passport:** `PROCESS_PASSPORTS.md#co07--stay-booking`.

## CO08 — Pre-arrival
Confirmed stay → guest details → ETA/transfer/services → payment/access prerequisites → housekeeping/maintenance readiness → blocker ownership. **Passport:** `PROCESS_PASSPORTS.md#co08--pre-arrival`.

## CO09 — Check-in
Arrival → identity/compliance where applicable → readiness check → access release → welcome → checked-in event/evidence. **Passport:** `PROCESS_PASSPORTS.md#co09--check-in`.

## CO10 — In-stay request
Request → triage → task/service order/case → acknowledgment SLA → execution → verification → guest-visible resolution. **Passport:** `PROCESS_PASSPORTS.md#co10--in-stay-request`.

## CO11 — Housekeeping
Turnover/recurring entitlement → assignment → checklist → exception → supervisor verification where required → readiness contribution. Cleaning complete is not automatically villa-ready; maintenance/access blockers remain independent. **Passport:** `PROCESS_PASSPORTS.md#co11--housekeeping`.

## CO12 — Maintenance
Preventive/reactive trigger → diagnosis → impact/blocking → estimate → approval threshold → parts/vendor → repair → evidence → inspection/reopen. **Passport:** `PROCESS_PASSPORTS.md#co12--maintenance`.

## CO13 — F&B
Order/entitlement → pax/allergy/access data → kitchen/vendor assignment → production/delivery → completion → money/stock/waste record as applicable. Do not invent restaurant/menu/capacity that is not configured. **Passport:** `PROCESS_PASSPORTS.md#co13--fb`.

## CO14 — Service/product/rental order
Need → offer/quote → terms acceptance → funding → resource/provider → fulfillment → acceptance/problem → settlement. **Passport:** `PROCESS_PASSPORTS.md#co14--serviceproductrental-order`.

## CO15 — Checkout
Departure → access return → inspection → claim/problem if any → final finance → turnover → post-stay. **Passport:** `PROCESS_PASSPORTS.md#co15--checkout`.

## CO16 — Cancellation/reschedule/extension/no-show
Change command → policy snapshot → capacity check → price delta → funding/refund → linked services reconciliation → final state. **Passport:** `PROCESS_PASSPORTS.md#co16--cancellationrescheduleextensionno-show`.

## CO17 — Complaint/incident/dispute
Open case → preserve evidence → responsible approver → investigate → decision → remedy/refund/adjustment → close/reopen rules. **Passport:** `PROCESS_PASSPORTS.md#co17--complaintincidentdispute`.

## CO18 — Procurement
Requisition → supplier quote → approval → purchase → partial/full receipt → discrepancy → invoice/payable → payment/reconciliation. **Passport:** `PROCESS_PASSPORTS.md#co18--procurement`.

## CO19 — Period financial close
Transactions → receipts → refunds → earnings/fees/costs → obligations → statements → sign-off → allocations/payout → reconciliation exceptions. **Passport:** `PROCESS_PASSPORTS.md#co19--period-financial-close`.

## CO20 — Owner approval / capex
Need → owner context → estimate/budget → approval/decline → procurement/work → evidence → finance/asset history. **Passport:** `PROCESS_PASSPORTS.md#co20--owner-approval--capex`.

## CO21 — Owner stay
Owner request → ownership/effective authority → availability → block/booking → services/cleaning → stay → turnover. **Passport:** `PROCESS_PASSPORTS.md#co21--owner-stay`.

## CO22 — Staff lifecycle
Create/invite → membership → role/scope → shift/work → password/reset → suspend/deactivate → session revoke → task/account reassignment. **Passport:** `PROCESS_PASSPORTS.md#co22--staff-lifecycle`.

## CO23 — Provider lifecycle
Application → organization resolution → categories/coverage → documents → commercial terms → payout → vetting → active → monitor → suspend/offboard. **Passport:** `PROCESS_PASSPORTS.md#co23--provider-lifecycle`.

## CO24 — Content/media lifecycle
Create → rights/provenance → localize → review → publish → freshness review → archive/update. **Passport:** `PROCESS_PASSPORTS.md#co24--contentmedia-lifecycle`.

## CO25 — Standards
Standard version → applicability → evidence → assessment → exception → corrective task → reassess → public endorsement if eligible. **Passport:** `PROCESS_PASSPORTS.md#co25--standards`.

## CO26 — Guest to buyer to owner
Guest relationship → qualified property interest → opportunity → viewing/diligence → transaction milestone → legal ownership evidence → management relationship. CRM stage alone never creates ownership. **Passport:** `PROCESS_PASSPORTS.md#co26--guest-to-buyer-to-owner`.

## CO27 — Ownership/operator change
Effective-date change → future obligations → authority cutover → access/session updates → booking/service responsibility → finance/settlement split → historical preservation. **Passport:** `PROCESS_PASSPORTS.md#co27--ownershipoperator-change`.

## CO28 — Property/partner offboarding
Decision → future guest/owner obligations → provider/work closure → export/handover → access revoke → financial reconciliation → archive. **Passport:** `PROCESS_PASSPORTS.md#co28--propertypartner-offboarding`.

## CO29 — Integration failure/recovery
Detection → affected scope → queue/fallback → operator alert → retry/reconcile → replay/dedup → recovery evidence → root cause. **Passport:** `PROCESS_PASSPORTS.md#co29--integration-failurerecovery`.

## CO30 — Leadership period review
Portfolio facts → exceptions → CRM/pipeline → money → standards → provider/network → decisions → action owners/deadlines → follow-up. **Passport:** `PROCESS_PASSPORTS.md#co30--leadership-period-review`.

## Implementation rule
A process is not specified merely because a module/table exists. Every CO process must satisfy its passport's transition, permission, transaction, retry, user-visible status, event/evidence, money and handover requirements and map them to at least one E2E acceptance scenario.