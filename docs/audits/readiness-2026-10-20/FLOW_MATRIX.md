# Capability / process acceptance ledger

Statuses: verified, partial, failed, not checked, not applicable. Static existence is not process completion. Nine dimensions are kept separately. Specification=partial means acceptance requirements exist but were not proven complete. Code=partial means matching domain/surface exists, not that all passport requirements were traced. CI evidence is aggregate and is not automatically attributed to every AT/CO.

| Capability | Specification | Code | Migration | Data/config | Permissions | UI reachable | Critical tests | Deployed | Runtime |
|---|---|---|---|---|---|---|---|---|---|
| Property/onboarding/media | partial | partial | not checked | not checked | not checked | not checked | partial | partial | not checked |
| Booking/pricing/physical capacity | partial | partial | not checked | not checked | not checked | not checked | partial | partial | not checked |
| Services/provider | partial | partial | not checked | not checked | not checked | not checked | partial | partial | not checked |
| Owner/manager/staff | partial | partial | not checked | not checked | not checked | not checked | partial | partial | not checked |
| Trust/compliance/tenancy | partial | partial | not checked | not checked | not checked | not checked | partial | partial | not checked |
| Finance/payment/settlement | partial | partial | not checked | not checked | not checked | not checked | partial | partial | not checked |
| CRM/sales/lease | partial | partial | not checked | not checked | not checked | not checked | partial | partial | not checked |
| Backup/integration/recovery | partial | partial | not checked | not checked | not checked | not checked | partial | partial | not checked |

Deployed=partial reflects verified older production source, not deployment of every latest change. Backup critical evidence is separately documented in RELEASE_EVIDENCE.md. No capability has all nine dimensions verified.

| ID | Requirement | Specification | Code | Migration | Data/config | Permission | UI | Critical test | Deploy | Runtime |
|---|---|---|---|---|---|---|---|---|---|---|
| CO01 | Lead intake and first action | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| CO02 | Qualification to conversion | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| CO03 | External partner sourcing | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| CO04 | Owner acquisition | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| CO05 | Property/unit onboarding | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| CO06 | Rate and distribution change | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| CO07 | Stay booking | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| CO08 | Pre-arrival | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| CO09 | Check-in | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| CO10 | In-stay request | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| CO11 | Housekeeping | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| CO12 | Maintenance | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| CO13 | F&B | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| CO14 | Service/product/rental order | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| CO15 | Checkout | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| CO16 | Cancellation/reschedule/extension/no-show | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| CO17 | Complaint/incident/dispute | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| CO18 | Procurement | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| CO19 | Period financial close | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| CO20 | Owner approval / capex | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| CO21 | Owner stay | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| CO22 | Staff lifecycle | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| CO23 | Provider lifecycle | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| CO24 | Content/media lifecycle | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| CO25 | Standards | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| CO26 | Guest to buyer to owner | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| CO27 | Ownership/operator change | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| CO28 | Property/partner offboarding | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| CO29 | Integration failure/recovery | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| CO30 | Leadership period review | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| AT01 | Standalone customer orders a service without stay/unit. | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| AT02 | Guest orders a service tied to own stay; foreign booking ID rejected; entitlement not double-charged. | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| AT03 | Same provider in two properties with separate terms and no data leakage. | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| AT04 | Fixed/hourly/per-person/quote pricing keeps quantity, duration and capacity separate. | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| AT05 | Two customers compete for last capacity; no over-allocation. | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| AT06 | Retry after timeout with same idempotency key creates one order/intent. | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| AT07 | Fulfillment races cancellation; one valid outcome and earning. | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| AT08 | Dispute races close/auto-close; no illegal closed + blocking-dispute state. | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| AT09 | Reschedule with price delta/payment failure preserves capacity correctly. | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| AT10 | Provider decline/no-show reaches replacement/refund workflow. | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| AT11 | Partial goods delivery/substitution reconciles inventory/refund/commission by line. | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| AT12 | Recurring pause/skip + worker retry does not duplicate occurrence/charge. | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| AT13 | Commission default changes after order; accepted snapshot remains. | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| AT14 | Closed order + dispute + late refund + payout periods do not double-pay. | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| AT15 | Provider collects; platform records correct commission receivable, not duplicate gross payable. | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| AT16 | New unit in existing development reuses project and completes invite/gallery/pricing/readiness. | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| AT17 | Bulk import duplicate/error/retry is dry-run capable and idempotent. | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| AT18 | Alternate 1BR/2BR configurations of one villa share capacity. | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| AT19 | Search→quote→booking→extension across season boundary uses one pricing engine. | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| AT20 | Owner-self-managed and partner-managed boundaries enforced and public disclosure truthful. | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| AT21 | Lead→proposal→won→handover links one Identity to downstream transaction. | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| AT22 | CRM totals are scope-wide before pagination and metric formulas hold. | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| AT23 | Manager creates staff; password change/revoke/reassignment work; privilege escalation blocked. | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| AT24 | Checkout→cleaning→inspection→readiness preserves maintenance blockers. | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| AT25 | Layantara replay/out-of-order/environment collision does not duplicate/regress. | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| AT26 | Authority PMS/channel unavailable: no false instant confirmation; fallback/recovery queue exists. | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| AT27 | Ownership/operator change preserves historical beneficiaries/statements and applies effective-date rights. | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| AT28 | Owner/partner/provider foreign-ID attempts across API/SSR/media/search/export/aggregate are denied. | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| AT29 | RU/EN/TH + mobile + keyboard + slow network: no lost fields, false empty states or critical untranslated path. | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| AT30 | Restore + migration rehearsal + webhook/job replay recovers within documented objectives without duplicated side effects. | partial | not checked | not checked | not checked | not checked | not checked | not checked | not checked | not checked |

No per-process pass is assigned from a filename or aggregate green CI. Complete passport tracing and scoped runtime evidence are required to advance these rows.
