# RECONCILIATION.md — Baseline Findings to Recheck at Current HEAD

These findings were observed against a prior repository state. Before implementation, revalidate current HEAD/open PRs and classify each as `still valid / already fixed / partially fixed / not verified`.

- **F01** Service orders are project-context dependent; target requires standalone customer commerce.
- **F02** ServiceProject is too thin for property-specific commercial terms.
- **F03** Quantity handling risks conflating quantity, duration and participant count; quote needs a full versioned contract.
- **F04** Order closure/completion was not confirmed in baseline main; recheck PR #63/current HEAD.
- **F05** Commission accrual and provider remittance must use the same accepted terms snapshot.
- **F06** Remittance eligibility must not depend on generic `updatedAt` or one narrow current status.
- **F07** Fulfillment state + earning creation must be atomic/idempotent.
- **F08** Dispute/ticket creation and acceptance window need atomic policy-aware handling.
- **F09** Reschedule requires first-class workflow, not cancel-and-recreate.
- **F10** Physical goods/SKU/stock/delivery model was absent in baseline; add only as real supply requires.
- **F11** Owner onboarding must support safe exact match, draft Party creation and invitation.
- **F12** Legacy unit pricing fields and RatePlan have overlapping readers/writers; require canonical cutover.
- **F13** CRM summary metrics require formula/scope/naming correction.
- **F14** CRM aggregates must be computed before pagination over permitted scope.
- **F15** Build/install migration-history mutation is unsafe normal deployment behavior.
- **F16** External mapping/event dedup must include environment via external_system_id.
- **F17** Standalone commerce, logistics and separated commercial states need full contracts.
- **F18** Onboarding should expose six user-facing stages, autosave, templates, inheritance and actionable readiness.
- **F19** Service catalog content/localization/supply must be verified; seed IDs alone do not prove fake supply.
- **F20** Public homepage needs real property imagery, practical-value hierarchy and localization/content review.

## Agent rule
Before touching a finding: locate current code; check HEAD; inspect related open/merged PRs; classify; never duplicate a fix already merged.
