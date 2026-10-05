# Stitch → myUNO integration map

How each Stitch screen maps to a real route in this repo, and its status. Reference only; canonical rules win (`docs/canonical/`). Update this file whenever a screen is restyled.

Status: **done** = restyled to the Stitch look, **in progress** = a design branch is open, **gap** = Stitch shows a function the platform does not have (not built, not faked), **n/a** = reference only.

| Stitch folder | Our route(s) | Status | Notes |
|---|---|---|---|
| `mobile_1`, `mobile_2`, `myuno_mobile_1/2` | `/`, `/projects`, `/search` | done (home), in progress (projects) | bottom tab bar shipped (`MobileTabBar`) |
| `myuno_desktop_1` | `/services` | done | pills + 3-col cards; hero/featured card and spec chips need real service data |
| `myuno_desktop_2`, `myuno_2..5` | `/`, `/projects/[slug]` | done / in progress | no unverifiable trust claims |
| `myuno_long_term_living_1/2` | `/homes?intent=rent` | in progress | |
| `the_title_legendary_*`, `uno_the_title_legendary_f_302` | `/units/[id]`, `/checkout/[sessionId]` | in progress | crypto/USDT in Stitch checkout: **not built** (not accepted) |
| `srv_9042` | `/services/orders` | in progress | live dispatch uses `service_order_dispatch` (migrated); UI to follow |
| `myuno_homespace`, `myuno_clean_pwa_f_302` | `/bookings/[id]/home-space`, `/residence` | in progress | |
| `myuno_owner_portal_p_l_f_302`, `myuno_roi` | `/owner/**` | in progress | no yield/ROI promises; real figures only |
| `myuno_owner_onboarding_wizard`, `myuno_6` | `/property/onboard`, `/app/admin/properties/[id]/onboarding` | in progress | |
| `myuno_pms*` (front desk, tape chart, work orders, clean, night audit, folio) | `/ops/**` | in progress | night audit and folio views: **gap** unless existing |
| `myuno_superadmin*` | `/app/admin/**` | in progress | cloud clusters / OTA: **gap** |
| `myuno_vendor_hub_1/2`, `myuno_agent_hub` | `/provider/**`, `/partners`, CRM | in progress | agent hub builds on CRM, no competing model |
| `myuno_logo`, `andaman_sanctuary_architectural_living` | design tokens | done | `src/lib/design-tokens.ts`, `tailwind.config.ts`, `globals.css` |
