# Stitch → myUNO integration map

How each Stitch screen maps to a real route in this repo, and its status. Reference only; canonical rules win (`docs/canonical/`). Update this file whenever a screen is restyled.

Status: **done** = restyled to the Stitch look, **in progress** = a design branch is open, **gap** = Stitch shows a function the platform does not have (not built, not faked), **n/a** = reference only.

| Stitch folder | Our route(s) | Status | Notes |
|---|---|---|---|
| `mobile_1`, `mobile_2`, `myuno_mobile_1/2` | `/`, `/projects`, `/search` | done | shared public shell, responsive cards/search and bottom tab bar (`MobileTabBar`) use the reconciled Stitch language |
| `myuno_desktop_1` | `/services` | done | pills + 3-col cards; hero/featured card and spec chips need real service data |
| `myuno_desktop_2`, `myuno_2..5` | `/`, `/projects/[slug]` | done | project portal uses the shared Stitch hierarchy while keeping canonical trust/media rules |
| `myuno_long_term_living_1/2` | `/homes?intent=rent` | done | segmented intent/filter workspace and listing cards now use the shared Stitch primitives |
| `the_title_legendary_*`, `uno_the_title_legendary_f_302` | `/units/[id]`, `/checkout/[sessionId]` | done (supported flow) | unit + checkout restyled; crypto/USDT remains an explicit **gap** because it is not an accepted payment rail |
| `srv_9042` | `/services/orders` | done (customer/provider surfaces) | customer order list/detail and provider queue restyled; dispatch data stays canonical |
| `myuno_homespace`, `myuno_clean_pwa_f_302` | `/bookings/[bookingId]/home-space`, `/residence` | done | active-stay and resident surfaces now share the Stitch Home Space visual language |
| `myuno_owner_portal_p_l_f_302`, `myuno_roi` | `/owner/**` | done (dashboard shell) | owner portfolio dashboard restyled; no yield/ROI promises, real figures only |
| `myuno_owner_onboarding_wizard`, `myuno_6` | `/property/onboard`, `/app/admin/properties/[id]/onboarding` | done (shared intake shell) | canonical submission/readiness gates are unchanged |
| `myuno_pms*` (front desk, tape chart, work orders, clean, night audit, folio) | `/ops/**` | done (existing PMS surfaces) | ops/front-desk/calendar queues use the Stitch command shell; standalone night-audit and folio screens remain explicit **functional gaps** rather than mocked UI |
| `myuno_superadmin*` | `/app/admin/**` | done (existing admin surfaces) | dark command sidebar + executive dashboard shell shipped; cloud-cluster / OTA control planes remain explicit **functional gaps** |
| `myuno_vendor_hub_1/2`, `myuno_agent_hub` | `/provider/**`, CRM / partner workflows | done (existing workflows) | provider queue and admin CRM inherit the Stitch shells; no competing agent data model was introduced |
| `myuno_logo`, `andaman_sanctuary_architectural_living` | design tokens | done | `src/lib/design-tokens.ts`, `tailwind.config.ts`, `globals.css` |
