# Homepage reference reconciliation / owner acquisition

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
