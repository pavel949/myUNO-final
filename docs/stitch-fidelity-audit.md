# Stitch fidelity audit — production source correction

Baseline: main `f90a5644993247fe0df52af19e27c1d3c91714e9`. This report separates implementation coverage from actual visual verification. The earlier integration map's “done” did not establish reference fidelity on every screen; its terminology is corrected.

## References inspected

Actual Stitch PNG and HTML exports: `myuno_pms_front_desk`, `myuno_superadmin_executive_hub`, `myuno_desktop_1`, `myuno_desktop_2`; theme spec v2.4 and canonical DESIGN §16. Adopt the existing domain behavior and real data, not example guest names, revenue, reviews or unsupported features from reference mockups.

## Findings and applied corrections

| Layer | Baseline defect | Applied correction |
|---|---|---|
| Semantic colors | 51 references in 23 files pointed at nonexistent theme utilities; backgrounds/status colors silently did not render | Replace with existing brand/surface/state/text tokens; new guard scans semantic utility references against actual Tailwind theme |
| Typography | Invalid percentage tracking; serif numerals in RU dashboard figures; larger buttons used display face | Valid em tracking; separate Outfit numeric family; Manrope controls; locale editorial faces preserved |
| Primitives | 12px button radius disagreed with 8px control spec; KPI implementation drift | Shared 8px controls, 16px panels, mint contextual panels, consistent tabular metric tiles |
| Workspace chrome | Public navigation/footer and guest mobile tabs intruded into operational workspaces | Route-aware compact utility header; domain rail owns navigation; guest footer/tabs stay in public journeys |
| MC composition | Two desktop sidebars consumed the worklist area | One 256px shared rail and horizontal local 44px view controls; preserve project/organization navigation scope |
| Admin finance | Legacy reconciliation URL lacked the shared authenticated admin shell | Reuse existing admin layout and permission gates |
| PMS controls | Raw multicolor status classes and 11 competing front-desk header actions | Semantic states across calendar/forms/tasks; primary calendar action plus operations disclosure; text/symbol state distinctions remain |
| Service detail | No imagery for cover-null service; three oversized fact cards and order form below fold | Existing catalogue presentation asset with illustrative disclosure, aspect-ratio media, compact facts, primary content plus sticky order rail |
| Public areas/property | Legacy heading/action arrangements outside shared composition | Shared public hero, heading, containers and action primitives |
| Property onboarding | Numeric-only steps; search lists/gallery used tiny pixel heights | Named six-step ProcessStepper, sticky actions, explicit usable list heights and aspect-ratio photo thumbnails |

## Verification

Selected regression suite: 40 tests in 8 files passed (semantic tokens, workspace route boundaries, MC scope, PMS shell/touch targets, calendar, discovery search). Selected ESLint: 56 changed TS/TSX files passed. Final production build is checked before publishing; release/runtime evidence is appended after deployment.

The production service detail baseline was inspected visually at 1348×926: narrow content, oversized fact cards, no image and order form below the fold. Baseline screenshot: `evidence/stitch-fidelity/01-service-before.jpg`.

Authenticated PMS/MC/owner/provider/admin pages remain behind login in the available browser. Their source and pure tests were checked; full rendered role-by-role, mobile, empty/error/loading and overflow verification is not claimed. Shared theme adoption does not certify every one of the platform's screens as pixel-identical to Stitch.
