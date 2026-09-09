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

## Classified so far

- **F04–F09, F15** (services and order-to-money) are classified with evidence in `docs/audit/reconciliation-services-money-2026-09-09.md`, against `feat/canonical-platform-v3` @ `e9094b4` plus PR #65. Summary: F04, F05, F06, F08 already fixed; F07 fixed with a superseded non-atomic path still exported; F15 partially fixed, its own commit having removed seven `devDependencies` and broken every v3 branch's build until PR #65 restored them; **F09 (reschedule) still valid and unbuilt**.
- The remaining findings are `not verified` here.

## Agent rule
Before touching a finding: locate current code; check HEAD; inspect related open/merged PRs; classify; never duplicate a fix already merged.
