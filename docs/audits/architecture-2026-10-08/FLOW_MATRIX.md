# CO/AT coverage boundaries

Focused architectural assessment; no process E2E is marked complete. Nine columns use canonical evidence vocabulary. Specification/code/permission/test are partial only when the reporttraces related seams; applied DB/config/fullUI/runtime remain not checked. Deployment verified for assessed main source, not full process readiness.

| ID | Scenario | Spec | Code | Migration | Data/config | Permission | UI | Critical test | Deployed | Runtime | Related findings |
|---|---|---|---|---|---|---|---|---|---|---|---|
| CO01 | Lead intake and first action | not checked | not checked | not checked | not checked | not checked | not checked | not checked | verified | not checked | Not traced as full vertical slice |
| CO02 | Qualification to conversion | not checked | not checked | not checked | not checked | not checked | not checked | not checked | verified | not checked | Not traced as full vertical slice |
| CO03 | External partner sourcing | not checked | not checked | not checked | not checked | not checked | not checked | not checked | verified | not checked | Not traced as full vertical slice |
| CO04 | Owner acquisition | not checked | not checked | not checked | not checked | not checked | not checked | not checked | verified | not checked | Not traced as full vertical slice |
| CO05 | Property/unit onboarding | not checked | not checked | not checked | not checked | not checked | not checked | not checked | verified | not checked | Not traced as full vertical slice |
| CO06 | Rate and distribution change | partial | partial | not checked | not checked | partial | not checked | not checked | verified | not checked | SEC02/O06/DEST07 |
| CO07 | Stay booking | partial | partial | not checked | not checked | partial | not checked | partial | verified | not checked | funnel/booking safeguards |
| CO08 | Pre-arrival | not checked | not checked | not checked | not checked | not checked | not checked | not checked | verified | not checked | Not traced as full vertical slice |
| CO09 | Check-in | partial | partial | not checked | not checked | partial | not checked | not checked | verified | not checked | O01/O09 |
| CO10 | In-stay request | not checked | not checked | not checked | not checked | not checked | not checked | not checked | verified | not checked | Not traced as full vertical slice |
| CO11 | Housekeeping | partial | partial | not checked | not checked | partial | not checked | not checked | verified | not checked | O01/O03 |
| CO12 | Maintenance | partial | partial | not checked | not checked | partial | not checked | not checked | verified | not checked | O02/O04 |
| CO13 | F&B | not checked | not checked | not checked | not checked | not checked | not checked | not checked | verified | not checked | Not traced as full vertical slice |
| CO14 | Service/product/rental order | partial | partial | not checked | not checked | partial | not checked | not checked | verified | not checked | standalonefunnel/settlement |
| CO15 | Checkout | partial | partial | not checked | not checked | partial | not checked | not checked | verified | not checked | O09/turnover |
| CO16 | Cancellation/reschedule/extension/no-show | not checked | not checked | not checked | not checked | not checked | not checked | not checked | verified | not checked | Not traced as full vertical slice |
| CO17 | Complaint/incident/dispute | not checked | not checked | not checked | not checked | not checked | not checked | not checked | verified | not checked | Not traced as full vertical slice |
| CO18 | Procurement | not checked | not checked | not checked | not checked | not checked | not checked | not checked | verified | not checked | Not traced as full vertical slice |
| CO19 | Period financial close | partial | partial | not checked | not checked | partial | not checked | not checked | verified | not checked | O07/O08/refund |
| CO20 | Owner approval / capex | not checked | not checked | not checked | not checked | not checked | not checked | not checked | verified | not checked | Not traced as full vertical slice |
| CO21 | Owner stay | not checked | not checked | not checked | not checked | not checked | not checked | not checked | verified | not checked | Not traced as full vertical slice |
| CO22 | Staff lifecycle | partial | partial | not checked | not checked | partial | not checked | not checked | verified | not checked | SEC03–04 |
| CO23 | Provider lifecycle | not checked | not checked | not checked | not checked | not checked | not checked | not checked | verified | not checked | Not traced as full vertical slice |
| CO24 | Content/media lifecycle | partial | partial | not checked | not checked | partial | not checked | not checked | verified | not checked | funnelcontent/SEC13 |
| CO25 | Standards | not checked | not checked | not checked | not checked | not checked | not checked | not checked | verified | not checked | Not traced as full vertical slice |
| CO26 | Guest to buyer to owner | not checked | not checked | not checked | not checked | not checked | not checked | not checked | verified | not checked | Not traced as full vertical slice |
| CO27 | Ownership/operator change | partial | partial | not checked | not checked | partial | not checked | not checked | verified | not checked | O12/DEST05 |
| CO28 | Property/partner offboarding | not checked | not checked | not checked | not checked | not checked | not checked | not checked | verified | not checked | Not traced as full vertical slice |
| CO29 | Integration failure/recovery | partial | partial | not checked | not checked | partial | not checked | partial | verified | not checked | I01–04/DEST11 |
| CO30 | Leadership period review | not checked | not checked | not checked | not checked | not checked | not checked | not checked | verified | not checked | Not traced as full vertical slice |
| AT01 | Standalone customer orders a service without stay/unit. | partial | partial | not checked | not checked | partial | not checked | not checked | verified | not checked | standalone missing |
| AT02 | Guest orders a service tied to own stay; foreign booking ID rejected; entitlement not double-charged. | not checked | not checked | not checked | not checked | not checked | not checked | not checked | verified | not checked | Not traced as full vertical slice |
| AT03 | Same provider in two properties with separate terms and no data leakage. | not checked | not checked | not checked | not checked | not checked | not checked | not checked | verified | not checked | Not traced as full vertical slice |
| AT04 | Fixed/hourly/per-person/quote pricing keeps quantity, duration and capacity separate. | not checked | not checked | not checked | not checked | not checked | not checked | not checked | verified | not checked | Not traced as full vertical slice |
| AT05 | Two customers compete for last capacity; no over-allocation. | not checked | not checked | not checked | not checked | not checked | not checked | not checked | verified | not checked | Not traced as full vertical slice |
| AT06 | Retry after timeout with same idempotency key creates one order/intent. | partial | partial | not checked | not checked | partial | not checked | not checked | verified | not checked | O11/O13 |
| AT07 | Fulfillment races cancellation; one valid outcome and earning. | not checked | not checked | not checked | not checked | not checked | not checked | not checked | verified | not checked | Not traced as full vertical slice |
| AT08 | Dispute races close/auto-close; no illegal closed + blocking-dispute state. | not checked | not checked | not checked | not checked | not checked | not checked | not checked | verified | not checked | Not traced as full vertical slice |
| AT09 | Reschedule with price delta/payment failure preserves capacity correctly. | not checked | not checked | not checked | not checked | not checked | not checked | not checked | verified | not checked | Not traced as full vertical slice |
| AT10 | Provider decline/no-show reaches replacement/refund workflow. | not checked | not checked | not checked | not checked | not checked | not checked | not checked | verified | not checked | Not traced as full vertical slice |
| AT11 | Partial goods delivery/substitution reconciles inventory/refund/commission by line. | not checked | not checked | not checked | not checked | not checked | not checked | not checked | verified | not checked | Not traced as full vertical slice |
| AT12 | Recurring pause/skip + worker retry does not duplicate occurrence/charge. | partial | partial | not checked | not checked | partial | not checked | not checked | verified | not checked | O04 |
| AT13 | Commission default changes after order; accepted snapshot remains. | partial | partial | not checked | not checked | partial | not checked | not checked | verified | not checked | O07 |
| AT14 | Closed order + dispute + late refund + payout periods do not double-pay. | partial | partial | not checked | not checked | partial | not checked | not checked | verified | not checked | O07/O08 |
| AT15 | Provider collects; platform records correct commission receivable, not duplicate gross payable. | not checked | not checked | not checked | not checked | not checked | not checked | not checked | verified | not checked | Not traced as full vertical slice |
| AT16 | New unit in existing development reuses project and completes invite/gallery/pricing/readiness. | not checked | not checked | not checked | not checked | not checked | not checked | not checked | verified | not checked | Not traced as full vertical slice |
| AT17 | Bulk import duplicate/error/retry is dry-run capable and idempotent. | not checked | not checked | not checked | not checked | not checked | not checked | not checked | verified | not checked | Not traced as full vertical slice |
| AT18 | Alternate 1BR/2BR configurations of one villa share capacity. | not checked | not checked | not checked | not checked | not checked | not checked | not checked | verified | not checked | Not traced as full vertical slice |
| AT19 | Search→quote→booking→extension across season boundary uses one pricing engine. | partial | partial | not checked | not checked | partial | not checked | partial | verified | not checked | funnelpricing |
| AT20 | Owner-self-managed and partner-managed boundaries enforced and public disclosure truthful. | not checked | not checked | not checked | not checked | not checked | not checked | not checked | verified | not checked | Not traced as full vertical slice |
| AT21 | Lead→proposal→won→handover links one Identity to downstream transaction. | not checked | not checked | not checked | not checked | not checked | not checked | not checked | verified | not checked | Not traced as full vertical slice |
| AT22 | CRM totals are scope-wide before pagination and metric formulas hold. | not checked | not checked | not checked | not checked | not checked | not checked | not checked | verified | not checked | Not traced as full vertical slice |
| AT23 | Manager creates staff; password change/revoke/reassignment work; privilege escalation blocked. | partial | partial | not checked | not checked | partial | not checked | not checked | verified | not checked | SEC02–04 |
| AT24 | Checkout→cleaning→inspection→readiness preserves maintenance blockers. | partial | partial | not checked | not checked | partial | not checked | not checked | verified | not checked | O01/O02 |
| AT25 | Layantara replay/out-of-order/environment collision does not duplicate/regress. | partial | partial | not checked | not checked | partial | not checked | partial | verified | not checked | federationguards |
| AT26 | Authority PMS/channel unavailable: no false instant confirmation; fallback/recovery queue exists. | partial | partial | not checked | not checked | partial | not checked | not checked | verified | not checked | source authority |
| AT27 | Ownership/operator change preserves historical beneficiaries/statements and applies effective-date rights. | partial | partial | not checked | not checked | partial | not checked | not checked | verified | not checked | O12 |
| AT28 | Owner/partner/provider foreign-ID attempts across API/SSR/media/search/export/aggregate are denied. | partial | partial | not checked | not checked | partial | not checked | partial | verified | not checked | SEC02/O05 |
| AT29 | RU/EN/TH + mobile + keyboard + slow network: no lost fields, false empty states or critical untranslated path. | partial | partial | not checked | not checked | partial | not checked | not checked | verified | not checked | funnelstates/Stitch limits |
| AT30 | Restore + migration rehearsal + webhook/job replay recovers within documented objectives without duplicated side effects. | partial | partial | not checked | not checked | partial | not checked | not checked | verified | not checked | I01–06/SEC06 |
