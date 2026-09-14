# DECISIONS_CHANGELOG.md — Canonical Changes in v3

## Added from the reviewed founder prompt
1. Vendor-neutral agent language; no dependency on Claude.
2. Standalone Phuket service/product ordering without property/stay requirement.
3. Explicit separation of commercial, fulfillment, payment, dispute, settlement and closure states.
4. Frozen transaction/line commercial terms and settlement allocations.
5. Provider-collects vs myUNO-collects accounting distinction.
6. Reschedule, replacement provider, partial fulfillment and dispute-concurrency requirements.
7. Products/SKU/stock/delivery/rentals/packages/recurring-service extension model.
8. CO01–CO30 company process map.
9. CRM as a daily operating workspace with pipeline-specific fields and next-action discipline.
10. Exact role/workspace definitions.
11. Environment-safe external mappings/events.
12. Safer migration-repair policy and explicit restore/reconciliation protocol.
13. Capability readiness dimensions rather than one readiness percentage.
14. AT01–AT30 end-to-end acceptance suite.
15. Six-stage user-facing property onboarding with autosave/import/inheritance.
16. Physical shared-capacity rule for alternate commercial configurations of one villa/unit.
17. Explicit fallback when authority PMS/channel is unavailable.
18. Stronger privacy boundary for global Identity with scoped CRM.
19. Public UX hierarchy focused on practical value rather than audience cards.
20. Content/localization and real-supply readiness requirements.

## Clarified/superseded
- One Identity does not mean cross-organization visibility.
- Collection is not authority or physical inventory source.
- Pricing authority is scoped: each unit/time/function has one effective writer even when different operators use different systems.
- Layantara read integration does not grant booking write authority.
- myUNO services are broader than property-linked concierge.
- A donor/legacy services repo is optional evidence, not a required dependency.
- Public redesign does not outrank P0 money/migration/order correctness.

## Commercial decisions requiring real evidence
- seller/merchant/collector by category;
- provider payout timing;
- service/product categories enabled at launch;
- expense/refund approval thresholds;
- Layantara command authority;
- current applicable rate/tax rules by scope.

The architecture must support these choices without inventing them.
