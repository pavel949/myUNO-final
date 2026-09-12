# READINESS_ACCEPTANCE.md — Capability Evidence and AT01–AT30

## Readiness dimensions
For every capability report separately:
- specification_complete
- code_present
- migration_applied
- data_config_ready
- permission_verified
- ui_reachable
- critical_test_passed
- deployed
- runtime_checked

Values: `verified / partial / failed / not checked / not applicable`.

No synthetic overall score may hide a P0 failure.

## Acceptance scenarios
AT01 Standalone customer orders a service without stay/unit.  
AT02 Guest orders a service tied to own stay; foreign booking ID rejected; entitlement not double-charged.  
AT03 Same provider in two properties with separate terms and no data leakage.  
AT04 Fixed/hourly/per-person/quote pricing keeps quantity, duration and capacity separate.  
AT05 Two customers compete for last capacity; no over-allocation.  
AT06 Retry after timeout with same idempotency key creates one order/intent.  
AT07 Fulfillment races cancellation; one valid outcome and earning.  
AT08 Dispute races close/auto-close; no illegal closed + blocking-dispute state.  
AT09 Reschedule with price delta/payment failure preserves capacity correctly.  
AT10 Provider decline/no-show reaches replacement/refund workflow.  
AT11 Partial goods delivery/substitution reconciles inventory/refund/commission by line.  
AT12 Recurring pause/skip + worker retry does not duplicate occurrence/charge.  
AT13 Commission default changes after order; accepted snapshot remains.  
AT14 Closed order + dispute + late refund + payout periods do not double-pay.  
AT15 Provider collects; platform records correct commission receivable, not duplicate gross payable.  
AT16 New unit in existing development reuses project and completes invite/gallery/pricing/readiness.  
AT17 Bulk import duplicate/error/retry is dry-run capable and idempotent.  
AT18 Alternate 1BR/2BR configurations of one villa share capacity.  
AT19 Search→quote→booking→extension across season boundary uses one pricing engine.  
AT20 Owner-self-managed and partner-managed boundaries enforced and public disclosure truthful.  
AT21 Lead→proposal→won→handover links one Identity to downstream transaction.  
AT22 CRM totals are scope-wide before pagination and metric formulas hold.  
AT23 Manager creates staff; password change/revoke/reassignment work; privilege escalation blocked.  
AT24 Checkout→cleaning→inspection→readiness preserves maintenance blockers.  
AT25 Layantara replay/out-of-order/environment collision does not duplicate/regress.  
AT26 Authority PMS/channel unavailable: no false instant confirmation; fallback/recovery queue exists.  
AT27 Ownership/operator change preserves historical beneficiaries/statements and applies effective-date rights.  
AT28 Owner/partner/provider foreign-ID attempts across API/SSR/media/search/export/aggregate are denied.  
AT29 RU/EN/TH + mobile + keyboard + slow network: no lost fields, false empty states or critical untranslated path.  
AT30 Restore + migration rehearsal + webhook/job replay recovers within documented objectives without duplicated side effects.

## Evidence format
For each AT: environment; commit/deployment; non-sensitive test IDs; steps; result; screenshots/log references where appropriate; status; blocker; owner; next action.

Do not mark passed merely because a matching route/model/test file exists.
