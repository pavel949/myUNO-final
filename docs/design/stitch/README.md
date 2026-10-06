# Stitch UI reference screens

Design and flow **reference only** — not a data model and not a source of business truth. Canonical rules (authority gates, pricing, availability, media readiness, RBAC, audit) stay authoritative; see `../../STITCH_FLOW_RECONCILIATION.md` for what was adopted and what was deliberately excluded.

Added 2026-10-05 from the founder's Stitch export (`stitch_myuno_ui_design_flows.zip`): 52 screens. Each folder holds `screen.png` (rendering) and `code.html` (Stitch markup — layout reference, not production code). Folders without a `code.html` hold only what the export provided.

| Folder | Page title (from `code.html`) | Files |
|---|---|---|
| `andaman_sanctuary_architectural_living` | — | DESIGN.md |
| `mobile_1` | — | code.html, screen.png |
| `mobile_2` | — | code.html, screen.png |
| `myuno_1` | — | code.html, screen.png |
| `myuno_2` | — | code.html, screen.png |
| `myuno_3` | — | code.html, screen.png |
| `myuno_4` | — | code.html, screen.png |
| `myuno_5` | — | code.html, screen.png |
| `myuno_6` | myUNO Owner Studio — Регистрация объекта | code.html, screen.png |
| `myuno_agent_hub` | myUNO Phuket | Agent & Broker Hub | code.html, screen.png |
| `myuno_clean_pwa_f_302` | — | code.html, screen.png |
| `myuno_desktop_1` | myUNO Services & Concierge Marketplace | code.html, screen.png |
| `myuno_desktop_2` | myUNO — Экосистема премиальной недвижимости Пхукета | code.html, screen.png |
| `myuno_f_302` | — | code.html, screen.png |
| `myuno_homespace` | — | code.html, screen.png |
| `myuno_homespace_culture_manifesto_strategy_hub` | — | code.html, screen.png |
| `myuno_logo` | — | code.html, screen.png |
| `myuno_long_term_living_1` | — | code.html, screen.png |
| `myuno_long_term_living_2` | myUNO Phuket — Долгосрочная аренда недвижимости | code.html, screen.png |
| `myuno_mobile_1` | — | code.html, screen.png |
| `myuno_mobile_2` | — | code.html, screen.png |
| `myuno_owner_onboarding_wizard` | — | code.html, screen.png |
| `myuno_owner_portal_p_l_f_302` | — | code.html, screen.png |
| `myuno_pms` | — | code.html, screen.png |
| `myuno_pms_front_desk` | myUNO PMS - Ресепшн & Заселение | code.html, screen.png |
| `myuno_pms_front_desk_arrivals_departures_check_in_wizard` | — | code.html, screen.png |
| `myuno_pms_maintenance_work_orders` | myUNO PMS - Ресепшн & Заселение | code.html, screen.png |
| `myuno_pms_myuno_clean` | — | code.html, screen.png |
| `myuno_pms_night_audit_daily_reconciliation` | — | code.html, screen.png |
| `myuno_pms_tape_chart_1` | — | code.html, screen.png |
| `myuno_pms_tape_chart_2` | — | code.html, screen.png |
| `myuno_pms_tape_chart_3` | myUNO PMS — Шахматка бронирований | code.html, screen.png |
| `myuno_pms_tape_chart_4` | myUNO PMS — Шахматка бронирований | code.html, screen.png |
| `myuno_pms_un_84920` | — | code.html, screen.png |
| `myuno_roi` | — | code.html, screen.png |
| `myuno_superadmin` | — | code.html, screen.png |
| `myuno_superadmin_api_cloud_clusters` | myUNO Global Platform OS | code.html, screen.png |
| `myuno_superadmin_executive_hub` | myUNO Global Platform OS | code.html, screen.png |
| `myuno_superadmin_iam_rbac_audit_trail` | myUNO Global Platform OS | code.html, screen.png |
| `myuno_superadmin_ledger_split_engine_payouts` | myUNO Global Platform OS | code.html, screen.png |
| `myuno_superadmin_portfolio_projects` | myUNO Global Platform OS | code.html, screen.png |
| `myuno_superadmin_services_vendor_hub` | myUNO Global Platform OS | code.html, screen.png |
| `myuno_superadmin_web_files_ota` | — | code.html, screen.png |
| `myuno_vendor_hub_1` | — | code.html, screen.png |
| `myuno_vendor_hub_2` | myUNO Partner Dashboard | code.html, screen.png |
| `srv_9042` | — | code.html, screen.png |
| `the_title_legendary_f_302` | myUNO Phuket | Luxury Residence Checkout | code.html, screen.png |
| `the_title_legendary_f_302_mobile_1` | — | code.html, screen.png |
| `the_title_legendary_f_302_mobile_2` | — | code.html, screen.png |
| `the_title_legendary_f_302_mobile_3` | Оформление бронирования и оплата — The Title Legendary #F-302 | code.html, screen.png |
| `the_title_legendary_f_302_mobile_4` | — | code.html, screen.png |
| `the_title_legendary_myuno` | — | code.html, screen.png |
| `uno_the_title_legendary_f_302` | — | code.html, screen.png |

## Specs exported alongside the screens (`specs/`)

Reference only. **None of these may be applied as-is** — see `SCHEMA_RECONCILIATION.md` for what was adopted, deferred or rejected and why.

| File | What it is | Caution |
|---|---|---|
| `specs/tailwind-theme-tokens.md` | Stitch Tailwind theme + component recipes | Written for default Tailwind spacing; this repo replaces the spacing scale (doc 06 §2.3). Tokens are reconciled into `src/lib/design-tokens.ts`, not pasted. |
| `specs/app-router-route-specification.md` | Proposed route groups, screen↔route map, middleware | Existing working URLs are kept. The proposed middleware trusts a client-readable role cookie — **not adopted** (forgeable). |
| `specs/readme-export-master-spec.md` | Master export spec, screen registry | Placeholder ids (`SCREEN_nnn`) refer to the Stitch canvas, not to files here. |
| `specs/stitch-schema.prisma.txt` | Stitch's Prisma schema | Diffed in `SCHEMA_RECONCILIATION.md`; never to be applied over `prisma/schema.prisma`. |
| `specs/stitch-seed.ts.txt` | Seed for the Stitch schema | **DESTRUCTIVE** (starts with `deleteMany()` on every table) and written for models that do not exist here. Do not run. Content reference only; contains invented facts (phones, ratings). |
| `specs/homepage-strategy-ru.md` | Homepage strategy brief (RU) | Implemented as homepage v4. |

## Images

The Stitch HTML references **121 distinct images hosted on `lh3.googleusercontent.com`** (Stitch's own hosting); the export contained no image files other than `screen.png` renders. Real photos must come from the platform's media layer (`MediaAsset`, with rights and `actual`/`representative` flags) — not from these links.
