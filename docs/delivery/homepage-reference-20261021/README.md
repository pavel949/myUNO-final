# Incremental homepage guidance / owner acquisition

## Final approved scope

The owner paused wholesale redesign and then approved four bounded improvements: clearer existing owner management entry; compact holiday/relocation/purchase scenarios; one help-with-choice inquiry; and factual area content where supported. This branch implements that incremental scope, not the attached HTML design. The earlier reference-transfer limitation below is historical context, not a blocker to these incremental changes.

- `EcosystemEntry` retains its real search and all seven routes: the existing holiday (`/search`), relocation (`/relocation`), purchase (`/homes?intent=buy`) links become three compact scenarios. Monthly, services, owners and partners remain quieter links. No speculative query parameters are added; existing parameter builders are unchanged.
- Existing management acquisition remains `/manage`, now with localized highlighted navigation, dedicated homepage panel, and “How it works” link/three-step explanation. No parallel management form or owner-dashboard prerequisite.
- Homepage help becomes one CTA to `/help/choose`, using `LeadFormSection` and `/api/leads`. A labeled rental/purchase selector sends existing renters/buyers audiences to canonical CRM classifications; owner management is explicitly linked separately. Anonymous requests receive honest contact-based follow-up.
- Existing area cards and descriptions are retained. Unresolved translation keys and placeholder dashes are suppressed. No unsupported suitability, school, proximity, price or amenity copy is added. Further editorial enrichment needs verified content; no production content was changed.
- Registered guidance/form draft copy covers EN/RU/TH/ZH. Existing lead seeds are extracted into `lead-form.seed.ts` so forms use the same locale drafts as the seed registry. Unsupported response-time promises are removed from those drafts. Existing CMS values still win and may need editorial review; no automatic approval/writeback.

Initial validation: 49 tests across seven files pass (LeadForm 8; Navbar 5; EcosystemEntry 8; connected homepage 6; content-key registry 2; inquiry handler loop 13; lead service integration 7). These include error-field retention, lost-ack retry IDs, anonymous access, real CRM/thread persistence, consent rejection, duplicate retry protection, purchase/rental/management classification and staff inbox reads. Full lint, production TypeScript and diff checks pass. Build stops at the unchanged production content-review gate (`production_bypass_refused`); no bypass attempted.

System Chromium browser checks: homepage 200/no overflow at 320/390/768/1440/1920. `/help/choose` no overflow at all five widths in RU/EN/TH/ZH. Screenshots inspected for RU/TH mobile and scenario desktop; local screenshot files: `/tmp/choice-ru-320.png`, `/tmp/choice-th-390.png`, `/tmp/choice-home-top.png`. Mobile owner menu/form and management CTA journey tested. Choice journey tested through homepage link, purchase selection, simulated 503 preserving brief, and real local retry 200/confirmed receipt. A prior browser run overlapped integration database resets and returned 500; rerun after reset completion passed. Do not run destructive test resets concurrently with browser fixture submissions.

Correct public target is `https://my-uno-final.vercel.app/`; one read-only browser attempt failed `ERR_TUNNEL_CONNECTION_FAILED`, so deployed appearance/SHA is unverified. `myuno.app` is a separate project and supplies no evidence here. Local imagery fetching failed DNS and the isolated content registry lacks unrelated header/footer translations; screenshots are layout evidence, not a production visual comparison.

Changed surfaces: `src/app/(public)/page.tsx`, `manage/page.tsx`, new `help/choose/page.tsx`, `lead-form-section.tsx`; components Navbar, LeadForm, EcosystemEntry; content inquiry-copy, homepage-v4.seed, new lead-form.seed and seed registration; public-homepage.service area description guard; three updated test files and this report. No schema/migration changes, production submissions, external communications, Library writes, merge or deployment. Rollback is reverting the branch commits; canonical inquiry writer and existing URLs are retained.

Base: `5497f1ed` (main, includes #319). #318 Project Space and #320 release coordination remain separate; no merge or deployment performed.

## Reference access blocker

Known attachment: `libfile_4e366d04de748191a3066cf352879b69`, `file_0000000029a881f5a390fd11e738ab7f`, filename `Pasted text(2).txt`, version 0, 76903 bytes.

The consumer called supported prepare_materialize with explicit consumer-local destination `/workspace/homepage-reference`, then used the current unchanged Library transfer helper and companion with the complete returned transfer. Both initial and one newly prepared supported retry failed with `library file transfer failed: download failed`. No workspace_path was returned; no readable resulting file exists. This was an actual consumer-local signed-transfer attempt, not reliance on a root executor path. No denial occurred. No guessed URL/raw download/encoding workaround was used. No further unchanged retry was made. Exact visual implementation remains blocked; attachment re-sharing through a working supported transfer or direct readable consumer attachment is needed. No visual fidelity claim is made.

## Route / surface matrix

Reference elements below come from the supplied task's source inspection, not executor-rendered reference pixels. Current routes/components inspected on main; static existence is not proof of full functionality.

| Reference element | Current route/component | Existing functionality | Missing surface/flow | Choice |
| --- | --- | --- | --- | --- |
| Hero/home | `/`, LandingPage, public-homepage.service | Real homepage read model, localization, intent | Exact reference composition unverified | Preserve until reference rendered |
| Rental search | HomeFinder → `/search`, `/homes?intent=rent` | Dates, guests, place, type, bedrooms, budget; monthly move-in/term/pets | Reference's seasonal/year labels need reconciliation | Reuse real parameter builders |
| Purchase/off-plan | `/homes?intent=buy`, `/buying`, `/buyers` | Purchase catalogue/inquiries; #319 offer desk | Off-plan-specific eligibility/data not audited | Preserve canonical offers; no duplicate desk |
| Visa tab/selector | `/relocation`, `/services` | Existing relocation/service entry | Dedicated visa quiz/advisory flow absent | Honest inquiry/navigation; no eligibility calculator |
| School tab/finder | `/services`, `/relocation` | Existing service/inquiry primitives | Dedicated school finder absent | Honest inquiry, no invented schools/providers |
| Life scenarios | Existing intent, relocation, buyer and service entry routes | Existing discovery/inquiry paths | Scenario-specific composition unimplemented | Route to real filters or explanatory inquiry |
| Featured homes | HomeOffersRail, published-home read model | Actual inventory and prices/terms | Reference fixture claims not data | Preserve truthful empty/error states |
| Essential services | `/services`, `/services/[id]` | Catalogue/order surfaces | Reference category availability requires data check | Use real offerings |
| Area guide | `/areas`, `/areas/[slug]` | Area discovery | Reference content parity unverified | Reuse routes/data |
| Concierge | `/help`, existing public lead forms | Help and persisted inquiry primitives | Dedicated ask-concierge route absent | Reuse verified inquiry; never generic t.me |
| Profile | `/account`, `/login`, `/app` | Identity/account entry | None identified statically | Preserve login return paths |
| Legal/privacy | `/legal`, `/legal/terms`, `/legal/privacy` | Existing legal surfaces | Dedicated visa/legal advisory absent | Distinguish policy from professional advice |
| FAQ | `/help` | Help surface | Dedicated `/faq` absent | Reuse help content after inspection |
| Owner management | `/manage` → LeadFormSection → `/api/leads` → submitLead | Public brief, consent, canonical CRM/thread, staff inbox | Dedicated homepage emphasis missing | Implemented differentiated panel/navigation CTA; same existing destination |
| Self-list / owner workspace | `/property/onboard?kind=home`, `/owners`, `/owner` | Separate acquisition and authenticated operations | None added | Preserve distinct management/listing paths |

## Implemented owner slice

- Existing Owners navigation menu highlights localized management CTA, Russian exact text: «Передать объект в управление»; mobile menu retains the same public destination.
- Homepage management goal becomes a dedicated panel using existing supplier-copy localization; guest search is unchanged.
- `/manage` remains a truthful explanation plus name/contact/message/consent brief. Requests use sourceMedium `owner_management` through existing persistence; no new tables or migrations.
- No guaranteed income, automatic valuation, new commercial terms, or authenticated-dashboard prerequisite.
- Purchase/investor leads remain distinct from owner management.
- Reference defects must not be adopted: callback tel:1155 (tourist police), generic Telegram, fake counts/prices, stale visa financial/eligibility claims, decorative tabs/no-op anchors, scrollbar hiding.

## Validation

- Existing LeadForm (7), Navbar (5), inquiry handler loop (10), lead service integration (7): 29 tests passed on isolated local PostgreSQL.
- Added management regression: consent rejection stores nothing; anonymous owner inquiry confirms without thread access; same request retries create one CRM opportunity/thread/notification; opportunity type is management; admin sees opening brief in staff inbox. Entire handler-loop suite passes: 11 tests.
- Production TypeScript config passes. Generic `tsc --noEmit` includes historical delivery scripts/test type errors; it was attempted before client generation and is not a production gate result.
- Full `npm run lint` and changed-file lint pass. `git diff --check` passes.
- Build attempted; repository content review gate refuses production bypass (`production_bypass_refused`). Gate preserved; no release bypass or production registry mutations.
- Real system Chromium: homepage 200 and no horizontal overflow at 320/390/768/1440/1920; management panel screenshots inspected at 320 and 1440; `/manage` contains public inquiry form and real anchor scroll.
- Isolated local content registry is not fully populated/localized; mixed language fallback is visible. No reference visual comparison is possible until materialization works.
- No paid APIs, external messages, production submissions, Library writes, deployment, or merge.
- Mobile browser journey: open menu → management CTA → `/manage` → form anchor; submit without consent gives alert; isolated fixture submission with consent returns HTTP 200; server-confirmed anonymous follow-up rendered, with no private conversation link. No real prospect was submitted.

## Integration follow-up

Merged released main `bc3ff7eb` (PR #320) into this branch without conflicts. Initial PR CI failed only at generated repository-reference freshness; regenerated inventory/reference for the added `/help/choose` route. Initial recovery acceptance passed. Initial production-bypass refusal was caused by the saved development flag `CONTENT_REVIEW_GATE_ENABLED=false` combined with production compilation and a nonmatching application/test DB configuration; it did not report a pending review count. Re-running the build with `CONTENT_REVIEW_GATE_ENABLED=true` against the explicitly isolated local `myuno_test` database passes the actual gate (`reviewed`, no bypass). This proves compilation against a disposable registry, not production translation review readiness.

Local post-integration production build completed successfully with review enforcement enabled (`reviewed`, zero pending in disposable local registry). Production-server browser checks repeat all five widths for EN/RU/TH/ZH with HTTP 200/no overflow; keyboard homepage inquiry navigation and three management process steps pass. Chinese production mobile screenshot inspected at `/tmp/choice-production-zh-390.png`. Original full-suite CI found one stale parity assertion requiring the replaced homepage `/desks` button; assertion now requires `/help/choose` and verifies `/desks` remains in navigation. GitHub annotation retrieval for browser run `39540168391`, check `119026144780`, returned HTTP 401 Bad credentials; its terminal result could not be established from that watcher. No retry of that denied annotation request.
