# Public Stitch runtime audit · 2026-10-08

Scope: production `https://my-uno-final.vercel.app`, RU, desktop viewport 1348×926. Current-run UI captures and navigation, plus source grounding against `docs/canonical/DESIGN.md` §16, the founder's approved Stitch export and shared Stitch components. Read-only except narrow ProjectCard corrections recorded below. This is representative public-surface evidence, not a claim that every authenticated workflow is complete.

## Verdict

The visual language is broadly adopted on public pages: Andaman buttons, mint workspace, serif display titles, white rounded panels, editorial imagery. A `stitch-workspace` or `stitch-panel` marker is not enough to prove the screen follows the approved composition. Several pages still mix legacy layouts, inconsistent photography and English fallback labels into the shared shell. No overlap was seen in the accepted desktop screenshots; mobile, keyboard traversal and contrast measurements require separate verification.

## Captured steps

| Step | Route/action | Health | Evidence |
|---|---|---|---|
| 1 | Homepage | Good composition, image hero and unified finder; initial hero title legible | [01](evidence/stitch-2026-10-08/stitch-01-home.jpg) |
| 2 | Buy catalog from main navigation | Good shared palette/filters; no published sales offers, truthful empty state; long technical filter explanation repeated in right rail | [02](evidence/stitch-2026-10-08/stitch-02-homes.jpg) |
| 3 | Services catalog | Partial: image cards and category chips adopted; EN service content within RU; 13 category pills occupy two rows | [03](evidence/stitch-2026-10-08/stitch-03-services.jpg) |
| 4 | Cleaning service detail | Partial: switches mint→ivory; three large metadata tiles and provider panel push order below fold; inconsistent h2 typography | Observed in current browser run; screenshot emitted and inspected, saved file unavailable |
| 5 | Help and expanded stay accordion | Good layout and accordion behavior; answer exposes implementation jargon about canonical booking inventory | [05](evidence/stitch-2026-10-08/stitch-05-help.jpg) |
| 6 | Legal footer link | Good composition; `/legal` redirects to `/legal/terms`; page explicitly says full terms are still being prepared | [06](evidence/stitch-2026-10-08/stitch-06-legal.jpg) |
| 7 | Sign-in page, no credentials entered | Good shared panel/controls; password button accessibility label remains EN (`Show password`) in RU | Observed in current browser run; screenshot emitted and inspected, saved file unavailable |
| 8 | Project directory | Partial: editorial photo cards; duplicate arrows, low-contrast count metadata, counts imply availability without dates | [08](evidence/stitch-2026-10-08/stitch-08-projects.jpg) |
| 9 | The Title Legendary portal | Good image rhythm, but golf-room cover is a poor overview of the condominium; RU navigation falls back to EN | [09](evidence/stitch-2026-10-08/stitch-09-project.jpg) |
| 10 | Homes section anchor | Good: section remains below header and sticky navigation with no overlap. Common-area images repeated across unit cards need clear photo scope | [10](evidence/stitch-2026-10-08/stitch-10-project-homes.jpg) |
| 11 | D202 exact inquiry detail | Working detail and project/back links; 56 common-area images imply apartment gallery despite no explicit photo scope; bedroom plural incorrect | [11](evidence/stitch-2026-10-08/stitch-11-inquiry-unit.jpg) |
| 12 | Back to scoped no-date search | Inconclusive capture: DOM contains six cards, screenshot twice showed prompt-only viewport; do not infer missing route from that mismatch | [12](evidence/stitch-2026-10-08/stitch-12-search.jpg) |
| 13 | Areas from footer | Partial: legacy full-bleed hero/ivory body vs rounded mint composition; user copy mentions canonical areas; `1 проектов` plural wrong; only two areas shown | [13](evidence/stitch-2026-10-08/stitch-13-areas.jpg) |

## Highest-impact fixes and source causes

1. **Truthful photographs:** Project images are repeated in D202 and multiple unit cards, while unit gallery captions name the apartment. Source `public-discovery.ts` already carries `photoScope`; use it in card/gallery UI, label project common-area photos explicitly and prioritise exact-unit photos. Do not replace absent actual photography with fictitious imagery. A golf practice room is unsuitable as The Title Legendary hero; select an approved representative exterior/common area in content administration.
2. **Project count / CTA:** `ProjectCard.tsx` appended an arrow even when translated `projects.hub.view` already ended with an arrow. It rendered count text at 70% opacity over photography and the approved legacy count label read “Доступно домов”. Narrow local correction now preserves translated text, appends one decorative arrow only if absent, gives metadata/illustration labels a dark opaque token background, and uses the localized discovery inventory-count label. These source fixes still require deployment/runtime verification.
3. **Service detail composition:** `src/app/services/[id]/page.tsx` retains a `bg-surface-ivory` vertical stack although its parent layout and catalog are Stitch mint. The price/duration/notice grid should become compact inline facts with the order as contextual desktop rail and mobile primary action. Do not imply full order capability from the inactive unauthenticated button; no order submitted in this audit.
4. **Content fallback and localization:** Portal navigation, project service headers, amenity names and service data are partly EN in RU. Localize approved content through canonical content keys and meaningful locale fallbacks; avoid changing business facts to make the interface look complete. `Input.tsx` hardcodes password visibility aria labels in EN.
5. **Areas/help copy:** Remove internal implementation terms from user explanations and use appropriate counted labels. Areas only shows two public areas while project directory contains Bang Tao/Nai Yang inventory; this is a reader/content coverage issue to reconcile with canonical area IDs, not a pure style fix.
6. **Definition of adoption:** `src/app/stitch-surface-coverage.test.ts` asserts string markers and layouts; it cannot detect wrong density, empty runtime, overlap, misleading photos or inaccessible controls. Keep it as static coverage, pair with actual route-state captures and flow validation.

## Canonical reconciliation

`docs/06_design_system.md` still specifies warm ivory and RU Manrope 600; current `globals.css` uses mint and RU Source Serif 4, reflecting the approved Stitch adoption. `docs/canonical/DESIGN.md` §16 approves Stitch reference patterns but does not supersede every old token paragraph explicitly. Record the approved current token/locale-display decision in canonical documentation instead of treating marker existence as universal parity or changing shared fonts during an audit.

## Narrow implementation verification

Changed only `src/components/ProjectCard.tsx` and `src/app/(public)/projects/page.tsx`. Selected ESLint passed on both. Shared writer, authorization, inventory and pricing behavior unchanged. No additional visual-only unit tests added. Root integration owns type/build/deploy and post-deployment capture.

## Evidence limits

The 11 available images are exact screenshots captured and visually inspected during this run. Service-detail and login screenshots were emitted and inspected, but their saved files are unavailable; those steps are observations without persistent image evidence. No replacement evidence has been fabricated. Accepted screenshots support only the visible desktop state. Authentication, payments, service placement, account writes and booking confirmation were not exercised. No mobile viewport was available through the documented browser controls, so mobile layout is unverified. No WCAG compliance claim, pixel-perfect Stitch parity or whole-platform completion claim is made. Authenticated PMS and other protected surface audits belong to the parallel workstreams.

## Public composition follow-up · implementation

Compared the approved `myuno_desktop_1` service catalog image/HTML, `srv_9042` service tracking image/HTML and `myuno_owner_onboarding_wizard` image/HTML. Applied only available canonical facts and actions; invented ROI, guarantees, provider ratings and unsupported smart-lock behavior in references were not copied.

- Service detail now uses the shared mint workspace, PageHeading and Panel. Price/duration/notice are compact facts; the existing OrderWizard is a sticky contextual rail on desktop and stacks on small screens. The exact server-derived amounts and writer props remain unchanged.
- Area directory/detail use StitchMain and shared hero/page-title/link-button compositions with one container measure. Existing area readers, navigation and content remain unchanged.
- Property listing list/detail now use StitchMain, PageHeading and shared action links. Authentication and exact authority guards remain unchanged.
- Onboarding adopts the named six-step ProcessStepper and shared hero instead of an anonymous progress bar. Its existing saving/submitting controls sit in a sticky action panel; the same handlers and draft transitions remain unchanged.

These follow-up source changes require root integration build/deployment and new production screenshots before claiming visual verification. No source screenshot is presented as production evidence.
