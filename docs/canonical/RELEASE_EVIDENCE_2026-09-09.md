# RELEASE_EVIDENCE_2026-09-09.md — canonical v3 release-candidate evidence

This file records what is actually verified for PR #64 (`feat/canonical-platform-v3`). It is evidence, not a launch declaration. A code file or green static review is not equivalent to deployed runtime acceptance.

## 1. Release candidate

- Repository: `pavel949/myUNO-final`
- Branch: `feat/canonical-platform-v3`
- Integration PR: #64
- Base: `main`
- Current release policy: remain draft until required acceptance evidence and deploy gates are green.

## 2. Verification dimensions

| Capability | specification_complete | code_present | migration_applied | data_config_ready | permission_verified | ui_reachable | critical_test_passed | deployed | runtime_checked | Evidence / blocker |
|---|---|---|---|---|---|---|---|---|---|---|
| Service confirm/dispute/close | verified | verified | not checked | partial | partial | verified | partial | failed | partial | CodeRabbit accepted concurrency/closure fixes; deployment blocked externally. |
| Provider remittance / late refunds | verified | verified | not applicable | partial | partial | partial | partial | failed | partial | Immutable fulfillment period, take-rate snapshot, dispute hold and late-refund carry are implemented; CI runner unavailable. |
| CRM scope-wide metrics/worklist | verified | verified | not applicable | partial | partial | verified | partial | failed | partial | Pagination and aggregate-scope findings resolved by review. |
| Project onboarding/readiness | verified | verified | not applicable | partial | partial | verified | partial | failed | partial | Six-stage cockpit + hard live gate exist; templates/inheritance/autosave remain. |
| Owner identity onboarding | verified | partial | not applicable | partial | partial | verified | partial | failed | partial | Exact CITEXT email match and canonical invite/claim exist; inline invite + E2E login/scope remain. |
| Integration environment isolation | verified | partial | not applicable | partial | partial | not applicable | partial | failed | partial | Cross-environment overwrite fails closed; first-class external-system mapping/replay model remains. |
| Standalone Phuket services | verified | failed | failed | failed | not checked | partial | failed | failed | failed | `ServiceOrder.project_id` remains non-null and POST requires project context. AT01 is a hard blocker. |
| Property-specific service terms | verified | failed | failed | failed | not checked | partial | failed | failed | failed | `ServiceProject` remains a two-FK join table. AT03 not satisfied. |
| Typed service quantities / QuoteVersion | verified | partial | failed | failed | not checked | partial | failed | failed | failed | Generic `quantity` remains; immutable accepted quote version not implemented. AT04 not satisfied. |
| Booking reschedule | verified | partial | not applicable | partial | verified | verified | partial | failed | partial | Current date-change reprices and serializes capacity, but positive delta commits dates before funding. AT09 not satisfied. |
| Canonical pricing authority | verified | partial | not applicable | partial | partial | verified | partial | failed | partial | `Unit.baseNightlyThb` and `RatePlan` still overlap. AT19 not satisfied as a single-authority claim. |
| Public services content/supply | verified | partial | not applicable | failed | not applicable | verified | not applicable | production data exists | verified | Production DB has 3 active legacy seed services without EN/RU/TH localized titles; 4 localized services remain draft. Real external-supply evidence not proven. |

## 3. Static/code review evidence

At the current reconciliation point:

- all original CodeRabbit inline findings on PR #64 are resolved;
- CodeRabbit combined status on commit `47deb44dd4928fc30cd1b7b53f301aa05e41e237` is `success`;
- no new unresolved review thread was returned by the review-thread query at that point;
- the NOI-cap display boundary bug found during release verification was fixed in commit `47deb44dd4928fc30cd1b7b53f301aa05e41e237`.

Static review is necessary but does not replace build, migration or runtime verification.

## 4. GitHub Actions blocker — external

The CI workflow itself defines checkout, Node setup, `npm ci`, lint, PostgreSQL, `prisma migrate deploy`, Next build and Vitest.

The latest inspected CI job (`run 34327756997`, job `102388874089`) failed before any step executed:

- `steps=[]`
- `runner_id=0`
- `runner_name=""`
- created and completed in about three seconds.

Therefore this is a runner/provisioning/billing availability failure, not an observed application test failure. Do not modify application code or CI YAML merely to make this symptom disappear.

## 5. Vercel blocker — external quota

The current Vercel status URL resolves to the account-level reason:

`upgradeToPro=build-rate-limit`

The deployment status remains red/pending because the Hobby build rate limit has been reached. This is not evidence of a TypeScript/Next.js compile error, and it is also not evidence that the build passes. A fresh build must execute once quota/capacity is available.

## 6. Production data verification — services

Read-only production verification against the myUNO database on 2026-09-09 found:

- 2 providers total;
- 2 providers marked `active`;
- 2 providers marked active with `vetted_at` populated;
- 3 services marked `active`; all three are legacy seed services and their `title_en`, `title_ru`, `title_th` fields are empty;
- 4 additional services have EN/RU/TH localized titles but remain `draft`.

The database `vetted_at` flag is system evidence, not independent proof that an external supplier relationship is commercially live. Consequently the platform must not claim a verified Phuket supplier network until business evidence is attached/confirmed.

## 7. Money correctness check discovered during release pass

The unit onboarding page was converting `noiCapAnnualThb` from satang to baht before passing it to `OnboardingClient`, while the client independently performed the same `/100` display conversion. A real annual NOI cap therefore appeared 100× too small.

The server now passes canonical satang unchanged. The client remains the single presentation conversion boundary.

## 8. Hard acceptance blockers

The following acceptance scenarios cannot be marked passed yet:

- **AT01** — standalone service order without property/stay: structural schema/runtime blocker.
- **AT03** — same provider, separate per-property commercial terms: no canonical runtime configuration model yet.
- **AT04** — typed quantity/duration/capacity + quote contract: incomplete.
- **AT09** — reschedule with payment failure preserving capacity: replacement-hold/funding workflow incomplete.
- **AT19** — one pricing engine across search/quote/booking/extension: overlapping authorities remain.
- **AT25** — Layantara replay/out-of-order/environment collision: environment guard exists, full federation mapping/replay verification remains.
- **AT29** — RU/EN/TH + mobile + keyboard + slow-network: final runtime/device evidence unavailable while deployment is blocked.
- **AT30** — restore/migration/webhook/job replay rehearsal: not executed for this release candidate.

## 9. Release decision

**DO NOT MERGE PR #64 TO `main` YET.**

Reasons:

1. AT01 remains a structural product requirement and is not representable by the current non-null `ServiceOrder.project_id` schema.
2. Vercel cannot execute a fresh build because of account build-rate limiting.
3. GitHub Actions is not receiving a runner, so migrations/build/tests have not executed on the current candidate.
4. Several canonical acceptance scenarios remain partial/failed as listed above.
5. Production services content/supply is not yet suitable for a truthful final marketplace launch claim.

When execution capacity returns, the required sequence is: apply the remaining schema/runtime changes → run clean migration chain → lint/build/tests → deploy preview → execute relevant AT scenarios → verify production data/config → only then mark PR ready and merge.