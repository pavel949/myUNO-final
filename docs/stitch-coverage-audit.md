# Stitch surface coverage audit

Date: 2026-10-08 (Asia/Bangkok). Repository baseline: `main e92f4a0080ac97698e77ad7b11f70170dfd0455d`.

This is a **source audit of all 160 page routes**, not a claim that all 160 screens have been clicked in production. The parallel PMS runtime audit records authenticated access and screenshots separately. Shared files were being changed by the PMS agents during this inspection; the route inventory below describes structure, and outstanding findings must be reconciled with the final diff before release.

## Answer

Stitch is broadly installed at the shell/token level, but “all surfaces implemented” is too strong. Most route families inherit a shared shell. Inner composition, responsive actions, navigation, typography and status treatments still vary. A wrapper or `stitch-panel` class alone does not establish a completed Stitch screen or functional workflow.

## What canonical Stitch means here

- Authority: `PROJECT.md`, `docs/canonical/DESIGN.md` §16, `docs/06_design_system.md`; Stitch exports are references, not business logic.
- Executable tokens: `src/lib/design-tokens.ts` → `tailwind.config.ts`. Current Andaman `#11382E`, deep `#0B2C24`, gold `#D19A5B`, mint `#EFFCF9`, ivory `#FBF9F5`, paper white. Use named colors and functional state tokens; do not restore old numbers solely because doc 06 has older values.
- Composition: `globals.css` defines workspace/page/hero/panel/control/list primitives; `premium/StitchPage.tsx` and `PremiumPrimitives.tsx` compose headers, panels, KPI tiles, state chips and processes.
- Shells: `StitchWorkspaceShell` = persistent operational rail and mobile disclosure; `StitchConsumerShell` = consumer surface scope. Admin has its own authenticated rail layout. Public editorial pages intentionally compose their own heroes rather than inheriting an operational rail.
- Acceptance: one primary task, purposeful density, scoped real data, honest loading/empty/error/forbidden states, locale-aware readable text, keyboard focus, touch targets and usable 390px layout. Presence of a shell does not prove these.

## Coverage by route family

| Family | Pages | Existing delivery | Assessment |
|---|---:|---|---|
| `/app/admin/**` | 51 | Authenticated admin command rail; tokened inner pages | Shell installed; typography and some inner workflows partial |
| `/admin/finance/reconciliation` | 1 | Client panels, outside admin layout | Missing operational shell/context; high priority |
| `/ops/**` | 24 | Shared operational shell; most own workspace/panels | Broad shell adoption; calendar/status/forms and navigation require fixes |
| `/mc/**` | 10 | Shared shell plus Today’s own inner rail | Duplicate rail on Today; unit workspace typography/copy partial |
| `/owner/**` | 4 | Shared owner rail and tokened dashboard/detail/statement views | Shell/composition installed; runtime/responsive states not checked here |
| `/provider/**` | 4 | Shared provider rail and tokened queue/editor/remittance views | Shell installed; invalid caption class in remittances |
| Guest/account/commerce/auth families | 30 | Consumer shell inherited from 18 layouts | Shell installed; mobile booking action conflicts with global tabs |
| Public/editorial and other root-only routes | 36 | Public Navbar/Footer; many direct Stitch compositions | No rail is expected publicly; property supplier settings are incomplete |
| **Total** | **160** | **51 admin, 42 workspace, 30 consumer, 37 root-only** | **Source coverage, not visual or E2E pass** |

The automated rendering-import trace found 148 routes with a composition signal, seven redirect-only routes, and five without such a signal. These are locator facts only: the five include the design catalogue and tokened desk detail, which are not broken merely because they lack the class. Conversely, a class in an imported child is not proof that the whole screen conforms.

## Confirmed gaps and recommended fixes

| Priority | Finding and concrete evidence | Effect | Safe fix / verification |
|---|---|---|---|
| P1 | Unit mobile booking footer in `units/[id]/unit-client.tsx` is `bottom-0 z-30 lg:hidden`; global `MobileTabBar` is `bottom-0 z-40 md:hidden` | Below 768px both occupy the bottom; tabs can cover Reserve | Give transaction CTA exclusive bottom space or suppress consumer tabs for transaction/detail routes; verify 390px with a real quote and keyboard |
| P1 | Finance reconciliation lives at `/admin/finance/reconciliation`, outside `/app/admin` layout. Client starts with uncontained `space-y-24`; admin nav points directly there | Operator leaves command context; no normal page gutter/rail. Page auth relies on API denial instead of authenticated layout | Relocate canonical page under authenticated admin shell, keep old URL compatibility redirect; preserve API/writers and test role denial |
| P2 | `mc/layout.tsx` wraps Today in 248px rail while `mc/client.tsx` renders a second 228px rail (`lg:grid-cols-[228px_minmax(0,1fr)]`) | Competing navigation and ~476px rails narrow the workspace before gutters | Keep one global rail; represent Today subviews as compact tabs/filters. Preserve project/org context |
| P2 | 24 `text-caption` usages across seven production files; two `text-heading-lg` usages. Neither fontSize exists in Tailwind theme | Silent inherited typography instead of intended captions/headings; visual inconsistency | Map caption→small and heading-lg→title/heading-2 as appropriate; do not add arbitrary aliases to hide drift |
| P2 | Raw red/green/emerald/slate status colors persist in ops forms/actions/queue/calendar and property structure/deal components | Alternate alert/disabled language despite shared tokens | Use state-error/success/warning and neutral text/surface tokens; preserve distinctions and explicit labels |
| P2 | `/property/listings` and `/property/listings/[unitId]` have no route-family shell; own max-content container and literal English copy, ad hoc primary/secondary links | Supplier journey differs from consumer onboarding and management workspace | Apply consistent supplier page header/panel/action structure; register localized copy; keep authority gate intact |
| P2 | RootLayout always adds public Navbar, Footer and consumer MobileTabBar to operational/admin routes | Operator works within consumer navigation; extra bottom bar can compete with local actions | A shared path-aware outer chrome rule should choose consumer vs workspace controls, retaining account/language/notifications and escape link |
| P2 | Existing `stitch-surface-coverage.test.ts` asserts source substrings for layouts/classes | Test can pass for visually broken, duplicated or unreachable screen | Keep structural guard but add targeted rendered contracts and authenticated desktop/mobile runtime evidence |
| P3 | Doc 06 token/type values differ from actual adopted Stitch theme; INTEGRATION_MAP says all existing families “done,” while flow reconciliation still contains stale route-missing entries | Reviewers confuse shell adoption with verified process readiness | Reconcile docs to deployed SHA and label visual shell vs runtime/process separately |

### Exact invalid type locations

- `text-caption`: admin compliance, CRM lifecycle panel, incidents client, operational KPIs client, tickets client; MC Today client; provider remittances client. 24 usages at inspection.
- `text-heading-lg`: admin property onboarding Section header, `components/property/PropertyDealClient.tsx`. Two usages.

### Exact off-palette components observed

`components/Placeholder.tsx`; `components/ops/{PreventiveMaintenanceForm,ManualReservationForm,StayActions,UnifiedStayCalendar,ReservationGroupForm,OperationalTaskQueueClient,OperationalTaskCreateForm}.tsx`; `components/property/{StructureEditor,PropertyDealClient}.tsx`; `app/mc/properties/[unitId]/page.tsx`.

The calendar and shared shell were concurrently being fixed by the PMS agent. Do not count their pre-fix findings as outstanding after reviewing the final code/runtime evidence.

## Verification and readiness

`npm run audit:inventory` ran successfully; 160 page routes. Every page was mapped to actual ancestor layouts and its rendering imports, with manual examination of central shells, token theme, public page composition, supplier settings, reconciliation, MC Today, unit footer and shared components. No production write, booking, payment, role grant or DB migration was performed for this audit.

| Dimension | Status | Scope |
|---|---|---|
| Specification complete | verified | Canonical design and reference patterns located |
| Code present | partial | Shared primitives/shells installed; confirmed composition gaps |
| Migration applied | not applicable | Visual inventory introduces no schema changes |
| Data/config ready | not checked | Requires real role-scoped production data |
| Permission verified | not checked | Source gates located; role journey proof belongs to runtime audit |
| UI reachable | not checked | Source routes are not click evidence |
| Critical test passed | not checked | Inventory is not a visual test |
| Deployed | partial | Baseline main code known; final combined release tracked by parent |
| Runtime checked | not checked | This report is source-only; use separate runtime screenshots |

No pixel-level comparison of every Stitch export, viewport overflow assurance, complete locale assurance, or whole-PMS go-live claim is made here.

## Full route / shell map

“Shared composition” means an own/rendered dependency references the established Stitch primitives or header; it is not a visual pass. “Token layout” means manual token-based layout without that marker. Redirects need destination review rather than independent redesign. All routes inherit the global RootLayout.

| Route | Source | Ancestor shell | Rendering signal |
|---|---|---|---|
| `/app/admin/announcements` | `src/app/(admin)/app/admin/announcements/page.tsx` | admin | shared composition |
| `/app/admin/areas` | `src/app/(admin)/app/admin/areas/page.tsx` | admin | shared composition |
| `/app/admin/audit` | `src/app/(admin)/app/admin/audit/page.tsx` | admin | shared composition |
| `/app/admin/bookings/[id]/journey` | `src/app/(admin)/app/admin/bookings/[id]/journey/page.tsx` | admin | shared composition |
| `/app/admin/bookings` | `src/app/(admin)/app/admin/bookings/page.tsx` | admin | redirect |
| `/app/admin/claims` | `src/app/(admin)/app/admin/claims/page.tsx` | admin | shared composition |
| `/app/admin/compliance` | `src/app/(admin)/app/admin/compliance/page.tsx` | admin | shared composition |
| `/app/admin/compliance-checklists` | `src/app/(admin)/app/admin/compliance-checklists/page.tsx` | admin | shared composition |
| `/app/admin/config` | `src/app/(admin)/app/admin/config/page.tsx` | admin | shared composition |
| `/app/admin/content/homepage` | `src/app/(admin)/app/admin/content/homepage/page.tsx` | admin | shared composition |
| `/app/admin/content` | `src/app/(admin)/app/admin/content/page.tsx` | admin | shared composition |
| `/app/admin/contracts` | `src/app/(admin)/app/admin/contracts/page.tsx` | admin | shared composition |
| `/app/admin/crm/opportunities/[id]/deal` | `src/app/(admin)/app/admin/crm/opportunities/[id]/deal/page.tsx` | admin | shared composition |
| `/app/admin/crm/opportunities/[id]` | `src/app/(admin)/app/admin/crm/opportunities/[id]/page.tsx` | admin | shared composition |
| `/app/admin/crm` | `src/app/(admin)/app/admin/crm/page.tsx` | admin | shared composition |
| `/app/admin/developers/[id]` | `src/app/(admin)/app/admin/developers/[id]/page.tsx` | admin | shared composition |
| `/app/admin/disputes` | `src/app/(admin)/app/admin/disputes/page.tsx` | admin | shared composition |
| `/app/admin/incidents` | `src/app/(admin)/app/admin/incidents/page.tsx` | admin | shared composition |
| `/app/admin/integrations` | `src/app/(admin)/app/admin/integrations/page.tsx` | admin | shared composition |
| `/app/admin/layantara` | `src/app/(admin)/app/admin/layantara/page.tsx` | admin | shared composition |
| `/app/admin/ledger` | `src/app/(admin)/app/admin/ledger/page.tsx` | admin | shared composition |
| `/app/admin/operational-kpis` | `src/app/(admin)/app/admin/operational-kpis/page.tsx` | admin | shared composition |
| `/app/admin/organizations` | `src/app/(admin)/app/admin/organizations/page.tsx` | admin | shared composition |
| `/app/admin` | `src/app/(admin)/app/admin/page.tsx` | admin | shared composition |
| `/app/admin/payouts` | `src/app/(admin)/app/admin/payouts/page.tsx` | admin | shared composition |
| `/app/admin/people` | `src/app/(admin)/app/admin/people/page.tsx` | admin | shared composition |
| `/app/admin/processes` | `src/app/(admin)/app/admin/processes/page.tsx` | admin | shared composition |
| `/app/admin/projects/[id]/amenities/[amenityId]/reservations` | `src/app/(admin)/app/admin/projects/[id]/amenities/[amenityId]/reservations/page.tsx` | admin | shared composition |
| `/app/admin/projects/[id]/experience` | `src/app/(admin)/app/admin/projects/[id]/experience/page.tsx` | admin | shared composition |
| `/app/admin/projects/[id]/inventory` | `src/app/(admin)/app/admin/projects/[id]/inventory/page.tsx` | admin | shared composition |
| `/app/admin/projects/[id]/media` | `src/app/(admin)/app/admin/projects/[id]/media/page.tsx` | admin | shared composition |
| `/app/admin/projects/[id]` | `src/app/(admin)/app/admin/projects/[id]/page.tsx` | admin | shared composition |
| `/app/admin/projects/[id]/preview` | `src/app/(admin)/app/admin/projects/[id]/preview/page.tsx` | admin | shared composition |
| `/app/admin/projects/[id]/services` | `src/app/(admin)/app/admin/projects/[id]/services/page.tsx` | admin | token layout; no composition marker |
| `/app/admin/projects/[id]/structure` | `src/app/(admin)/app/admin/projects/[id]/structure/page.tsx` | admin | shared composition |
| `/app/admin/projects` | `src/app/(admin)/app/admin/projects/page.tsx` | admin | shared composition |
| `/app/admin/properties/[id]/onboarding` | `src/app/(admin)/app/admin/properties/[id]/onboarding/page.tsx` | admin | token layout; no composition marker |
| `/app/admin/properties/new` | `src/app/(admin)/app/admin/properties/new/page.tsx` | admin | redirect |
| `/app/admin/property-submissions` | `src/app/(admin)/app/admin/property-submissions/page.tsx` | admin | shared composition |
| `/app/admin/prospecting` | `src/app/(admin)/app/admin/prospecting/page.tsx` | admin | shared composition |
| `/app/admin/providers` | `src/app/(admin)/app/admin/providers/page.tsx` | admin | shared composition |
| `/app/admin/reports/attribution` | `src/app/(admin)/app/admin/reports/attribution/page.tsx` | admin | shared composition |
| `/app/admin/scheduler` | `src/app/(admin)/app/admin/scheduler/page.tsx` | admin | shared composition |
| `/app/admin/service-orders` | `src/app/(admin)/app/admin/service-orders/page.tsx` | admin | shared composition |
| `/app/admin/services` | `src/app/(admin)/app/admin/services/page.tsx` | admin | shared composition |
| `/app/admin/signals` | `src/app/(admin)/app/admin/signals/page.tsx` | admin | shared composition |
| `/app/admin/statements` | `src/app/(admin)/app/admin/statements/page.tsx` | admin | shared composition |
| `/app/admin/tickets` | `src/app/(admin)/app/admin/tickets/page.tsx` | admin | shared composition |
| `/app/admin/units/[id]` | `src/app/(admin)/app/admin/units/[id]/page.tsx` | admin | shared composition |
| `/app/admin/units/[id]/structure` | `src/app/(admin)/app/admin/units/[id]/structure/page.tsx` | admin | shared composition |
| `/app/admin/units` | `src/app/(admin)/app/admin/units/page.tsx` | admin | shared composition |
| `/about` | `src/app/(public)/about/page.tsx` | root only | shared composition |
| `/buyers` | `src/app/(public)/buyers/page.tsx` | root only | shared composition |
| `/desks/[slug]` | `src/app/(public)/desks/[slug]/page.tsx` | root only | token layout; no composition marker |
| `/desks` | `src/app/(public)/desks/page.tsx` | root only | shared composition |
| `/developers` | `src/app/(public)/developers/page.tsx` | root only | shared composition |
| `/guests/access` | `src/app/(public)/guests/access/page.tsx` | root only | shared composition |
| `/guests` | `src/app/(public)/guests/page.tsx` | root only | shared composition |
| `/help` | `src/app/(public)/help/page.tsx` | root only | shared composition |
| `/legal` | `src/app/(public)/legal/page.tsx` | root only | redirect |
| `/legal/privacy` | `src/app/(public)/legal/privacy/page.tsx` | root only | shared composition |
| `/legal/terms` | `src/app/(public)/legal/terms/page.tsx` | root only | shared composition |
| `/manage` | `src/app/(public)/manage/page.tsx` | root only | shared composition |
| `/management-companies` | `src/app/(public)/management-companies/page.tsx` | root only | shared composition |
| `/owners` | `src/app/(public)/owners/page.tsx` | root only | shared composition |
| `/` | `src/app/(public)/page.tsx` | root only | shared composition |
| `/partners` | `src/app/(public)/partners/page.tsx` | root only | shared composition |
| `/projects/[slug]/amenities/[amenitySlug]/book` | `src/app/(public)/projects/[slug]/amenities/[amenitySlug]/book/page.tsx` | root only | shared composition |
| `/projects/[slug]/amenities/[amenitySlug]` | `src/app/(public)/projects/[slug]/amenities/[amenitySlug]/page.tsx` | root only | shared composition |
| `/projects/[slug]/amenities` | `src/app/(public)/projects/[slug]/amenities/page.tsx` | root only | shared composition |
| `/projects/[slug]/categories/[categoryKey]` | `src/app/(public)/projects/[slug]/categories/[categoryKey]/page.tsx` | root only | shared composition |
| `/projects/[slug]` | `src/app/(public)/projects/[slug]/page.tsx` | root only | shared composition |
| `/projects/[slug]/passport` | `src/app/(public)/projects/[slug]/passport/page.tsx` | root only | shared composition |
| `/projects` | `src/app/(public)/projects/page.tsx` | root only | shared composition |
| `/providers` | `src/app/(public)/providers/page.tsx` | root only | shared composition |
| `/rent-out` | `src/app/(public)/rent-out/page.tsx` | root only | shared composition |
| `/sell` | `src/app/(public)/sell/page.tsx` | root only | shared composition |
| `/trust/ombudsman` | `src/app/(public)/trust/ombudsman/page.tsx` | root only | shared composition |
| `/trust` | `src/app/(public)/trust/page.tsx` | root only | shared composition |
| `/account` | `src/app/account/page.tsx` | consumer | shared composition |
| `/admin/finance/reconciliation` | `src/app/admin/finance/reconciliation/page.tsx` | root only | shared composition |
| `/announcements` | `src/app/announcements/page.tsx` | root only | shared composition |
| `/app` | `src/app/app/page.tsx` | root only | shared composition |
| `/areas/[slug]` | `src/app/areas/[slug]/page.tsx` | root only | shared composition |
| `/areas` | `src/app/areas/page.tsx` | root only | shared composition |
| `/auth/claim` | `src/app/auth/claim/page.tsx` | consumer | shared composition |
| `/auth/reset-password` | `src/app/auth/reset-password/page.tsx` | consumer | shared composition |
| `/auth/verify` | `src/app/auth/verify/page.tsx` | consumer | shared composition |
| `/book/review` | `src/app/book/review/page.tsx` | consumer | shared composition |
| `/bookings/[bookingId]/home-space/handbook` | `src/app/bookings/[bookingId]/home-space/handbook/page.tsx` | consumer | shared composition |
| `/bookings/[bookingId]/home-space` | `src/app/bookings/[bookingId]/home-space/page.tsx` | consumer | shared composition |
| `/bookings/[bookingId]/passports` | `src/app/bookings/[bookingId]/passports/page.tsx` | consumer | shared composition |
| `/buying` | `src/app/buying/page.tsx` | consumer | shared composition |
| `/checkout/[sessionId]` | `src/app/checkout/[sessionId]/page.tsx` | consumer | shared composition |
| `/design` | `src/app/design/page.tsx` | root only | token layout; no composition marker |
| `/homes/[id]` | `src/app/homes/[id]/page.tsx` | consumer | shared composition |
| `/homes` | `src/app/homes/page.tsx` | consumer | shared composition |
| `/juristic` | `src/app/juristic/page.tsx` | consumer | shared composition |
| `/login` | `src/app/login/page.tsx` | consumer | shared composition |
| `/mc/calendar` | `src/app/mc/calendar/page.tsx` | workspace | redirect |
| `/mc/costs` | `src/app/mc/costs/page.tsx` | workspace | shared composition |
| `/mc/mobilization/[unitId]` | `src/app/mc/mobilization/[unitId]/page.tsx` | workspace | shared composition |
| `/mc/mobilization` | `src/app/mc/mobilization/page.tsx` | workspace | shared composition |
| `/mc` | `src/app/mc/page.tsx` | workspace | shared composition |
| `/mc/portfolio` | `src/app/mc/portfolio/page.tsx` | workspace | redirect |
| `/mc/properties/[unitId]` | `src/app/mc/properties/[unitId]/page.tsx` | workspace | shared composition |
| `/mc/requests` | `src/app/mc/requests/page.tsx` | workspace | shared composition |
| `/mc/tm30` | `src/app/mc/tm30/page.tsx` | workspace | shared composition |
| `/mc/units/[unitId]` | `src/app/mc/units/[unitId]/page.tsx` | workspace | redirect |
| `/messages/[threadId]` | `src/app/messages/[threadId]/page.tsx` | consumer | shared composition |
| `/messages` | `src/app/messages/page.tsx` | consumer | shared composition |
| `/ops/calendar/[unitId]` | `src/app/ops/calendar/[unitId]/page.tsx` | workspace | shared composition |
| `/ops/calendar/board` | `src/app/ops/calendar/board/page.tsx` | workspace | shared composition |
| `/ops/calendar` | `src/app/ops/calendar/page.tsx` | workspace | redirect |
| `/ops/claims` | `src/app/ops/claims/page.tsx` | workspace | shared composition |
| `/ops/costs` | `src/app/ops/costs/page.tsx` | workspace | shared composition |
| `/ops/housekeeping` | `src/app/ops/housekeeping/page.tsx` | workspace | shared composition |
| `/ops/maintenance` | `src/app/ops/maintenance/page.tsx` | workspace | shared composition |
| `/ops/mobilization/[unitId]` | `src/app/ops/mobilization/[unitId]/page.tsx` | workspace | shared composition |
| `/ops/mobilization` | `src/app/ops/mobilization/page.tsx` | workspace | shared composition |
| `/ops/new-unit` | `src/app/ops/new-unit/page.tsx` | workspace | shared composition |
| `/ops/night-audit` | `src/app/ops/night-audit/page.tsx` | workspace | shared composition |
| `/ops` | `src/app/ops/page.tsx` | workspace | shared composition |
| `/ops/projects/[id]/edit` | `src/app/ops/projects/[id]/edit/page.tsx` | workspace | shared composition |
| `/ops/requests` | `src/app/ops/requests/page.tsx` | workspace | shared composition |
| `/ops/reservations` | `src/app/ops/reservations/page.tsx` | workspace | shared composition |
| `/ops/spaces/[spaceId]` | `src/app/ops/spaces/[spaceId]/page.tsx` | workspace | shared composition |
| `/ops/spaces` | `src/app/ops/spaces/page.tsx` | workspace | shared composition |
| `/ops/stays/[bookingId]/check-in` | `src/app/ops/stays/[bookingId]/check-in/page.tsx` | workspace | shared composition |
| `/ops/stays/[bookingId]` | `src/app/ops/stays/[bookingId]/page.tsx` | workspace | shared composition |
| `/ops/stays` | `src/app/ops/stays/page.tsx` | workspace | shared composition |
| `/ops/tasks` | `src/app/ops/tasks/page.tsx` | workspace | shared composition |
| `/ops/team` | `src/app/ops/team/page.tsx` | workspace | shared composition |
| `/ops/tm30` | `src/app/ops/tm30/page.tsx` | workspace | shared composition |
| `/ops/units/[unitId]/edit` | `src/app/ops/units/[unitId]/edit/page.tsx` | workspace | shared composition |
| `/owner` | `src/app/owner/page.tsx` | workspace | shared composition |
| `/owner/statements/[statementId]` | `src/app/owner/statements/[statementId]/page.tsx` | workspace | shared composition |
| `/owner/statements` | `src/app/owner/statements/page.tsx` | workspace | shared composition |
| `/owner/units/[unitId]` | `src/app/owner/units/[unitId]/page.tsx` | workspace | shared composition |
| `/property/listings/[unitId]` | `src/app/property/listings/[unitId]/page.tsx` | root only | token layout; no composition marker |
| `/property/listings` | `src/app/property/listings/page.tsx` | root only | shared composition |
| `/property/onboard` | `src/app/property/onboard/page.tsx` | root only | shared composition |
| `/provider/apply` | `src/app/provider/apply/page.tsx` | workspace | shared composition |
| `/provider` | `src/app/provider/page.tsx` | workspace | shared composition |
| `/provider/remittances` | `src/app/provider/remittances/page.tsx` | workspace | shared composition |
| `/provider/services` | `src/app/provider/services/page.tsx` | workspace | shared composition |
| `/register` | `src/app/register/page.tsx` | consumer | shared composition |
| `/residence` | `src/app/residence/page.tsx` | consumer | shared composition |
| `/saved` | `src/app/saved/page.tsx` | consumer | shared composition |
| `/search` | `src/app/search/page.tsx` | consumer | shared composition |
| `/services/[id]` | `src/app/services/[id]/page.tsx` | consumer | shared composition |
| `/services/orders/[orderId]` | `src/app/services/orders/[orderId]/page.tsx` | consumer | shared composition |
| `/services/orders` | `src/app/services/orders/page.tsx` | consumer | shared composition |
| `/services` | `src/app/services/page.tsx` | consumer | shared composition |
| `/tickets/[id]` | `src/app/tickets/[id]/page.tsx` | consumer | shared composition |
| `/tickets/new` | `src/app/tickets/new/page.tsx` | consumer | shared composition |
| `/tickets` | `src/app/tickets/page.tsx` | consumer | shared composition |
| `/trips/[id]` | `src/app/trips/[id]/page.tsx` | consumer | shared composition |
| `/trips` | `src/app/trips/page.tsx` | consumer | shared composition |
| `/units/[id]` | `src/app/units/[id]/page.tsx` | consumer | shared composition |

## Typography correction in the combined release

The 24 undefined `text-caption` usages in the seven listed admin/MC/provider files were replaced with canonical `text-small`. The two undefined `text-heading-lg` section headings in admin property onboarding and `PropertyDealClient` were replaced with canonical `text-title`. These changes reuse the existing theme and do not alter data, permissions or writers. The original gap table remains baseline evidence; this typography finding is **fixed in source**, awaiting the parent release build/deploy/runtime review. No new implementation-mirroring tests were introduced for utility renames. Selected ESLint result is recorded below.

Validation: selected ESLint over all nine changed production files **passed (exit 0)**. Source rescan confirms neither undefined typography utility remains in these files. Runtime verification and production deployment are not claimed by this source correction.
