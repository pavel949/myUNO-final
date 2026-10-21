# Полный справочник исходников

Сгенерировано `node scripts/generate-repository-reference.mjs`. Последняя ревизия исполняемого кода: `ef7746877e4c467ba16630aea8e1667ef0396b0c`. Содержимое соответствует текущему checkout; uncommitted изменения также входят в discovery.

Это статический справочник: файлы/exports/маршруты/модели/переменные. Не доказывает достижимость, права, production deploy, применение миграций или прохождение тестов. Handlers могут дополнительно экспортировать методы через re-export; для точного contract читать source.

[Система](SYSTEM.md) · [Статус](IMPLEMENTATION_STATUS.md) · [JSON inventory](inventory.json)

## Количества

| Объект | Количество |
|---|---:|
| pages | 177 |
| handlers | 256 |
| apiHandlers | 251 |
| modules | 22 |
| tests | 575 |
| prismaModels | 122 |
| migrations | 96 |
| routeCollisions | 0 |

21 module directories включают workflows (integration tests). src/modules/global-desks.ts — общий helper, отдельным модулем не считается.

## Все страницы

URL с [id]/[slug] — шаблон. Route groups исключены из URL. Redirects в next.config.js читать отдельно.

| URL | Область discovery | Источник |
|---|---|---|
| `/` | public | [src/app/(public)/page.tsx](<../../src/app/(public)/page.tsx>) |
| `/about` | public | [src/app/(public)/about/page.tsx](<../../src/app/(public)/about/page.tsx>) |
| `/account` | guest-or-shared | [src/app/account/page.tsx](<../../src/app/account/page.tsx>) |
| `/admin/finance/reconciliation` | guest-or-shared | [src/app/admin/finance/reconciliation/page.tsx](<../../src/app/admin/finance/reconciliation/page.tsx>) |
| `/announcements` | guest-or-shared | [src/app/announcements/page.tsx](<../../src/app/announcements/page.tsx>) |
| `/app` | app | [src/app/app/page.tsx](<../../src/app/app/page.tsx>) |
| `/app/admin` | platform-admin | [src/app/(admin)/app/admin/page.tsx](<../../src/app/(admin)/app/admin/page.tsx>) |
| `/app/admin/access` | platform-admin | [src/app/(admin)/app/admin/access/page.tsx](<../../src/app/(admin)/app/admin/access/page.tsx>) |
| `/app/admin/announcements` | platform-admin | [src/app/(admin)/app/admin/announcements/page.tsx](<../../src/app/(admin)/app/admin/announcements/page.tsx>) |
| `/app/admin/areas` | platform-admin | [src/app/(admin)/app/admin/areas/page.tsx](<../../src/app/(admin)/app/admin/areas/page.tsx>) |
| `/app/admin/audit` | platform-admin | [src/app/(admin)/app/admin/audit/page.tsx](<../../src/app/(admin)/app/admin/audit/page.tsx>) |
| `/app/admin/bookings` | platform-admin | [src/app/(admin)/app/admin/bookings/page.tsx](<../../src/app/(admin)/app/admin/bookings/page.tsx>) |
| `/app/admin/bookings/[id]/journey` | platform-admin | [src/app/(admin)/app/admin/bookings/[id]/journey/page.tsx](<../../src/app/(admin)/app/admin/bookings/[id]/journey/page.tsx>) |
| `/app/admin/claims` | platform-admin | [src/app/(admin)/app/admin/claims/page.tsx](<../../src/app/(admin)/app/admin/claims/page.tsx>) |
| `/app/admin/compliance` | platform-admin | [src/app/(admin)/app/admin/compliance/page.tsx](<../../src/app/(admin)/app/admin/compliance/page.tsx>) |
| `/app/admin/compliance-checklists` | platform-admin | [src/app/(admin)/app/admin/compliance-checklists/page.tsx](<../../src/app/(admin)/app/admin/compliance-checklists/page.tsx>) |
| `/app/admin/config` | platform-admin | [src/app/(admin)/app/admin/config/page.tsx](<../../src/app/(admin)/app/admin/config/page.tsx>) |
| `/app/admin/content` | platform-admin | [src/app/(admin)/app/admin/content/page.tsx](<../../src/app/(admin)/app/admin/content/page.tsx>) |
| `/app/admin/content/homepage` | platform-admin | [src/app/(admin)/app/admin/content/homepage/page.tsx](<../../src/app/(admin)/app/admin/content/homepage/page.tsx>) |
| `/app/admin/contracts` | platform-admin | [src/app/(admin)/app/admin/contracts/page.tsx](<../../src/app/(admin)/app/admin/contracts/page.tsx>) |
| `/app/admin/crm` | platform-admin | [src/app/(admin)/app/admin/crm/page.tsx](<../../src/app/(admin)/app/admin/crm/page.tsx>) |
| `/app/admin/crm/opportunities/[id]` | platform-admin | [src/app/(admin)/app/admin/crm/opportunities/[id]/page.tsx](<../../src/app/(admin)/app/admin/crm/opportunities/[id]/page.tsx>) |
| `/app/admin/crm/opportunities/[id]/deal` | platform-admin | [src/app/(admin)/app/admin/crm/opportunities/[id]/deal/page.tsx](<../../src/app/(admin)/app/admin/crm/opportunities/[id]/deal/page.tsx>) |
| `/app/admin/developers/[id]` | platform-admin | [src/app/(admin)/app/admin/developers/[id]/page.tsx](<../../src/app/(admin)/app/admin/developers/[id]/page.tsx>) |
| `/app/admin/disputes` | platform-admin | [src/app/(admin)/app/admin/disputes/page.tsx](<../../src/app/(admin)/app/admin/disputes/page.tsx>) |
| `/app/admin/incidents` | platform-admin | [src/app/(admin)/app/admin/incidents/page.tsx](<../../src/app/(admin)/app/admin/incidents/page.tsx>) |
| `/app/admin/integrations` | platform-admin | [src/app/(admin)/app/admin/integrations/page.tsx](<../../src/app/(admin)/app/admin/integrations/page.tsx>) |
| `/app/admin/launch-readiness` | platform-admin | [src/app/(admin)/app/admin/launch-readiness/page.tsx](<../../src/app/(admin)/app/admin/launch-readiness/page.tsx>) |
| `/app/admin/layantara` | platform-admin | [src/app/(admin)/app/admin/layantara/page.tsx](<../../src/app/(admin)/app/admin/layantara/page.tsx>) |
| `/app/admin/ledger` | platform-admin | [src/app/(admin)/app/admin/ledger/page.tsx](<../../src/app/(admin)/app/admin/ledger/page.tsx>) |
| `/app/admin/operational-kpis` | platform-admin | [src/app/(admin)/app/admin/operational-kpis/page.tsx](<../../src/app/(admin)/app/admin/operational-kpis/page.tsx>) |
| `/app/admin/organizations` | platform-admin | [src/app/(admin)/app/admin/organizations/page.tsx](<../../src/app/(admin)/app/admin/organizations/page.tsx>) |
| `/app/admin/payouts` | platform-admin | [src/app/(admin)/app/admin/payouts/page.tsx](<../../src/app/(admin)/app/admin/payouts/page.tsx>) |
| `/app/admin/people` | platform-admin | [src/app/(admin)/app/admin/people/page.tsx](<../../src/app/(admin)/app/admin/people/page.tsx>) |
| `/app/admin/processes` | platform-admin | [src/app/(admin)/app/admin/processes/page.tsx](<../../src/app/(admin)/app/admin/processes/page.tsx>) |
| `/app/admin/projects` | platform-admin | [src/app/(admin)/app/admin/projects/page.tsx](<../../src/app/(admin)/app/admin/projects/page.tsx>) |
| `/app/admin/projects/[id]` | platform-admin | [src/app/(admin)/app/admin/projects/[id]/page.tsx](<../../src/app/(admin)/app/admin/projects/[id]/page.tsx>) |
| `/app/admin/projects/[id]/amenities/[amenityId]/reservations` | platform-admin | [src/app/(admin)/app/admin/projects/[id]/amenities/[amenityId]/reservations/page.tsx](<../../src/app/(admin)/app/admin/projects/[id]/amenities/[amenityId]/reservations/page.tsx>) |
| `/app/admin/projects/[id]/experience` | platform-admin | [src/app/(admin)/app/admin/projects/[id]/experience/page.tsx](<../../src/app/(admin)/app/admin/projects/[id]/experience/page.tsx>) |
| `/app/admin/projects/[id]/inventory` | platform-admin | [src/app/(admin)/app/admin/projects/[id]/inventory/page.tsx](<../../src/app/(admin)/app/admin/projects/[id]/inventory/page.tsx>) |
| `/app/admin/projects/[id]/media` | platform-admin | [src/app/(admin)/app/admin/projects/[id]/media/page.tsx](<../../src/app/(admin)/app/admin/projects/[id]/media/page.tsx>) |
| `/app/admin/projects/[id]/preview` | platform-admin | [src/app/(admin)/app/admin/projects/[id]/preview/page.tsx](<../../src/app/(admin)/app/admin/projects/[id]/preview/page.tsx>) |
| `/app/admin/projects/[id]/services` | platform-admin | [src/app/(admin)/app/admin/projects/[id]/services/page.tsx](<../../src/app/(admin)/app/admin/projects/[id]/services/page.tsx>) |
| `/app/admin/projects/[id]/structure` | platform-admin | [src/app/(admin)/app/admin/projects/[id]/structure/page.tsx](<../../src/app/(admin)/app/admin/projects/[id]/structure/page.tsx>) |
| `/app/admin/properties/[id]/onboarding` | platform-admin | [src/app/(admin)/app/admin/properties/[id]/onboarding/page.tsx](<../../src/app/(admin)/app/admin/properties/[id]/onboarding/page.tsx>) |
| `/app/admin/properties/new` | platform-admin | [src/app/(admin)/app/admin/properties/new/page.tsx](<../../src/app/(admin)/app/admin/properties/new/page.tsx>) |
| `/app/admin/property-content-proposals` | platform-admin | [src/app/(admin)/app/admin/property-content-proposals/page.tsx](<../../src/app/(admin)/app/admin/property-content-proposals/page.tsx>) |
| `/app/admin/property-submissions` | platform-admin | [src/app/(admin)/app/admin/property-submissions/page.tsx](<../../src/app/(admin)/app/admin/property-submissions/page.tsx>) |
| `/app/admin/prospecting` | platform-admin | [src/app/(admin)/app/admin/prospecting/page.tsx](<../../src/app/(admin)/app/admin/prospecting/page.tsx>) |
| `/app/admin/providers` | platform-admin | [src/app/(admin)/app/admin/providers/page.tsx](<../../src/app/(admin)/app/admin/providers/page.tsx>) |
| `/app/admin/reports/attribution` | platform-admin | [src/app/(admin)/app/admin/reports/attribution/page.tsx](<../../src/app/(admin)/app/admin/reports/attribution/page.tsx>) |
| `/app/admin/scheduler` | platform-admin | [src/app/(admin)/app/admin/scheduler/page.tsx](<../../src/app/(admin)/app/admin/scheduler/page.tsx>) |
| `/app/admin/service-orders` | platform-admin | [src/app/(admin)/app/admin/service-orders/page.tsx](<../../src/app/(admin)/app/admin/service-orders/page.tsx>) |
| `/app/admin/services` | platform-admin | [src/app/(admin)/app/admin/services/page.tsx](<../../src/app/(admin)/app/admin/services/page.tsx>) |
| `/app/admin/signals` | platform-admin | [src/app/(admin)/app/admin/signals/page.tsx](<../../src/app/(admin)/app/admin/signals/page.tsx>) |
| `/app/admin/statements` | platform-admin | [src/app/(admin)/app/admin/statements/page.tsx](<../../src/app/(admin)/app/admin/statements/page.tsx>) |
| `/app/admin/tickets` | platform-admin | [src/app/(admin)/app/admin/tickets/page.tsx](<../../src/app/(admin)/app/admin/tickets/page.tsx>) |
| `/app/admin/units` | platform-admin | [src/app/(admin)/app/admin/units/page.tsx](<../../src/app/(admin)/app/admin/units/page.tsx>) |
| `/app/admin/units/[id]` | platform-admin | [src/app/(admin)/app/admin/units/[id]/page.tsx](<../../src/app/(admin)/app/admin/units/[id]/page.tsx>) |
| `/app/admin/units/[id]/structure` | platform-admin | [src/app/(admin)/app/admin/units/[id]/structure/page.tsx](<../../src/app/(admin)/app/admin/units/[id]/structure/page.tsx>) |
| `/areas` | guest-or-shared | [src/app/areas/page.tsx](<../../src/app/areas/page.tsx>) |
| `/areas/[slug]` | guest-or-shared | [src/app/areas/[slug]/page.tsx](<../../src/app/areas/[slug]/page.tsx>) |
| `/auth/claim` | auth | [src/app/auth/claim/page.tsx](<../../src/app/auth/claim/page.tsx>) |
| `/auth/reset-password` | auth | [src/app/auth/reset-password/page.tsx](<../../src/app/auth/reset-password/page.tsx>) |
| `/auth/verify` | auth | [src/app/auth/verify/page.tsx](<../../src/app/auth/verify/page.tsx>) |
| `/book/review` | guest-or-shared | [src/app/book/review/page.tsx](<../../src/app/book/review/page.tsx>) |
| `/bookings/[bookingId]/home-space` | guest-or-shared | [src/app/bookings/[bookingId]/home-space/page.tsx](<../../src/app/bookings/[bookingId]/home-space/page.tsx>) |
| `/bookings/[bookingId]/home-space/handbook` | guest-or-shared | [src/app/bookings/[bookingId]/home-space/handbook/page.tsx](<../../src/app/bookings/[bookingId]/home-space/handbook/page.tsx>) |
| `/bookings/[bookingId]/passports` | guest-or-shared | [src/app/bookings/[bookingId]/passports/page.tsx](<../../src/app/bookings/[bookingId]/passports/page.tsx>) |
| `/buyers` | public | [src/app/(public)/buyers/page.tsx](<../../src/app/(public)/buyers/page.tsx>) |
| `/buying` | guest-or-shared | [src/app/buying/page.tsx](<../../src/app/buying/page.tsx>) |
| `/checkout/[sessionId]` | guest-or-shared | [src/app/checkout/[sessionId]/page.tsx](<../../src/app/checkout/[sessionId]/page.tsx>) |
| `/design` | guest-or-shared | [src/app/design/page.tsx](<../../src/app/design/page.tsx>) |
| `/desks` | public | [src/app/(public)/desks/page.tsx](<../../src/app/(public)/desks/page.tsx>) |
| `/desks/[slug]` | public | [src/app/(public)/desks/[slug]/page.tsx](<../../src/app/(public)/desks/[slug]/page.tsx>) |
| `/developers` | public | [src/app/(public)/developers/page.tsx](<../../src/app/(public)/developers/page.tsx>) |
| `/guests` | public | [src/app/(public)/guests/page.tsx](<../../src/app/(public)/guests/page.tsx>) |
| `/guests/access` | public | [src/app/(public)/guests/access/page.tsx](<../../src/app/(public)/guests/access/page.tsx>) |
| `/help` | public | [src/app/(public)/help/page.tsx](<../../src/app/(public)/help/page.tsx>) |
| `/help/choose` | public | [src/app/(public)/help/choose/page.tsx](<../../src/app/(public)/help/choose/page.tsx>) |
| `/help/emergency` | public | [src/app/(public)/help/emergency/page.tsx](<../../src/app/(public)/help/emergency/page.tsx>) |
| `/homes` | guest-or-shared | [src/app/homes/page.tsx](<../../src/app/homes/page.tsx>) |
| `/homes/[id]` | guest-or-shared | [src/app/homes/[id]/page.tsx](<../../src/app/homes/[id]/page.tsx>) |
| `/juristic` | guest-or-shared | [src/app/juristic/page.tsx](<../../src/app/juristic/page.tsx>) |
| `/legal` | public | [src/app/(public)/legal/page.tsx](<../../src/app/(public)/legal/page.tsx>) |
| `/legal/privacy` | public | [src/app/(public)/legal/privacy/page.tsx](<../../src/app/(public)/legal/privacy/page.tsx>) |
| `/legal/terms` | public | [src/app/(public)/legal/terms/page.tsx](<../../src/app/(public)/legal/terms/page.tsx>) |
| `/login` | auth | [src/app/login/page.tsx](<../../src/app/login/page.tsx>) |
| `/manage` | public | [src/app/(public)/manage/page.tsx](<../../src/app/(public)/manage/page.tsx>) |
| `/management-companies` | public | [src/app/(public)/management-companies/page.tsx](<../../src/app/(public)/management-companies/page.tsx>) |
| `/mc` | mc | [src/app/mc/page.tsx](<../../src/app/mc/page.tsx>) |
| `/mc/calendar` | mc | [src/app/mc/calendar/page.tsx](<../../src/app/mc/calendar/page.tsx>) |
| `/mc/costs` | mc | [src/app/mc/costs/page.tsx](<../../src/app/mc/costs/page.tsx>) |
| `/mc/mobilization` | mc | [src/app/mc/mobilization/page.tsx](<../../src/app/mc/mobilization/page.tsx>) |
| `/mc/mobilization/[unitId]` | mc | [src/app/mc/mobilization/[unitId]/page.tsx](<../../src/app/mc/mobilization/[unitId]/page.tsx>) |
| `/mc/portfolio` | mc | [src/app/mc/portfolio/page.tsx](<../../src/app/mc/portfolio/page.tsx>) |
| `/mc/properties/[unitId]` | mc | [src/app/mc/properties/[unitId]/page.tsx](<../../src/app/mc/properties/[unitId]/page.tsx>) |
| `/mc/requests` | mc | [src/app/mc/requests/page.tsx](<../../src/app/mc/requests/page.tsx>) |
| `/mc/tm30` | mc | [src/app/mc/tm30/page.tsx](<../../src/app/mc/tm30/page.tsx>) |
| `/mc/units/[unitId]` | mc | [src/app/mc/units/[unitId]/page.tsx](<../../src/app/mc/units/[unitId]/page.tsx>) |
| `/messages` | guest-or-shared | [src/app/messages/page.tsx](<../../src/app/messages/page.tsx>) |
| `/messages/[threadId]` | guest-or-shared | [src/app/messages/[threadId]/page.tsx](<../../src/app/messages/[threadId]/page.tsx>) |
| `/ops` | ops | [src/app/ops/page.tsx](<../../src/app/ops/page.tsx>) |
| `/ops/calendar` | ops | [src/app/ops/calendar/page.tsx](<../../src/app/ops/calendar/page.tsx>) |
| `/ops/calendar/[unitId]` | ops | [src/app/ops/calendar/[unitId]/page.tsx](<../../src/app/ops/calendar/[unitId]/page.tsx>) |
| `/ops/calendar/board` | ops | [src/app/ops/calendar/board/page.tsx](<../../src/app/ops/calendar/board/page.tsx>) |
| `/ops/claims` | ops | [src/app/ops/claims/page.tsx](<../../src/app/ops/claims/page.tsx>) |
| `/ops/costs` | ops | [src/app/ops/costs/page.tsx](<../../src/app/ops/costs/page.tsx>) |
| `/ops/housekeeping` | ops | [src/app/ops/housekeeping/page.tsx](<../../src/app/ops/housekeeping/page.tsx>) |
| `/ops/maintenance` | ops | [src/app/ops/maintenance/page.tsx](<../../src/app/ops/maintenance/page.tsx>) |
| `/ops/mobilization` | ops | [src/app/ops/mobilization/page.tsx](<../../src/app/ops/mobilization/page.tsx>) |
| `/ops/mobilization/[unitId]` | ops | [src/app/ops/mobilization/[unitId]/page.tsx](<../../src/app/ops/mobilization/[unitId]/page.tsx>) |
| `/ops/new-unit` | ops | [src/app/ops/new-unit/page.tsx](<../../src/app/ops/new-unit/page.tsx>) |
| `/ops/night-audit` | ops | [src/app/ops/night-audit/page.tsx](<../../src/app/ops/night-audit/page.tsx>) |
| `/ops/projects/[id]/edit` | ops | [src/app/ops/projects/[id]/edit/page.tsx](<../../src/app/ops/projects/[id]/edit/page.tsx>) |
| `/ops/refunds` | ops | [src/app/ops/refunds/page.tsx](<../../src/app/ops/refunds/page.tsx>) |
| `/ops/requests` | ops | [src/app/ops/requests/page.tsx](<../../src/app/ops/requests/page.tsx>) |
| `/ops/reservations` | ops | [src/app/ops/reservations/page.tsx](<../../src/app/ops/reservations/page.tsx>) |
| `/ops/sales` | ops | [src/app/ops/sales/page.tsx](<../../src/app/ops/sales/page.tsx>) |
| `/ops/sales/[id]` | ops | [src/app/ops/sales/[id]/page.tsx](<../../src/app/ops/sales/[id]/page.tsx>) |
| `/ops/spaces` | ops | [src/app/ops/spaces/page.tsx](<../../src/app/ops/spaces/page.tsx>) |
| `/ops/spaces/[spaceId]` | ops | [src/app/ops/spaces/[spaceId]/page.tsx](<../../src/app/ops/spaces/[spaceId]/page.tsx>) |
| `/ops/stays` | ops | [src/app/ops/stays/page.tsx](<../../src/app/ops/stays/page.tsx>) |
| `/ops/stays/[bookingId]` | ops | [src/app/ops/stays/[bookingId]/page.tsx](<../../src/app/ops/stays/[bookingId]/page.tsx>) |
| `/ops/stays/[bookingId]/check-in` | ops | [src/app/ops/stays/[bookingId]/check-in/page.tsx](<../../src/app/ops/stays/[bookingId]/check-in/page.tsx>) |
| `/ops/tasks` | ops | [src/app/ops/tasks/page.tsx](<../../src/app/ops/tasks/page.tsx>) |
| `/ops/team` | ops | [src/app/ops/team/page.tsx](<../../src/app/ops/team/page.tsx>) |
| `/ops/tm30` | ops | [src/app/ops/tm30/page.tsx](<../../src/app/ops/tm30/page.tsx>) |
| `/ops/units/[unitId]/edit` | ops | [src/app/ops/units/[unitId]/edit/page.tsx](<../../src/app/ops/units/[unitId]/edit/page.tsx>) |
| `/owner` | owner | [src/app/owner/page.tsx](<../../src/app/owner/page.tsx>) |
| `/owner/statements` | owner | [src/app/owner/statements/page.tsx](<../../src/app/owner/statements/page.tsx>) |
| `/owner/statements/[statementId]` | owner | [src/app/owner/statements/[statementId]/page.tsx](<../../src/app/owner/statements/[statementId]/page.tsx>) |
| `/owner/units/[unitId]` | owner | [src/app/owner/units/[unitId]/page.tsx](<../../src/app/owner/units/[unitId]/page.tsx>) |
| `/owners` | public | [src/app/(public)/owners/page.tsx](<../../src/app/(public)/owners/page.tsx>) |
| `/partners` | public | [src/app/(public)/partners/page.tsx](<../../src/app/(public)/partners/page.tsx>) |
| `/projects` | public | [src/app/(public)/projects/page.tsx](<../../src/app/(public)/projects/page.tsx>) |
| `/projects/[slug]` | public | [src/app/(public)/projects/[slug]/page.tsx](<../../src/app/(public)/projects/[slug]/page.tsx>) |
| `/projects/[slug]/amenities` | public | [src/app/(public)/projects/[slug]/amenities/page.tsx](<../../src/app/(public)/projects/[slug]/amenities/page.tsx>) |
| `/projects/[slug]/amenities/[amenitySlug]` | public | [src/app/(public)/projects/[slug]/amenities/[amenitySlug]/page.tsx](<../../src/app/(public)/projects/[slug]/amenities/[amenitySlug]/page.tsx>) |
| `/projects/[slug]/amenities/[amenitySlug]/book` | public | [src/app/(public)/projects/[slug]/amenities/[amenitySlug]/book/page.tsx](<../../src/app/(public)/projects/[slug]/amenities/[amenitySlug]/book/page.tsx>) |
| `/projects/[slug]/categories/[categoryKey]` | public | [src/app/(public)/projects/[slug]/categories/[categoryKey]/page.tsx](<../../src/app/(public)/projects/[slug]/categories/[categoryKey]/page.tsx>) |
| `/projects/[slug]/passport` | public | [src/app/(public)/projects/[slug]/passport/page.tsx](<../../src/app/(public)/projects/[slug]/passport/page.tsx>) |
| `/property` | guest-or-shared | [src/app/property/page.tsx](<../../src/app/property/page.tsx>) |
| `/property/access` | guest-or-shared | [src/app/property/access/page.tsx](<../../src/app/property/access/page.tsx>) |
| `/property/booking-mode` | guest-or-shared | [src/app/property/booking-mode/page.tsx](<../../src/app/property/booking-mode/page.tsx>) |
| `/property/booking-mode/[unitId]` | guest-or-shared | [src/app/property/booking-mode/[unitId]/page.tsx](<../../src/app/property/booking-mode/[unitId]/page.tsx>) |
| `/property/content` | guest-or-shared | [src/app/property/content/page.tsx](<../../src/app/property/content/page.tsx>) |
| `/property/create` | guest-or-shared | [src/app/property/create/page.tsx](<../../src/app/property/create/page.tsx>) |
| `/property/listings` | guest-or-shared | [src/app/property/listings/page.tsx](<../../src/app/property/listings/page.tsx>) |
| `/property/listings/[unitId]` | guest-or-shared | [src/app/property/listings/[unitId]/page.tsx](<../../src/app/property/listings/[unitId]/page.tsx>) |
| `/property/onboard` | guest-or-shared | [src/app/property/onboard/page.tsx](<../../src/app/property/onboard/page.tsx>) |
| `/property/pricing` | guest-or-shared | [src/app/property/pricing/page.tsx](<../../src/app/property/pricing/page.tsx>) |
| `/property/pricing/[unitId]` | guest-or-shared | [src/app/property/pricing/[unitId]/page.tsx](<../../src/app/property/pricing/[unitId]/page.tsx>) |
| `/provider` | provider | [src/app/provider/page.tsx](<../../src/app/provider/page.tsx>) |
| `/provider/apply` | provider | [src/app/provider/apply/page.tsx](<../../src/app/provider/apply/page.tsx>) |
| `/provider/remittances` | provider | [src/app/provider/remittances/page.tsx](<../../src/app/provider/remittances/page.tsx>) |
| `/provider/services` | provider | [src/app/provider/services/page.tsx](<../../src/app/provider/services/page.tsx>) |
| `/providers` | public | [src/app/(public)/providers/page.tsx](<../../src/app/(public)/providers/page.tsx>) |
| `/register` | auth | [src/app/register/page.tsx](<../../src/app/register/page.tsx>) |
| `/relocation` | public | [src/app/(public)/relocation/page.tsx](<../../src/app/(public)/relocation/page.tsx>) |
| `/rent-out` | public | [src/app/(public)/rent-out/page.tsx](<../../src/app/(public)/rent-out/page.tsx>) |
| `/residence` | guest-or-shared | [src/app/residence/page.tsx](<../../src/app/residence/page.tsx>) |
| `/saved` | guest-or-shared | [src/app/saved/page.tsx](<../../src/app/saved/page.tsx>) |
| `/search` | guest-or-shared | [src/app/search/page.tsx](<../../src/app/search/page.tsx>) |
| `/sell` | public | [src/app/(public)/sell/page.tsx](<../../src/app/(public)/sell/page.tsx>) |
| `/services` | guest-or-shared | [src/app/services/page.tsx](<../../src/app/services/page.tsx>) |
| `/services/[id]` | guest-or-shared | [src/app/services/[id]/page.tsx](<../../src/app/services/[id]/page.tsx>) |
| `/services/orders` | guest-or-shared | [src/app/services/orders/page.tsx](<../../src/app/services/orders/page.tsx>) |
| `/services/orders/[orderId]` | guest-or-shared | [src/app/services/orders/[orderId]/page.tsx](<../../src/app/services/orders/[orderId]/page.tsx>) |
| `/tickets` | guest-or-shared | [src/app/tickets/page.tsx](<../../src/app/tickets/page.tsx>) |
| `/tickets/[id]` | guest-or-shared | [src/app/tickets/[id]/page.tsx](<../../src/app/tickets/[id]/page.tsx>) |
| `/tickets/new` | guest-or-shared | [src/app/tickets/new/page.tsx](<../../src/app/tickets/new/page.tsx>) |
| `/trips` | guest-or-shared | [src/app/trips/page.tsx](<../../src/app/trips/page.tsx>) |
| `/trips/[id]` | guest-or-shared | [src/app/trips/[id]/page.tsx](<../../src/app/trips/[id]/page.tsx>) |
| `/trust` | public | [src/app/(public)/trust/page.tsx](<../../src/app/(public)/trust/page.tsx>) |
| `/trust/ombudsman` | public | [src/app/(public)/trust/ombudsman/page.tsx](<../../src/app/(public)/trust/ombudsman/page.tsx>) |
| `/units/[id]` | guest-or-shared | [src/app/units/[id]/page.tsx](<../../src/app/units/[id]/page.tsx>) |

## Все route handlers

Это индекс методов/исходников, не OpenAPI spec. Payload, validation, auth/scope, DTO и ошибки определяются соответствующим route и вызываемым сервисом; названия URL не гарантируют access. Не вызывать mutating endpoints для проверки документации.

| URL | Явно экспортированные методы | Источник |
|---|---|---|
| `/[vanitySlug]` | GET | [src/app/[vanitySlug]/route.ts](<../../src/app/[vanitySlug]/route.ts>) |
| `/[vanitySlug]/guest` | GET | [src/app/[vanitySlug]/guest/route.ts](<../../src/app/[vanitySlug]/guest/route.ts>) |
| `/api/account/consent` | GET, PUT | [src/app/api/account/consent/route.ts](<../../src/app/api/account/consent/route.ts>) |
| `/api/account/notifications` | GET, PUT | [src/app/api/account/notifications/route.ts](<../../src/app/api/account/notifications/route.ts>) |
| `/api/account/password` | POST | [src/app/api/account/password/route.ts](<../../src/app/api/account/password/route.ts>) |
| `/api/account/profile` | GET, PUT | [src/app/api/account/profile/route.ts](<../../src/app/api/account/profile/route.ts>) |
| `/api/admin/areas` | GET, POST | [src/app/api/admin/areas/route.ts](<../../src/app/api/admin/areas/route.ts>) |
| `/api/admin/areas/[id]` | PATCH | [src/app/api/admin/areas/[id]/route.ts](<../../src/app/api/admin/areas/[id]/route.ts>) |
| `/api/admin/audit/export` | GET | [src/app/api/admin/audit/export/route.ts](<../../src/app/api/admin/audit/export/route.ts>) |
| `/api/admin/bookings` | GET | [src/app/api/admin/bookings/route.ts](<../../src/app/api/admin/bookings/route.ts>) |
| `/api/admin/categories/[id]/media` | GET, POST, PATCH, DELETE | [src/app/api/admin/categories/[id]/media/route.ts](<../../src/app/api/admin/categories/[id]/media/route.ts>) |
| `/api/admin/compliance-checklists` | GET, POST | [src/app/api/admin/compliance-checklists/route.ts](<../../src/app/api/admin/compliance-checklists/route.ts>) |
| `/api/admin/compliance-checklists/[id]` | PUT | [src/app/api/admin/compliance-checklists/[id]/route.ts](<../../src/app/api/admin/compliance-checklists/[id]/route.ts>) |
| `/api/admin/config` | GET | [src/app/api/admin/config/route.ts](<../../src/app/api/admin/config/route.ts>) |
| `/api/admin/config/[paramKey]` | GET, PUT, DELETE | [src/app/api/admin/config/[paramKey]/route.ts](<../../src/app/api/admin/config/[paramKey]/route.ts>) |
| `/api/admin/config/[paramKey]/history` | GET | [src/app/api/admin/config/[paramKey]/history/route.ts](<../../src/app/api/admin/config/[paramKey]/history/route.ts>) |
| `/api/admin/content` | GET | [src/app/api/admin/content/route.ts](<../../src/app/api/admin/content/route.ts>) |
| `/api/admin/content/[keyId]` | GET, PUT | [src/app/api/admin/content/[keyId]/route.ts](<../../src/app/api/admin/content/[keyId]/route.ts>) |
| `/api/admin/content/export` | POST | [src/app/api/admin/content/export/route.ts](<../../src/app/api/admin/content/export/route.ts>) |
| `/api/admin/content/import` | POST | [src/app/api/admin/content/import/route.ts](<../../src/app/api/admin/content/import/route.ts>) |
| `/api/admin/content/namespace/[namespace]` | GET | [src/app/api/admin/content/namespace/[namespace]/route.ts](<../../src/app/api/admin/content/namespace/[namespace]/route.ts>) |
| `/api/admin/contracts` | POST, GET | [src/app/api/admin/contracts/route.ts](<../../src/app/api/admin/contracts/route.ts>) |
| `/api/admin/crm/activities` | POST | [src/app/api/admin/crm/activities/route.ts](<../../src/app/api/admin/crm/activities/route.ts>) |
| `/api/admin/crm/opportunities` | GET, POST | [src/app/api/admin/crm/opportunities/route.ts](<../../src/app/api/admin/crm/opportunities/route.ts>) |
| `/api/admin/crm/opportunities/[opportunityId]/deal` | GET, POST, PATCH | [src/app/api/admin/crm/opportunities/[opportunityId]/deal/route.ts](<../../src/app/api/admin/crm/opportunities/[opportunityId]/deal/route.ts>) |
| `/api/admin/crm/opportunities/[opportunityId]/deal/evidence` | POST, GET | [src/app/api/admin/crm/opportunities/[opportunityId]/deal/evidence/route.ts](<../../src/app/api/admin/crm/opportunities/[opportunityId]/deal/evidence/route.ts>) |
| `/api/admin/crm/opportunities/[opportunityId]/deal/transition` | POST | [src/app/api/admin/crm/opportunities/[opportunityId]/deal/transition/route.ts](<../../src/app/api/admin/crm/opportunities/[opportunityId]/deal/transition/route.ts>) |
| `/api/admin/crm/opportunities/[opportunityId]/transition` | POST | [src/app/api/admin/crm/opportunities/[opportunityId]/transition/route.ts](<../../src/app/api/admin/crm/opportunities/[opportunityId]/transition/route.ts>) |
| `/api/admin/crm/pipeline` | GET | [src/app/api/admin/crm/pipeline/route.ts](<../../src/app/api/admin/crm/pipeline/route.ts>) |
| `/api/admin/crm/profiles/[profileId]/transition` | POST | [src/app/api/admin/crm/profiles/[profileId]/transition/route.ts](<../../src/app/api/admin/crm/profiles/[profileId]/transition/route.ts>) |
| `/api/admin/deposit-claims/[id]` | POST | [src/app/api/admin/deposit-claims/[id]/route.ts](<../../src/app/api/admin/deposit-claims/[id]/route.ts>) |
| `/api/admin/disputes` | GET | [src/app/api/admin/disputes/route.ts](<../../src/app/api/admin/disputes/route.ts>) |
| `/api/admin/disputes/[id]/decide` | POST | [src/app/api/admin/disputes/[id]/decide/route.ts](<../../src/app/api/admin/disputes/[id]/decide/route.ts>) |
| `/api/admin/fees/[contractId]` | GET | [src/app/api/admin/fees/[contractId]/route.ts](<../../src/app/api/admin/fees/[contractId]/route.ts>) |
| `/api/admin/fees/calculate` | POST | [src/app/api/admin/fees/calculate/route.ts](<../../src/app/api/admin/fees/calculate/route.ts>) |
| `/api/admin/finance/reconciliation` | GET | [src/app/api/admin/finance/reconciliation/route.ts](<../../src/app/api/admin/finance/reconciliation/route.ts>) |
| `/api/admin/finance/refunds/[refundId]/resolve` | POST | [src/app/api/admin/finance/refunds/[refundId]/resolve/route.ts](<../../src/app/api/admin/finance/refunds/[refundId]/resolve/route.ts>) |
| `/api/admin/homepage/placements` | GET, POST, PATCH, DELETE | [src/app/api/admin/homepage/placements/route.ts](<../../src/app/api/admin/homepage/placements/route.ts>) |
| `/api/admin/incidents` | GET, POST | [src/app/api/admin/incidents/route.ts](<../../src/app/api/admin/incidents/route.ts>) |
| `/api/admin/incidents/[id]` | PUT | [src/app/api/admin/incidents/[id]/route.ts](<../../src/app/api/admin/incidents/[id]/route.ts>) |
| `/api/admin/layantara/reservations-import` | POST | [src/app/api/admin/layantara/reservations-import/route.ts](<../../src/app/api/admin/layantara/reservations-import/route.ts>) |
| `/api/admin/ledger` | GET | [src/app/api/admin/ledger/route.ts](<../../src/app/api/admin/ledger/route.ts>) |
| `/api/admin/ledger/[entryId]/reverse` | POST | [src/app/api/admin/ledger/[entryId]/reverse/route.ts](<../../src/app/api/admin/ledger/[entryId]/reverse/route.ts>) |
| `/api/admin/media/import-managed` | POST | [src/app/api/admin/media/import-managed/route.ts](<../../src/app/api/admin/media/import-managed/route.ts>) |
| `/api/admin/operating-spaces` | POST | [src/app/api/admin/operating-spaces/route.ts](<../../src/app/api/admin/operating-spaces/route.ts>) |
| `/api/admin/operating-spaces/[spaceId]/members` | PUT | [src/app/api/admin/operating-spaces/[spaceId]/members/route.ts](<../../src/app/api/admin/operating-spaces/[spaceId]/members/route.ts>) |
| `/api/admin/operating-spaces/[spaceId]/scope` | PUT | [src/app/api/admin/operating-spaces/[spaceId]/scope/route.ts](<../../src/app/api/admin/operating-spaces/[spaceId]/scope/route.ts>) |
| `/api/admin/operational-kpis` | GET, POST | [src/app/api/admin/operational-kpis/route.ts](<../../src/app/api/admin/operational-kpis/route.ts>) |
| `/api/admin/organizations` | GET, POST | [src/app/api/admin/organizations/route.ts](<../../src/app/api/admin/organizations/route.ts>) |
| `/api/admin/organizations/[organizationId]` | PUT, DELETE | [src/app/api/admin/organizations/[organizationId]/route.ts](<../../src/app/api/admin/organizations/[organizationId]/route.ts>) |
| `/api/admin/payouts/[payoutId]/reconcile` | PUT | [src/app/api/admin/payouts/[payoutId]/reconcile/route.ts](<../../src/app/api/admin/payouts/[payoutId]/reconcile/route.ts>) |
| `/api/admin/payouts/owner` | POST | [src/app/api/admin/payouts/owner/route.ts](<../../src/app/api/admin/payouts/owner/route.ts>) |
| `/api/admin/payouts/provider` | POST | [src/app/api/admin/payouts/provider/route.ts](<../../src/app/api/admin/payouts/provider/route.ts>) |
| `/api/admin/payouts/provider/preview` | GET | [src/app/api/admin/payouts/provider/preview/route.ts](<../../src/app/api/admin/payouts/provider/preview/route.ts>) |
| `/api/admin/people/[identityId]/block` | POST | [src/app/api/admin/people/[identityId]/block/route.ts](<../../src/app/api/admin/people/[identityId]/block/route.ts>) |
| `/api/admin/people/[identityId]/roles` | GET | [src/app/api/admin/people/[identityId]/roles/route.ts](<../../src/app/api/admin/people/[identityId]/roles/route.ts>) |
| `/api/admin/people/[identityId]/unblock` | POST | [src/app/api/admin/people/[identityId]/unblock/route.ts](<../../src/app/api/admin/people/[identityId]/unblock/route.ts>) |
| `/api/admin/people/invite` | POST | [src/app/api/admin/people/invite/route.ts](<../../src/app/api/admin/people/invite/route.ts>) |
| `/api/admin/people/search` | GET | [src/app/api/admin/people/search/route.ts](<../../src/app/api/admin/people/search/route.ts>) |
| `/api/admin/project-team` | GET, PUT | [src/app/api/admin/project-team/route.ts](<../../src/app/api/admin/project-team/route.ts>) |
| `/api/admin/projects` | POST, GET | [src/app/api/admin/projects/route.ts](<../../src/app/api/admin/projects/route.ts>) |
| `/api/admin/projects/[id]` | PUT, GET | [src/app/api/admin/projects/[id]/route.ts](<../../src/app/api/admin/projects/[id]/route.ts>) |
| `/api/admin/projects/[id]/amenities` | GET, POST | [src/app/api/admin/projects/[id]/amenities/route.ts](<../../src/app/api/admin/projects/[id]/amenities/route.ts>) |
| `/api/admin/projects/[id]/amenities/[amenityId]` | PATCH, DELETE | [src/app/api/admin/projects/[id]/amenities/[amenityId]/route.ts](<../../src/app/api/admin/projects/[id]/amenities/[amenityId]/route.ts>) |
| `/api/admin/projects/[id]/amenities/[amenityId]/content` | GET, PUT | [src/app/api/admin/projects/[id]/amenities/[amenityId]/content/route.ts](<../../src/app/api/admin/projects/[id]/amenities/[amenityId]/content/route.ts>) |
| `/api/admin/projects/[id]/amenities/[amenityId]/media` | POST, PATCH, DELETE | [src/app/api/admin/projects/[id]/amenities/[amenityId]/media/route.ts](<../../src/app/api/admin/projects/[id]/amenities/[amenityId]/media/route.ts>) |
| `/api/admin/projects/[id]/catalog` | GET, POST | [src/app/api/admin/projects/[id]/catalog/route.ts](<../../src/app/api/admin/projects/[id]/catalog/route.ts>) |
| `/api/admin/projects/[id]/experience/content` | PUT | [src/app/api/admin/projects/[id]/experience/content/route.ts](<../../src/app/api/admin/projects/[id]/experience/content/route.ts>) |
| `/api/admin/projects/[id]/media` | GET, POST, PATCH, DELETE | [src/app/api/admin/projects/[id]/media/route.ts](<../../src/app/api/admin/projects/[id]/media/route.ts>) |
| `/api/admin/projects/[id]/owner-evidence` | GET, PUT | [src/app/api/admin/projects/[id]/owner-evidence/route.ts](<../../src/app/api/admin/projects/[id]/owner-evidence/route.ts>) |
| `/api/admin/projects/[id]/places` | GET, POST | [src/app/api/admin/projects/[id]/places/route.ts](<../../src/app/api/admin/projects/[id]/places/route.ts>) |
| `/api/admin/projects/[id]/places/[placeId]` | PATCH, DELETE | [src/app/api/admin/projects/[id]/places/[placeId]/route.ts](<../../src/app/api/admin/projects/[id]/places/[placeId]/route.ts>) |
| `/api/admin/projects/[id]/services` | PATCH | [src/app/api/admin/projects/[id]/services/route.ts](<../../src/app/api/admin/projects/[id]/services/route.ts>) |
| `/api/admin/projects/[id]/structure` | GET, POST | [src/app/api/admin/projects/[id]/structure/route.ts](<../../src/app/api/admin/projects/[id]/structure/route.ts>) |
| `/api/admin/projects/[id]/structure/[nodeId]` | PATCH, DELETE | [src/app/api/admin/projects/[id]/structure/[nodeId]/route.ts](<../../src/app/api/admin/projects/[id]/structure/[nodeId]/route.ts>) |
| `/api/admin/property-content-proposals/[id]/review` | POST | [src/app/api/admin/property-content-proposals/[id]/review/route.ts](<../../src/app/api/admin/property-content-proposals/[id]/review/route.ts>) |
| `/api/admin/property-submissions/[id]/convert` | POST | [src/app/api/admin/property-submissions/[id]/convert/route.ts](<../../src/app/api/admin/property-submissions/[id]/convert/route.ts>) |
| `/api/admin/prospecting` | GET, POST | [src/app/api/admin/prospecting/route.ts](<../../src/app/api/admin/prospecting/route.ts>) |
| `/api/admin/prospecting/[id]/transition` | POST | [src/app/api/admin/prospecting/[id]/transition/route.ts](<../../src/app/api/admin/prospecting/[id]/transition/route.ts>) |
| `/api/admin/providers` | GET | [src/app/api/admin/providers/route.ts](<../../src/app/api/admin/providers/route.ts>) |
| `/api/admin/providers/[id]` | PATCH | [src/app/api/admin/providers/[id]/route.ts](<../../src/app/api/admin/providers/[id]/route.ts>) |
| `/api/admin/regulatory-credentials` | GET, POST | [src/app/api/admin/regulatory-credentials/route.ts](<../../src/app/api/admin/regulatory-credentials/route.ts>) |
| `/api/admin/regulatory-credentials/[id]` | PUT | [src/app/api/admin/regulatory-credentials/[id]/route.ts](<../../src/app/api/admin/regulatory-credentials/[id]/route.ts>) |
| `/api/admin/regulatory-credentials/evidence` | POST, GET | [src/app/api/admin/regulatory-credentials/evidence/route.ts](<../../src/app/api/admin/regulatory-credentials/evidence/route.ts>) |
| `/api/admin/reports/attribution` | GET | [src/app/api/admin/reports/attribution/route.ts](<../../src/app/api/admin/reports/attribution/route.ts>) |
| `/api/admin/roles/grant` | POST | [src/app/api/admin/roles/grant/route.ts](<../../src/app/api/admin/roles/grant/route.ts>) |
| `/api/admin/roles/revoke` | POST | [src/app/api/admin/roles/revoke/route.ts](<../../src/app/api/admin/roles/revoke/route.ts>) |
| `/api/admin/roles/units` | GET | [src/app/api/admin/roles/units/route.ts](<../../src/app/api/admin/roles/units/route.ts>) |
| `/api/admin/secrets` | PUT, POST, DELETE | [src/app/api/admin/secrets/route.ts](<../../src/app/api/admin/secrets/route.ts>) |
| `/api/admin/service-orders` | GET | [src/app/api/admin/service-orders/route.ts](<../../src/app/api/admin/service-orders/route.ts>) |
| `/api/admin/services` | GET, POST | [src/app/api/admin/services/route.ts](<../../src/app/api/admin/services/route.ts>) |
| `/api/admin/services/[id]` | PATCH | [src/app/api/admin/services/[id]/route.ts](<../../src/app/api/admin/services/[id]/route.ts>) |
| `/api/admin/statements/[statementId]/line-items` | GET | [src/app/api/admin/statements/[statementId]/line-items/route.ts](<../../src/app/api/admin/statements/[statementId]/line-items/route.ts>) |
| `/api/admin/statements/[statementId]/sign-off` | PUT | [src/app/api/admin/statements/[statementId]/sign-off/route.ts](<../../src/app/api/admin/statements/[statementId]/sign-off/route.ts>) |
| `/api/admin/statements/generate` | POST | [src/app/api/admin/statements/generate/route.ts](<../../src/app/api/admin/statements/generate/route.ts>) |
| `/api/admin/units` | POST, GET | [src/app/api/admin/units/route.ts](<../../src/app/api/admin/units/route.ts>) |
| `/api/admin/units/[id]` | PUT, GET | [src/app/api/admin/units/[id]/route.ts](<../../src/app/api/admin/units/[id]/route.ts>) |
| `/api/admin/units/[id]/booking-mode` | PUT | [src/app/api/admin/units/[id]/booking-mode/route.ts](<../../src/app/api/admin/units/[id]/booking-mode/route.ts>) |
| `/api/admin/units/[id]/compliance` | GET, POST | [src/app/api/admin/units/[id]/compliance/route.ts](<../../src/app/api/admin/units/[id]/compliance/route.ts>) |
| `/api/admin/units/[id]/compliance/[recordId]` | PATCH | [src/app/api/admin/units/[id]/compliance/[recordId]/route.ts](<../../src/app/api/admin/units/[id]/compliance/[recordId]/route.ts>) |
| `/api/admin/units/[id]/confirm-permitted-use` | POST | [src/app/api/admin/units/[id]/confirm-permitted-use/route.ts](<../../src/app/api/admin/units/[id]/confirm-permitted-use/route.ts>) |
| `/api/admin/units/[id]/engagement` | GET, POST, PUT | [src/app/api/admin/units/[id]/engagement/route.ts](<../../src/app/api/admin/units/[id]/engagement/route.ts>) |
| `/api/admin/units/[id]/media` | GET, POST, PATCH, DELETE | [src/app/api/admin/units/[id]/media/route.ts](<../../src/app/api/admin/units/[id]/media/route.ts>) |
| `/api/admin/units/[id]/mobilization` | GET, POST | [src/app/api/admin/units/[id]/mobilization/route.ts](<../../src/app/api/admin/units/[id]/mobilization/route.ts>) |
| `/api/admin/units/[id]/mobilization/[itemId]` | POST | [src/app/api/admin/units/[id]/mobilization/[itemId]/route.ts](<../../src/app/api/admin/units/[id]/mobilization/[itemId]/route.ts>) |
| `/api/admin/units/[id]/owner` | GET, PUT | [src/app/api/admin/units/[id]/owner/route.ts](<../../src/app/api/admin/units/[id]/owner/route.ts>) |
| `/api/admin/units/[id]/property-details` | GET, POST | [src/app/api/admin/units/[id]/property-details/route.ts](<../../src/app/api/admin/units/[id]/property-details/route.ts>) |
| `/api/admin/units/[id]/status` | PUT | [src/app/api/admin/units/[id]/status/route.ts](<../../src/app/api/admin/units/[id]/status/route.ts>) |
| `/api/admin/units/[id]/tariff` | GET, PUT | [src/app/api/admin/units/[id]/tariff/route.ts](<../../src/app/api/admin/units/[id]/tariff/route.ts>) |
| `/api/admin/units/[id]/tariff-preview` | POST | [src/app/api/admin/units/[id]/tariff-preview/route.ts](<../../src/app/api/admin/units/[id]/tariff-preview/route.ts>) |
| `/api/analytics/public` | POST | [src/app/api/analytics/public/route.ts](<../../src/app/api/analytics/public/route.ts>) |
| `/api/announcements` | POST | [src/app/api/announcements/route.ts](<../../src/app/api/announcements/route.ts>) |
| `/api/announcements/[id]` | PATCH, DELETE | [src/app/api/announcements/[id]/route.ts](<../../src/app/api/announcements/[id]/route.ts>) |
| `/api/announcements/[id]/publish` | POST, DELETE | [src/app/api/announcements/[id]/publish/route.ts](<../../src/app/api/announcements/[id]/publish/route.ts>) |
| `/api/auth/callback/google` | GET | [src/app/api/auth/callback/google/route.ts](<../../src/app/api/auth/callback/google/route.ts>) |
| `/api/auth/claim` | POST | [src/app/api/auth/claim/route.ts](<../../src/app/api/auth/claim/route.ts>) |
| `/api/auth/claim/[token]` | GET | [src/app/api/auth/claim/[token]/route.ts](<../../src/app/api/auth/claim/[token]/route.ts>) |
| `/api/auth/claim/generate-link` | POST | [src/app/api/auth/claim/generate-link/route.ts](<../../src/app/api/auth/claim/generate-link/route.ts>) |
| `/api/auth/forgot-password` | POST | [src/app/api/auth/forgot-password/route.ts](<../../src/app/api/auth/forgot-password/route.ts>) |
| `/api/auth/guest-access` | POST | [src/app/api/auth/guest-access/route.ts](<../../src/app/api/auth/guest-access/route.ts>) |
| `/api/auth/login` | POST | [src/app/api/auth/login/route.ts](<../../src/app/api/auth/login/route.ts>) |
| `/api/auth/logout` | POST | [src/app/api/auth/logout/route.ts](<../../src/app/api/auth/logout/route.ts>) |
| `/api/auth/logout-all` | POST | [src/app/api/auth/logout-all/route.ts](<../../src/app/api/auth/logout-all/route.ts>) |
| `/api/auth/me` | GET | [src/app/api/auth/me/route.ts](<../../src/app/api/auth/me/route.ts>) |
| `/api/auth/register` | POST | [src/app/api/auth/register/route.ts](<../../src/app/api/auth/register/route.ts>) |
| `/api/auth/reset-password` | POST | [src/app/api/auth/reset-password/route.ts](<../../src/app/api/auth/reset-password/route.ts>) |
| `/api/auth/verify-email` | POST | [src/app/api/auth/verify-email/route.ts](<../../src/app/api/auth/verify-email/route.ts>) |
| `/api/bookings` | GET, POST | [src/app/api/bookings/route.ts](<../../src/app/api/bookings/route.ts>) |
| `/api/bookings/[id]` | GET | [src/app/api/bookings/[id]/route.ts](<../../src/app/api/bookings/[id]/route.ts>) |
| `/api/bookings/[id]/cancel` | POST | [src/app/api/bookings/[id]/cancel/route.ts](<../../src/app/api/bookings/[id]/cancel/route.ts>) |
| `/api/bookings/[id]/check-out` | POST | [src/app/api/bookings/[id]/check-out/route.ts](<../../src/app/api/bookings/[id]/check-out/route.ts>) |
| `/api/bookings/[id]/checkin` | POST | [src/app/api/bookings/[id]/checkin/route.ts](<../../src/app/api/bookings/[id]/checkin/route.ts>) |
| `/api/bookings/[id]/checkout` | POST | [src/app/api/bookings/[id]/checkout/route.ts](<../../src/app/api/bookings/[id]/checkout/route.ts>) |
| `/api/bookings/[id]/complete` | POST | [src/app/api/bookings/[id]/complete/route.ts](<../../src/app/api/bookings/[id]/complete/route.ts>) |
| `/api/bookings/[id]/confirm-unpaid` | POST | [src/app/api/bookings/[id]/confirm-unpaid/route.ts](<../../src/app/api/bookings/[id]/confirm-unpaid/route.ts>) |
| `/api/bookings/[id]/deposit-claim` | POST | [src/app/api/bookings/[id]/deposit-claim/route.ts](<../../src/app/api/bookings/[id]/deposit-claim/route.ts>) |
| `/api/bookings/[id]/guests` | GET, POST | [src/app/api/bookings/[id]/guests/route.ts](<../../src/app/api/bookings/[id]/guests/route.ts>) |
| `/api/bookings/[id]/internal-note` | POST | [src/app/api/bookings/[id]/internal-note/route.ts](<../../src/app/api/bookings/[id]/internal-note/route.ts>) |
| `/api/bookings/[id]/modify` | POST | [src/app/api/bookings/[id]/modify/route.ts](<../../src/app/api/bookings/[id]/modify/route.ts>) |
| `/api/bookings/[id]/record-cash-payment` | POST | [src/app/api/bookings/[id]/record-cash-payment/route.ts](<../../src/app/api/bookings/[id]/record-cash-payment/route.ts>) |
| `/api/bookings/[id]/record-transfer` | POST | [src/app/api/bookings/[id]/record-transfer/route.ts](<../../src/app/api/bookings/[id]/record-transfer/route.ts>) |
| `/api/bookings/[id]/respond` | POST | [src/app/api/bookings/[id]/respond/route.ts](<../../src/app/api/bookings/[id]/respond/route.ts>) |
| `/api/bookings/[id]/stay-review` | POST | [src/app/api/bookings/[id]/stay-review/route.ts](<../../src/app/api/bookings/[id]/stay-review/route.ts>) |
| `/api/bookings/[id]/transfer-instructions` | GET | [src/app/api/bookings/[id]/transfer-instructions/route.ts](<../../src/app/api/bookings/[id]/transfer-instructions/route.ts>) |
| `/api/bookings/[id]/verify-passports` | POST | [src/app/api/bookings/[id]/verify-passports/route.ts](<../../src/app/api/bookings/[id]/verify-passports/route.ts>) |
| `/api/bookings/me` | GET | [src/app/api/bookings/me/route.ts](<../../src/app/api/bookings/me/route.ts>) |
| `/api/buyer-signals/[signalId]/transition` | POST | [src/app/api/buyer-signals/[signalId]/transition/route.ts](<../../src/app/api/buyer-signals/[signalId]/transition/route.ts>) |
| `/api/buying/interest` | POST | [src/app/api/buying/interest/route.ts](<../../src/app/api/buying/interest/route.ts>) |
| `/api/checkout/[sessionId]` | GET | [src/app/api/checkout/[sessionId]/route.ts](<../../src/app/api/checkout/[sessionId]/route.ts>) |
| `/api/checkout/confirm` | POST | [src/app/api/checkout/confirm/route.ts](<../../src/app/api/checkout/confirm/route.ts>) |
| `/api/content/translate` | POST | [src/app/api/content/translate/route.ts](<../../src/app/api/content/translate/route.ts>) |
| `/api/crm/activities/[id]` | PATCH | [src/app/api/crm/activities/[id]/route.ts](<../../src/app/api/crm/activities/[id]/route.ts>) |
| `/api/crm/dashboard/next-actions` | GET | [src/app/api/crm/dashboard/next-actions/route.ts](<../../src/app/api/crm/dashboard/next-actions/route.ts>) |
| `/api/crm/dashboard/summary` | GET | [src/app/api/crm/dashboard/summary/route.ts](<../../src/app/api/crm/dashboard/summary/route.ts>) |
| `/api/crm/opportunities` | GET | [src/app/api/crm/opportunities/route.ts](<../../src/app/api/crm/opportunities/route.ts>) |
| `/api/crm/opportunities/[id]` | GET, PATCH | [src/app/api/crm/opportunities/[id]/route.ts](<../../src/app/api/crm/opportunities/[id]/route.ts>) |
| `/api/crm/opportunities/[id]/activities` | GET, POST | [src/app/api/crm/opportunities/[id]/activities/route.ts](<../../src/app/api/crm/opportunities/[id]/activities/route.ts>) |
| `/api/crm/opportunities/[id]/stage` | PATCH | [src/app/api/crm/opportunities/[id]/stage/route.ts](<../../src/app/api/crm/opportunities/[id]/stage/route.ts>) |
| `/api/cron/check-tm30-escalations` | POST, GET | [src/app/api/cron/check-tm30-escalations/route.ts](<../../src/app/api/cron/check-tm30-escalations/route.ts>) |
| `/api/cron/check-verification-deadlines` | POST, GET | [src/app/api/cron/check-verification-deadlines/route.ts](<../../src/app/api/cron/check-verification-deadlines/route.ts>) |
| `/api/cron/expire-service-orders` | POST, GET | [src/app/api/cron/expire-service-orders/route.ts](<../../src/app/api/cron/expire-service-orders/route.ts>) |
| `/api/cron/import-managed-yandex-media` | POST, GET | [src/app/api/cron/import-managed-yandex-media/route.ts](<../../src/app/api/cron/import-managed-yandex-media/route.ts>) |
| `/api/cron/retention-jobs` | POST, GET | [src/app/api/cron/retention-jobs/route.ts](<../../src/app/api/cron/retention-jobs/route.ts>) |
| `/api/cron/rollup-metrics` | POST, GET | [src/app/api/cron/rollup-metrics/route.ts](<../../src/app/api/cron/rollup-metrics/route.ts>) |
| `/api/cron/run-all` | POST, GET | [src/app/api/cron/run-all/route.ts](<../../src/app/api/cron/run-all/route.ts>) |
| `/api/cron/run-frequent` | POST, GET | [src/app/api/cron/run-frequent/route.ts](<../../src/app/api/cron/run-frequent/route.ts>) |
| `/api/cron/sync-ical-imports` | POST, GET | [src/app/api/cron/sync-ical-imports/route.ts](<../../src/app/api/cron/sync-ical-imports/route.ts>) |
| `/api/deposit-claims/[id]/dispute` | POST | [src/app/api/deposit-claims/[id]/dispute/route.ts](<../../src/app/api/deposit-claims/[id]/dispute/route.ts>) |
| `/api/disputes` | POST | [src/app/api/disputes/route.ts](<../../src/app/api/disputes/route.ts>) |
| `/api/health` | GET | [src/app/api/health/route.ts](<../../src/app/api/health/route.ts>) |
| `/api/integrations/layantara/events` | POST | [src/app/api/integrations/layantara/events/route.ts](<../../src/app/api/integrations/layantara/events/route.ts>) |
| `/api/leads` | POST | [src/app/api/leads/route.ts](<../../src/app/api/leads/route.ts>) |
| `/api/ledger/receipts` | POST | [src/app/api/ledger/receipts/route.ts](<../../src/app/api/ledger/receipts/route.ts>) |
| `/api/ledger/receipts/[receiptId]` | GET | [src/app/api/ledger/receipts/[receiptId]/route.ts](<../../src/app/api/ledger/receipts/[receiptId]/route.ts>) |
| `/api/ledger/record-cost` | POST | [src/app/api/ledger/record-cost/route.ts](<../../src/app/api/ledger/record-cost/route.ts>) |
| `/api/mc/fee-report` | GET | [src/app/api/mc/fee-report/route.ts](<../../src/app/api/mc/fee-report/route.ts>) |
| `/api/media/upload` | POST | [src/app/api/media/upload/route.ts](<../../src/app/api/media/upload/route.ts>) |
| `/api/messages/[messageId]/flag-as-purchase` | POST | [src/app/api/messages/[messageId]/flag-as-purchase/route.ts](<../../src/app/api/messages/[messageId]/flag-as-purchase/route.ts>) |
| `/api/notifications` | GET, POST | [src/app/api/notifications/route.ts](<../../src/app/api/notifications/route.ts>) |
| `/api/notifications/stream` | GET | [src/app/api/notifications/stream/route.ts](<../../src/app/api/notifications/stream/route.ts>) |
| `/api/ops/calendar/changes` | GET | [src/app/api/ops/calendar/changes/route.ts](<../../src/app/api/ops/calendar/changes/route.ts>) |
| `/api/ops/preventive-maintenance` | GET, POST | [src/app/api/ops/preventive-maintenance/route.ts](<../../src/app/api/ops/preventive-maintenance/route.ts>) |
| `/api/ops/projects/[id]/facts` | GET, PATCH | [src/app/api/ops/projects/[id]/facts/route.ts](<../../src/app/api/ops/projects/[id]/facts/route.ts>) |
| `/api/ops/reservation-groups` | POST | [src/app/api/ops/reservation-groups/route.ts](<../../src/app/api/ops/reservation-groups/route.ts>) |
| `/api/ops/reservation-guests` | POST | [src/app/api/ops/reservation-guests/route.ts](<../../src/app/api/ops/reservation-guests/route.ts>) |
| `/api/ops/reservations` | POST | [src/app/api/ops/reservations/route.ts](<../../src/app/api/ops/reservations/route.ts>) |
| `/api/ops/sales-offers` | POST | [src/app/api/ops/sales-offers/route.ts](<../../src/app/api/ops/sales-offers/route.ts>) |
| `/api/ops/sales-offers/[id]/preview` | POST | [src/app/api/ops/sales-offers/[id]/preview/route.ts](<../../src/app/api/ops/sales-offers/[id]/preview/route.ts>) |
| `/api/ops/sales-offers/[id]/request` | POST | [src/app/api/ops/sales-offers/[id]/request/route.ts](<../../src/app/api/ops/sales-offers/[id]/request/route.ts>) |
| `/api/ops/sales-offers/[id]/shares` | POST, DELETE | [src/app/api/ops/sales-offers/[id]/shares/route.ts](<../../src/app/api/ops/sales-offers/[id]/shares/route.ts>) |
| `/api/ops/sales-offers/search` | POST | [src/app/api/ops/sales-offers/search/route.ts](<../../src/app/api/ops/sales-offers/search/route.ts>) |
| `/api/ops/tasks` | POST | [src/app/api/ops/tasks/route.ts](<../../src/app/api/ops/tasks/route.ts>) |
| `/api/ops/tasks/[id]` | PATCH | [src/app/api/ops/tasks/[id]/route.ts](<../../src/app/api/ops/tasks/[id]/route.ts>) |
| `/api/ops/team` | GET, POST, DELETE | [src/app/api/ops/team/route.ts](<../../src/app/api/ops/team/route.ts>) |
| `/api/ops/units/[id]/access` | GET, PUT | [src/app/api/ops/units/[id]/access/route.ts](<../../src/app/api/ops/units/[id]/access/route.ts>) |
| `/api/owner-stays` | POST | [src/app/api/owner-stays/route.ts](<../../src/app/api/owner-stays/route.ts>) |
| `/api/owner/statements` | GET | [src/app/api/owner/statements/route.ts](<../../src/app/api/owner/statements/route.ts>) |
| `/api/owner/statements/[statementId]/question` | POST | [src/app/api/owner/statements/[statementId]/question/route.ts](<../../src/app/api/owner/statements/[statementId]/question/route.ts>) |
| `/api/owner/statements/[statementId]/sign-off` | PUT | [src/app/api/owner/statements/[statementId]/sign-off/route.ts](<../../src/app/api/owner/statements/[statementId]/sign-off/route.ts>) |
| `/api/owner/units/[unitId]/contract` | GET | [src/app/api/owner/units/[unitId]/contract/route.ts](<../../src/app/api/owner/units/[unitId]/contract/route.ts>) |
| `/api/pricing/breakdown` | POST | [src/app/api/pricing/breakdown/route.ts](<../../src/app/api/pricing/breakdown/route.ts>) |
| `/api/pricing/category-quote` | POST | [src/app/api/pricing/category-quote/route.ts](<../../src/app/api/pricing/category-quote/route.ts>) |
| `/api/profile/export` | GET | [src/app/api/profile/export/route.ts](<../../src/app/api/profile/export/route.ts>) |
| `/api/project-amenities/[amenityId]/reservations` | GET, POST | [src/app/api/project-amenities/[amenityId]/reservations/route.ts](<../../src/app/api/project-amenities/[amenityId]/reservations/route.ts>) |
| `/api/project-amenity-reservations/[id]` | DELETE, PATCH | [src/app/api/project-amenity-reservations/[id]/route.ts](<../../src/app/api/project-amenity-reservations/[id]/route.ts>) |
| `/api/property-access` | GET, POST | [src/app/api/property-access/route.ts](<../../src/app/api/property-access/route.ts>) |
| `/api/property-booking-mode/[unitId]` | POST, PUT | [src/app/api/property-booking-mode/[unitId]/route.ts](<../../src/app/api/property-booking-mode/[unitId]/route.ts>) |
| `/api/property-content-proposals` | GET, POST | [src/app/api/property-content-proposals/route.ts](<../../src/app/api/property-content-proposals/route.ts>) |
| `/api/property-content-proposals/[id]` | GET, PATCH | [src/app/api/property-content-proposals/[id]/route.ts](<../../src/app/api/property-content-proposals/[id]/route.ts>) |
| `/api/property-content-proposals/target` | GET | [src/app/api/property-content-proposals/target/route.ts](<../../src/app/api/property-content-proposals/target/route.ts>) |
| `/api/property-creation` | GET, POST, PATCH | [src/app/api/property-creation/route.ts](<../../src/app/api/property-creation/route.ts>) |
| `/api/property-submissions` | GET, POST, PATCH | [src/app/api/property-submissions/route.ts](<../../src/app/api/property-submissions/route.ts>) |
| `/api/proposals/view` | POST | [src/app/api/proposals/view/route.ts](<../../src/app/api/proposals/view/route.ts>) |
| `/api/provider/me` | GET | [src/app/api/provider/me/route.ts](<../../src/app/api/provider/me/route.ts>) |
| `/api/provider/orders` | GET | [src/app/api/provider/orders/route.ts](<../../src/app/api/provider/orders/route.ts>) |
| `/api/provider/remittances` | GET | [src/app/api/provider/remittances/route.ts](<../../src/app/api/provider/remittances/route.ts>) |
| `/api/provider/services` | GET, POST | [src/app/api/provider/services/route.ts](<../../src/app/api/provider/services/route.ts>) |
| `/api/provider/services/[id]` | PATCH | [src/app/api/provider/services/[id]/route.ts](<../../src/app/api/provider/services/[id]/route.ts>) |
| `/api/providers/apply` | POST | [src/app/api/providers/apply/route.ts](<../../src/app/api/providers/apply/route.ts>) |
| `/api/refunds/[id]/settle` | POST | [src/app/api/refunds/[id]/settle/route.ts](<../../src/app/api/refunds/[id]/settle/route.ts>) |
| `/api/saved/[id]` | DELETE | [src/app/api/saved/[id]/route.ts](<../../src/app/api/saved/[id]/route.ts>) |
| `/api/saved/units` | GET, PUT | [src/app/api/saved/units/route.ts](<../../src/app/api/saved/units/route.ts>) |
| `/api/search/units` | GET | [src/app/api/search/units/route.ts](<../../src/app/api/search/units/route.ts>) |
| `/api/service-orders` | GET, POST | [src/app/api/service-orders/route.ts](<../../src/app/api/service-orders/route.ts>) |
| `/api/service-orders/[id]` | GET | [src/app/api/service-orders/[id]/route.ts](<../../src/app/api/service-orders/[id]/route.ts>) |
| `/api/service-orders/[id]/accept` | POST | [src/app/api/service-orders/[id]/accept/route.ts](<../../src/app/api/service-orders/[id]/accept/route.ts>) |
| `/api/service-orders/[id]/cancel` | POST | [src/app/api/service-orders/[id]/cancel/route.ts](<../../src/app/api/service-orders/[id]/cancel/route.ts>) |
| `/api/service-orders/[id]/checkout` | POST | [src/app/api/service-orders/[id]/checkout/route.ts](<../../src/app/api/service-orders/[id]/checkout/route.ts>) |
| `/api/service-orders/[id]/confirm` | POST | [src/app/api/service-orders/[id]/confirm/route.ts](<../../src/app/api/service-orders/[id]/confirm/route.ts>) |
| `/api/service-orders/[id]/decline` | POST | [src/app/api/service-orders/[id]/decline/route.ts](<../../src/app/api/service-orders/[id]/decline/route.ts>) |
| `/api/service-orders/[id]/fulfil` | POST | [src/app/api/service-orders/[id]/fulfil/route.ts](<../../src/app/api/service-orders/[id]/fulfil/route.ts>) |
| `/api/service-orders/[id]/no-show` | POST | [src/app/api/service-orders/[id]/no-show/route.ts](<../../src/app/api/service-orders/[id]/no-show/route.ts>) |
| `/api/service-orders/[id]/rate` | POST | [src/app/api/service-orders/[id]/rate/route.ts](<../../src/app/api/service-orders/[id]/rate/route.ts>) |
| `/api/service-orders/[id]/record-cash-payment` | POST | [src/app/api/service-orders/[id]/record-cash-payment/route.ts](<../../src/app/api/service-orders/[id]/record-cash-payment/route.ts>) |
| `/api/services` | GET | [src/app/api/services/route.ts](<../../src/app/api/services/route.ts>) |
| `/api/threads` | GET, POST | [src/app/api/threads/route.ts](<../../src/app/api/threads/route.ts>) |
| `/api/threads/[threadId]` | GET, POST | [src/app/api/threads/[threadId]/route.ts](<../../src/app/api/threads/[threadId]/route.ts>) |
| `/api/threads/[threadId]/stream` | GET | [src/app/api/threads/[threadId]/stream/route.ts](<../../src/app/api/threads/[threadId]/stream/route.ts>) |
| `/api/tickets` | GET, POST | [src/app/api/tickets/route.ts](<../../src/app/api/tickets/route.ts>) |
| `/api/tickets/[id]` | GET | [src/app/api/tickets/[id]/route.ts](<../../src/app/api/tickets/[id]/route.ts>) |
| `/api/tickets/[id]/assign` | POST | [src/app/api/tickets/[id]/assign/route.ts](<../../src/app/api/tickets/[id]/assign/route.ts>) |
| `/api/tickets/[id]/status` | POST | [src/app/api/tickets/[id]/status/route.ts](<../../src/app/api/tickets/[id]/status/route.ts>) |
| `/api/tm30/[id]/fail` | POST | [src/app/api/tm30/[id]/fail/route.ts](<../../src/app/api/tm30/[id]/fail/route.ts>) |
| `/api/tm30/[id]/file` | POST | [src/app/api/tm30/[id]/file/route.ts](<../../src/app/api/tm30/[id]/file/route.ts>) |
| `/api/tm30/[id]/passport` | GET | [src/app/api/tm30/[id]/passport/route.ts](<../../src/app/api/tm30/[id]/passport/route.ts>) |
| `/api/tm30/queue` | GET | [src/app/api/tm30/queue/route.ts](<../../src/app/api/tm30/queue/route.ts>) |
| `/api/units/[unitId]` | GET | [src/app/api/units/[unitId]/route.ts](<../../src/app/api/units/[unitId]/route.ts>) |
| `/api/units/[unitId]/availability-blocks` | GET, POST | [src/app/api/units/[unitId]/availability-blocks/route.ts](<../../src/app/api/units/[unitId]/availability-blocks/route.ts>) |
| `/api/units/[unitId]/availability-blocks/[blockId]` | DELETE | [src/app/api/units/[unitId]/availability-blocks/[blockId]/route.ts](<../../src/app/api/units/[unitId]/availability-blocks/[blockId]/route.ts>) |
| `/api/units/[unitId]/ical/export` | GET | [src/app/api/units/[unitId]/ical/export/route.ts](<../../src/app/api/units/[unitId]/ical/export/route.ts>) |
| `/api/units/[unitId]/pricing-rules` | GET, POST | [src/app/api/units/[unitId]/pricing-rules/route.ts](<../../src/app/api/units/[unitId]/pricing-rules/route.ts>) |
| `/api/units/[unitId]/pricing-rules/[ruleId]` | DELETE | [src/app/api/units/[unitId]/pricing-rules/[ruleId]/route.ts](<../../src/app/api/units/[unitId]/pricing-rules/[ruleId]/route.ts>) |
| `/api/webhooks/opn` | POST | [src/app/api/webhooks/opn/route.ts](<../../src/app/api/webhooks/opn/route.ts>) |
| `/llms.txt` | GET | [src/app/llms.txt/route.ts](<../../src/app/llms.txt/route.ts>) |
| `/proposal` | GET | [src/app/proposal/route.ts](<../../src/app/proposal/route.ts>) |
| `/sales-preview/[id]` | GET | [src/app/sales-preview/[id]/route.ts](<../../src/app/sales-preview/[id]/route.ts>) |

## Все модули: runtime, exports и тесты

Exports перечислены синтаксически, без вывода о callable reachability. Index/barrel files также перечислены. Seed/fixture отмечены отдельно; полный тестовый список ниже.

<a id="module-analytics"></a>

### analytics

Файлов: 16; тестовых файлов: 6. [Описание](../../src/modules/analytics/README.md).

| Исходник | Вид | Named declarations |
|---|---|---|
| [src/modules/analytics/buyer-interest.service.ts](<../../src/modules/analytics/buyer-interest.service.ts>) | implementation | `registerPurchaseInterest` |
| [src/modules/analytics/dashboard.service.ts](<../../src/modules/analytics/dashboard.service.ts>) | implementation | `getAdminDashboardStats` |
| [src/modules/analytics/index.ts](<../../src/modules/analytics/index.ts>) | barrel | см. исходник |
| [src/modules/analytics/kpi.service.ts](<../../src/modules/analytics/kpi.service.ts>) | implementation | `getKpiSummary`, `getServicesAttachRate`, `getDirectShare`, `getRepeatGuestRate`, `getTm30OnTimeRate`, `getTicketSlaHitRate` |
| [src/modules/analytics/query.ts](<../../src/modules/analytics/query.ts>) | implementation | `getMetricsSeries`, `getUnitOccupancySparklines` |
| [src/modules/analytics/reports.service.ts](<../../src/modules/analytics/reports.service.ts>) | implementation | `occupancyByCategory`, `revenueByChannel`, `revenueSplit` |
| [src/modules/analytics/rollup.ts](<../../src/modules/analytics/rollup.ts>) | implementation | `rollupMetricsDaily`, `rollupMetricsRange` |
| [src/modules/analytics/signals.ts](<../../src/modules/analytics/signals.ts>) | implementation | `detectBuyerSignals`, `transitionBuyerSignal`, `flagPurchaseQuestion`, `createDirectInquiry` |
| [src/modules/analytics/track.ts](<../../src/modules/analytics/track.ts>) | implementation | `track` |

<a id="module-audit"></a>

### audit

Файлов: 7; тестовых файлов: 3. [Описание](../../src/modules/audit/README.md).

| Исходник | Вид | Named declarations |
|---|---|---|
| [src/modules/audit/audit-query.ts](<../../src/modules/audit/audit-query.ts>) | implementation | `AUDIT_PAGE_SIZE_DEFAULT`, `AUDIT_PAGE_SIZE_MAX`, `THAI_UTC_OFFSET_MINUTES`, `dayRangeToUtc`, `SYSTEM_ACTOR`, `queryAuditLog`, `getAuditFacets`, `actionArea` |
| [src/modules/audit/audit.ts](<../../src/modules/audit/audit.ts>) | implementation | `logAudit`, `getAuditLogForEntity`, `getRecentAuditLog`, `getAuditLogByActor` |
| [src/modules/audit/index.ts](<../../src/modules/audit/index.ts>) | barrel | см. исходник |

<a id="module-auth"></a>

### auth

Файлов: 11; тестовых файлов: 3. [Описание](../../src/modules/auth/README.md).

| Исходник | Вид | Named declarations |
|---|---|---|
| [src/modules/auth/auth.ts](<../../src/modules/auth/auth.ts>) | implementation | `register`, `login`, `requestPasswordReset`, `confirmPasswordReset`, `verifyEmail`, `claimAccount` |
| [src/modules/auth/email.ts](<../../src/modules/auth/email.ts>) | implementation | `sendEmail` |
| [src/modules/auth/index.ts](<../../src/modules/auth/index.ts>) | barrel | см. исходник |
| [src/modules/auth/session.ts](<../../src/modules/auth/session.ts>) | implementation | `SESSION_COOKIE_NAME`, `SESSION_TTL_MS`, `createSessionToken`, `verifySessionToken`, `sessionCookieOptions` |
| [src/modules/auth/types.ts](<../../src/modules/auth/types.ts>) | implementation | см. исходник |
| [src/modules/auth/utils/hash.ts](<../../src/modules/auth/utils/hash.ts>) | implementation | `hashPassword`, `verifyPassword`, `validatePasswordStrength` |
| [src/modules/auth/utils/token.ts](<../../src/modules/auth/utils/token.ts>) | implementation | `generateToken`, `hashToken`, `verifyTokenHash` |

<a id="module-booking"></a>

### booking

Файлов: 60; тестовых файлов: 37. [Описание](../../src/modules/booking/README.md).

| Исходник | Вид | Named declarations |
|---|---|---|
| [src/modules/booking/booking.service.ts](<../../src/modules/booking/booking.service.ts>) | implementation | `SAFE_IDENTITY_SELECT`, `findBookingByCreationIntent`, `findAvailableUnitsForCategory`, `resolveUnitForCategory`, `createBooking`, `createBookingAttempt`, `approveBookingRequest`, `declineBookingRequest`, `confirmBooking`, `cancelBooking`, `cancelBookingAttempt`, `CheckInBlockedError`, `assessCheckIn`, `checkInBooking`, `checkOutBooking`, `completeBooking`, `requestExtension`, `changeBookingDates`, `markNoShow`, `expireHolds`, `autoDeclineRequests`, `getBooking`, `getUnitBookings`, `getGuestBookings` |
| [src/modules/booking/calendar-projection.ts](<../../src/modules/booking/calendar-projection.ts>) | implementation | `validCalendarDay`, `shiftCalendarDay`, `calendarDays`, `bangkokCalendarDay`, `coversCalendarDay`, `projectCalendarCell`, `projectCalendar` |
| [src/modules/booking/cancellation-quote.ts](<../../src/modules/booking/cancellation-quote.ts>) | implementation | `getCancellationQuote`, `parseCancellationQuote`, `cancellationQuotesMatch` |
| [src/modules/booking/cancellation.ts](<../../src/modules/booking/cancellation.ts>) | implementation | `computeRefundPercentage`, `computeRefundAmount`, `resolveCancellationPolicy`, `resolveStayCancellationPolicy`, `DEFAULT_POLICIES`, `sourceSeasonCancellationPolicy`, `resolveStayCancellationPolicyForDates` |
| [src/modules/booking/category-quote.ts](<../../src/modules/booking/category-quote.ts>) | implementation | `CATEGORY_QUOTE_TTL_MS`, `createCategoryStayQuoteToken`, `verifyCategoryStayQuoteToken` |
| [src/modules/booking/creation-intent.ts](<../../src/modules/booking/creation-intent.ts>) | implementation | `isBookingCreationKey`, `bookingCreationIntent` |
| [src/modules/booking/guest-review.service.ts](<../../src/modules/booking/guest-review.service.ts>) | implementation | `getGuestReviewEligibility`, `writeGuestReview`, `getGuestReputation` |
| [src/modules/booking/home-space.service.ts](<../../src/modules/booking/home-space.service.ts>) | implementation | `getInStayHomeSpace` |
| [src/modules/booking/index.ts](<../../src/modules/booking/index.ts>) | barrel | см. исходник |
| [src/modules/booking/lifecycle.jobs.ts](<../../src/modules/booking/lifecycle.jobs.ts>) | implementation | `sendPrearrivalReminders`, `sendCheckinInstructions`, `sendCheckoutReminders`, `sendPostStayPrompts`, `sendPostStayReengage` |
| [src/modules/booking/notify-modified.ts](<../../src/modules/booking/notify-modified.ts>) | implementation | `notifyBookingModified` |
| [src/modules/booking/notify-request-reminder.ts](<../../src/modules/booking/notify-request-reminder.ts>) | implementation | `notifyRequestReminder`, `remindUnansweredRequests` |
| [src/modules/booking/notify-requested.ts](<../../src/modules/booking/notify-requested.ts>) | implementation | `notifyBookingRequested` |
| [src/modules/booking/outstanding-balance.ts](<../../src/modules/booking/outstanding-balance.ts>) | implementation | `outstandingStayBalanceSatang`, `assertStayReceivableCollectible` |
| [src/modules/booking/request-decline-reasons.ts](<../../src/modules/booking/request-decline-reasons.ts>) | implementation | `BOOKING_REQUEST_DECLINE_REASONS`, `bookingRequestDeclineReasonLabelKey`, `isBookingRequestDeclineReason`, `formatDeclineCancellationReason`, `parseDeclineCancellationReason`, `getBookingDeclineReasonOptions` |
| [src/modules/booking/request-inbox-enrichment.ts](<../../src/modules/booking/request-inbox-enrichment.ts>) | implementation | `summarizePriceBreakdown`, `enrichBookingRequestInbox` |
| [src/modules/booking/reservation-group.service.ts](<../../src/modules/booking/reservation-group.service.ts>) | implementation | `createReservationGroup`, `attachBookingToReservationGroup`, `removeBookingFromReservationGroup` |
| [src/modules/booking/revenue-tariff-engine.ts](<../../src/modules/booking/revenue-tariff-engine.ts>) | implementation | `resolveEffectiveStayOffer` |
| [src/modules/booking/source-authority.ts](<../../src/modules/booking/source-authority.ts>) | implementation | `assertLayantaraBookingAuthority`, `excludedSourceControlledUnits`, `allExcludedSourceControlledUnitIds` |
| [src/modules/booking/stay-review.service.ts](<../../src/modules/booking/stay-review.service.ts>) | implementation | `getStayReviewEligibility`, `writeStayReview` |
| [src/modules/booking/timing-config.ts](<../../src/modules/booking/timing-config.ts>) | implementation | `getBookingTimingConfig` |
| [src/modules/booking/work-projection.ts](<../../src/modules/booking/work-projection.ts>) | implementation | `deriveStayWorkItems`, `stayWorkDepartments` |

<a id="module-browse"></a>

### browse

Файлов: 11; тестовых файлов: 4. [Описание](../../src/modules/browse/README.md).

| Исходник | Вид | Named declarations |
|---|---|---|
| [src/modules/browse/amenity-filters.ts](<../../src/modules/browse/amenity-filters.ts>) | implementation | `STAY_AMENITY_KEYS`, `parseStayAmenities`, `stayAmenityWhere` |
| [src/modules/browse/bounds.ts](<../../src/modules/browse/bounds.ts>) | implementation | `parseMapBounds`, `boundsWhere` |
| [src/modules/browse/index.ts](<../../src/modules/browse/index.ts>) | barrel | см. исходник |
| [src/modules/browse/saved.service.ts](<../../src/modules/browse/saved.service.ts>) | implementation | `saveUnit`, `unsaveUnit`, `listSavedUnits`, `listSavedCollections`, `saveSearch`, `listSavedSearches`, `deleteSavedSearch`, `matchesSavedSearch`, `findSearchesMatching`, `removeSavedEntry` |
| [src/modules/browse/sort.ts](<../../src/modules/browse/sort.ts>) | implementation | `UNIT_SORTS`, `DEFAULT_UNIT_SORT`, `parseUnitSort`, `rankByRating` |
| [src/modules/browse/unit-rating.service.ts](<../../src/modules/browse/unit-rating.service.ts>) | implementation | `getUnitRatings`, `getUnitRating` |

<a id="module-comms"></a>

### comms

Файлов: 30; тестовых файлов: 14. [Описание](../../src/modules/comms/README.md).

| Исходник | Вид | Named declarations |
|---|---|---|
| [src/modules/comms/announcement.service.ts](<../../src/modules/comms/announcement.service.ts>) | implementation | `resolvePostingAuthority`, `getPostableProjects`, `createAnnouncement`, `publishAnnouncement`, `unpublishAnnouncement`, `updateAnnouncement`, `deleteAnnouncement`, `getProjectAnnouncements`, `markAnnouncementRead`, `getUnreadCount`, `inStayGuestIdentityIds` |
| [src/modules/comms/booking-thread-access.ts](<../../src/modules/comms/booking-thread-access.ts>) | implementation | `getBookingThreadParticipants` |
| [src/modules/comms/comms.service.ts](<../../src/modules/comms/comms.service.ts>) | implementation | `createNotification`, `markNotificationRead`, `getUnreadNotifications`, `getRecentNotifications`, `isNotificationMuted`, `setNotificationMute` |
| [src/modules/comms/dispute.service.ts](<../../src/modules/comms/dispute.service.ts>) | implementation | `DisputeRequestError`, `raiseDispute`, `decideDispute`, `getOpenDisputes`, `getDisputeDetail` |
| [src/modules/comms/email.seam.ts](<../../src/modules/comms/email.seam.ts>) | implementation | `redactEmail`, `EmailDeliveryRetryableError`, `sendEmail`, `buildNotificationEmail` |
| [src/modules/comms/index.ts](<../../src/modules/comms/index.ts>) | barrel | см. исходник |
| [src/modules/comms/inquiry-thread-access.ts](<../../src/modules/comms/inquiry-thread-access.ts>) | implementation | `getInquiryThreadRecipients`, `getInquiryThreadAudience`, `materializeInquiryThreadAudience`, `synchronizeInquiryParticipant` |
| [src/modules/comms/lead.service.ts](<../../src/modules/comms/lead.service.ts>) | implementation | `LEAD_AUDIENCES`, `submitLead` |
| [src/modules/comms/notification-delivery.ts](<../../src/modules/comms/notification-delivery.ts>) | implementation | `QUEUED_DELIVERY`, `dispatchNotificationDelivery`, `flushPendingNotificationDeliveries` |
| [src/modules/comms/notification.bus.ts](<../../src/modules/comms/notification.bus.ts>) | implementation | `subscribe`, `publishNotification`, `hasSubscribers` |
| [src/modules/comms/standalone-ticket-access.ts](<../../src/modules/comms/standalone-ticket-access.ts>) | implementation | `orderResponsibleOrganization`, `hasResponsibleOrganizationSupportAccess`, `standaloneTicketAuthority` |
| [src/modules/comms/statement-thread-access.ts](<../../src/modules/comms/statement-thread-access.ts>) | implementation | `getStatementThreadParticipants`, `hasLiveThreadAuthority`, `getAuthorizedThreadParticipants`, `canAccessThread`, `requireThreadAccess` |
| [src/modules/comms/thread.bus.ts](<../../src/modules/comms/thread.bus.ts>) | implementation | `subscribe`, `publishMessage`, `hasSubscribers` |
| [src/modules/comms/thread.service.ts](<../../src/modules/comms/thread.service.ts>) | implementation | `findOrCreateThread`, `sendMessage`, `markThreadRead`, `getThreadsForIdentity`, `getThreadMessages`, `addSystemMessage`, `getUnreadCounts`, `sendHumanReply` |
| [src/modules/comms/ticket.service.ts](<../../src/modules/comms/ticket.service.ts>) | implementation | `raiseTicket`, `updateTicketStatus`, `assignTicket`, `addComment`, `recordTicketEvent`, `getTicketDetail`, `getProjectTickets`, `getReporterTickets`, `getAdminTicketBoard`, `checkAndTrackSLABreaches`, `autoCloseResolvedTickets` |

<a id="module-compliance"></a>

### compliance

Файлов: 7; тестовых файлов: 3. [Описание](../../src/modules/compliance/README.md).

| Исходник | Вид | Named declarations |
|---|---|---|
| [src/modules/compliance/commercial-eligibility.engine.ts](<../../src/modules/compliance/commercial-eligibility.engine.ts>) | implementation | `isCredentialCurrentlyVerified`, `evaluateCommercialEligibility`, `canPublishShortTerm`, `canPublishLongTerm`, `canPublishSale` |
| [src/modules/compliance/index.ts](<../../src/modules/compliance/index.ts>) | barrel | см. исходник |
| [src/modules/compliance/regulatory-credential.service.ts](<../../src/modules/compliance/regulatory-credential.service.ts>) | implementation | `REGULATORY_CREDENTIAL_TYPES`, `UNIT_ONLY_CREDENTIAL_TYPES`, `REGULATORY_CREDENTIAL_STATUSES`, `REGULATORY_CREDENTIAL_SCOPE_LEVELS`, `createRegulatoryCredential`, `updateRegulatoryCredential`, `listRegulatoryCredentials`, `checkRegulatoryCredentialForGoLive` |

<a id="module-config"></a>

### config

Файлов: 15; тестовых файлов: 6. [Описание](../../src/modules/config/README.md).

| Исходник | Вид | Named declarations |
|---|---|---|
| [src/modules/config/booking-windows.ts](<../../src/modules/config/booking-windows.ts>) | implementation | `BOOKING_WINDOWS`, `validateBookingWindow` |
| [src/modules/config/catalog.ts](<../../src/modules/config/catalog.ts>) | implementation | `getCatalogKeys`, `assertCatalogKeys` |
| [src/modules/config/config.service.ts](<../../src/modules/config/config.service.ts>) | implementation | `getConfig`, `setConfigOverride`, `invalidateConfig`, `clearConfigCache` |
| [src/modules/config/edit.service.ts](<../../src/modules/config/edit.service.ts>) | implementation | `updateConfigParameter`, `clearConfigOverride` |
| [src/modules/config/index.ts](<../../src/modules/config/index.ts>) | barrel | см. исходник |
| [src/modules/config/secret-vault.service.ts](<../../src/modules/config/secret-vault.service.ts>) | implementation | `listVaultEntries`, `saveVaultEntry`, `revealVaultEntry`, `clearVaultValue` |
| [src/modules/config/seed.ts](<../../src/modules/config/seed.ts>) | seed | `seedConfig` |
| [src/modules/config/types.ts](<../../src/modules/config/types.ts>) | implementation | см. исходник |

<a id="module-content"></a>

### content

Файлов: 77; тестовых файлов: 9. [Описание](../../src/modules/content/README.md).

| Исходник | Вид | Named declarations |
|---|---|---|
| [src/modules/content/admin360.seed.ts](<../../src/modules/content/admin360.seed.ts>) | seed | `CANONICAL_ADMIN_360_KEYS` |
| [src/modules/content/audience-faq.seed.ts](<../../src/modules/content/audience-faq.seed.ts>) | seed | `seedAudienceFAQs` |
| [src/modules/content/booking-mode-reliability.seed.ts](<../../src/modules/content/booking-mode-reliability.seed.ts>) | seed | `BOOKING_MODE_RELIABILITY_KEYS`, `BOOKING_MODE_RELIABILITY_DRAFTS` |
| [src/modules/content/booking-steps.seed.ts](<../../src/modules/content/booking-steps.seed.ts>) | seed | `BOOKING_STEPS_KEYS`, `BOOKING_STEPS_DRAFTS` |
| [src/modules/content/commerce-structure.seed.ts](<../../src/modules/content/commerce-structure.seed.ts>) | seed | `COMMERCE_STRUCTURE_KEYS` |
| [src/modules/content/consolidated-release.seed.ts](<../../src/modules/content/consolidated-release.seed.ts>) | seed | `CONSOLIDATED_RELEASE_KEYS` |
| [src/modules/content/content-contributor-role.seed.ts](<../../src/modules/content/content-contributor-role.seed.ts>) | seed | `CONTENT_CONTRIBUTOR_ROLE_KEYS`, `CONTENT_CONTRIBUTOR_ROLE_LOCALE_DRAFTS` |
| [src/modules/content/content-proposal-editor.seed.ts](<../../src/modules/content/content-proposal-editor.seed.ts>) | seed | `CONTENT_PROPOSAL_EDITOR_KEYS`, `CONTENT_PROPOSAL_EDITOR_DRAFTS` |
| [src/modules/content/content-proposal-review.seed.ts](<../../src/modules/content/content-proposal-review.seed.ts>) | seed | `CONTENT_PROPOSAL_REVIEW_KEYS`, `CONTENT_PROPOSAL_REVIEW_DRAFTS` |
| [src/modules/content/content.hook.ts](<../../src/modules/content/content.hook.ts>) | implementation | `useT` |
| [src/modules/content/content.service.ts](<../../src/modules/content/content.service.ts>) | implementation | `tMany`, `t`, `setTranslation`, `ensureContentKey`, `clearTranslationCache` |
| [src/modules/content/discovery.seed.ts](<../../src/modules/content/discovery.seed.ts>) | seed | `discoveryDefaults`, `DISCOVERY_KEYS` |
| [src/modules/content/edit.service.ts](<../../src/modules/content/edit.service.ts>) | implementation | `updateTranslation`, `createContentKey`, `getContentKey`, `listContentKeys`, `listNamespaces`, `exportToCSV`, `importFromCSV` |
| [src/modules/content/employee-creation.seed.ts](<../../src/modules/content/employee-creation.seed.ts>) | seed | `EMPLOYEE_CREATION_KEYS`, `EMPLOYEE_CREATION_LABELS`, `EMPLOYEE_CREATION_DRAFTS` |
| [src/modules/content/expense-safety.seed.ts](<../../src/modules/content/expense-safety.seed.ts>) | seed | `EXPENSE_SAFETY_KEYS` |
| [src/modules/content/gallery-editor.seed.ts](<../../src/modules/content/gallery-editor.seed.ts>) | seed | `GALLERY_COPY_KEYS`, `galleryCopyLabelsForLocale`, `GALLERY_COPY_LOCALE_DRAFTS`, `GALLERY_EDITOR_KEYS` |
| [src/modules/content/gallery-emergency.seed.ts](<../../src/modules/content/gallery-emergency.seed.ts>) | seed | `GALLERY_EMERGENCY_KEYS`, `GALLERY_EMERGENCY_LOCALE_DRAFTS` |
| [src/modules/content/guest-auth-support.seed.ts](<../../src/modules/content/guest-auth-support.seed.ts>) | seed | `GUEST_AUTH_SUPPORT_KEYS` |
| [src/modules/content/guest-booking-drafts.ts](<../../src/modules/content/guest-booking-drafts.ts>) | implementation | `GUEST_BOOKING_DRAFTS` |
| [src/modules/content/guest-checkout.seed.ts](<../../src/modules/content/guest-checkout.seed.ts>) | seed | `REVIEW_CHECKOUT_DRAFTS`, `PAYMENT_CHECKOUT_DRAFTS`, `GUEST_CHECKOUT_KEYS` |
| [src/modules/content/guest-search-ux.seed.ts](<../../src/modules/content/guest-search-ux.seed.ts>) | seed | `guestSearchDefaults`, `GUEST_SEARCH_UX_KEYS` |
| [src/modules/content/guest-service-context.seed.ts](<../../src/modules/content/guest-service-context.seed.ts>) | seed | `GUEST_SERVICE_CONTEXT_KEYS`, `GUEST_SERVICE_LOCALE_DRAFTS` |
| [src/modules/content/homepage-v4.seed.ts](<../../src/modules/content/homepage-v4.seed.ts>) | seed | `HOMEPAGE_V4_KEYS` |
| [src/modules/content/index.ts](<../../src/modules/content/index.ts>) | barrel | см. исходник |
| [src/modules/content/inquiry-copy.ts](<../../src/modules/content/inquiry-copy.ts>) | implementation | `INQUIRY_COPY`, `inquiryLabels`, `INQUIRY_CONTENT_KEYS` |
| [src/modules/content/launch-readiness.seed.ts](<../../src/modules/content/launch-readiness.seed.ts>) | seed | `LAUNCH_READINESS_KEYS` |
| [src/modules/content/layantara-operations.seed.ts](<../../src/modules/content/layantara-operations.seed.ts>) | seed | `LAYANTARA_OPERATION_KEYS` |
| [src/modules/content/lead-form.seed.ts](<../../src/modules/content/lead-form.seed.ts>) | seed | `LEAD_FORM_KEYS`, `LEAD_FORM_LOCALE_DRAFTS` |
| [src/modules/content/legal-pages.seed.ts](<../../src/modules/content/legal-pages.seed.ts>) | seed | `seedLegalPages` |
| [src/modules/content/operating-governance.seed.ts](<../../src/modules/content/operating-governance.seed.ts>) | seed | `OPERATING_GOVERNANCE_LABELS`, `OPERATING_GOVERNANCE_KEYS`, `OPERATING_GOVERNANCE_DRAFTS` |
| [src/modules/content/operating-space.seed.ts](<../../src/modules/content/operating-space.seed.ts>) | seed | `OPERATING_SPACE_KEYS` |
| [src/modules/content/operator-unpaid-confirmation.seed.ts](<../../src/modules/content/operator-unpaid-confirmation.seed.ts>) | seed | `OPERATOR_UNPAID_CONFIRMATION_KEYS` |
| [src/modules/content/owner-evidence.seed.ts](<../../src/modules/content/owner-evidence.seed.ts>) | seed | `OWNER_EVIDENCE_KEYS`, `ownerEvidenceLabelsForLocale`, `OWNER_EVIDENCE_LOCALE_DRAFTS` |
| [src/modules/content/pms-release.seed.ts](<../../src/modules/content/pms-release.seed.ts>) | seed | `PMS_RELEASE_KEYS` |
| [src/modules/content/pricing-editor-role.seed.ts](<../../src/modules/content/pricing-editor-role.seed.ts>) | seed | `PRICING_EDITOR_ROLE_KEYS`, `PRICING_EDITOR_ROLE_LOCALE_DRAFTS` |
| [src/modules/content/pricing-workspace.seed.ts](<../../src/modules/content/pricing-workspace.seed.ts>) | seed | `PRICING_WORKSPACE_KEYS`, `PRICING_WORKSPACE_LABELS`, `PRICING_WORKSPACE_DRAFTS` |
| [src/modules/content/process-hub.seed.ts](<../../src/modules/content/process-hub.seed.ts>) | seed | `PROCESS_HUB_KEYS` |
| [src/modules/content/project-editorial.seed.ts](<../../src/modules/content/project-editorial.seed.ts>) | seed | `LAYANTARA_PROJECT_EDITORIAL`, `seedLayantaraProjectEditorial` |
| [src/modules/content/project-gallery.seed.ts](<../../src/modules/content/project-gallery.seed.ts>) | seed | `PROJECT_GALLERY_KEYS` |
| [src/modules/content/project-portal.seed.ts](<../../src/modules/content/project-portal.seed.ts>) | seed | `PROJECT_PORTAL_KEYS` |
| [src/modules/content/project-restyle.seed.ts](<../../src/modules/content/project-restyle.seed.ts>) | seed | `PROJECT_RESTYLE_KEYS` |
| [src/modules/content/project-team.seed.ts](<../../src/modules/content/project-team.seed.ts>) | seed | `PROJECT_TEAM_KEYS` |
| [src/modules/content/property-booking-mode.seed.ts](<../../src/modules/content/property-booking-mode.seed.ts>) | seed | `PROPERTY_BOOKING_MODE_KEYS`, `PROPERTY_BOOKING_MODE_LABELS`, `PROPERTY_BOOKING_MODE_DRAFTS` |
| [src/modules/content/property-category-ui-drafts.ts](<../../src/modules/content/property-category-ui-drafts.ts>) | implementation | `PROPERTY_CATEGORY_UI_DRAFTS` |
| [src/modules/content/property-delegation.seed.ts](<../../src/modules/content/property-delegation.seed.ts>) | seed | `PROPERTY_DELEGATION_KEYS`, `PROPERTY_DELEGATION_LABELS`, `PROPERTY_DELEGATION_DRAFTS` |
| [src/modules/content/property-editor.seed.ts](<../../src/modules/content/property-editor.seed.ts>) | seed | `PROPERTY_EDITOR_KEYS`, `PROPERTY_EDITOR_DEFAULTS`, `PROPERTY_EDITOR_DRAFTS`, `editorLabel` |
| [src/modules/content/property-facts.seed.ts](<../../src/modules/content/property-facts.seed.ts>) | seed | `PROPERTY_FACT_KEYS` |
| [src/modules/content/property-listings.seed.ts](<../../src/modules/content/property-listings.seed.ts>) | seed | `PROPERTY_LISTINGS_KEYS`, `PROPERTY_LISTINGS_LOCALE_DRAFTS` |
| [src/modules/content/property-onboarding.seed.ts](<../../src/modules/content/property-onboarding.seed.ts>) | seed | `PROPERTY_ONBOARDING_KEYS`, `PROPERTY_ONBOARDING_LOCALE_DRAFTS` |
| [src/modules/content/property-public-ui-drafts.ts](<../../src/modules/content/property-public-ui-drafts.ts>) | implementation | `PROPERTY_PUBLIC_UI_KEYS`, `PROPERTY_PUBLIC_UI_DRAFTS` |
| [src/modules/content/property-workspace.seed.ts](<../../src/modules/content/property-workspace.seed.ts>) | seed | `PROPERTY_WORKSPACE_KEYS`, `PROPERTY_WORKSPACE_LABELS`, `PROPERTY_WORKSPACE_DRAFTS` |
| [src/modules/content/public-sleeping.ts](<../../src/modules/content/public-sleeping.ts>) | implementation | `publicSleepingLabelsForLocale` |
| [src/modules/content/refund-settlement.seed.ts](<../../src/modules/content/refund-settlement.seed.ts>) | seed | `REFUND_SETTLEMENT_KEYS` |
| [src/modules/content/reservation-desk.seed.ts](<../../src/modules/content/reservation-desk.seed.ts>) | seed | `RESERVATION_DESK_KEYS` |
| [src/modules/content/reservation-guest.seed.ts](<../../src/modules/content/reservation-guest.seed.ts>) | seed | `RESERVATION_GUEST_LABELS`, `RESERVATION_GUEST_DRAFTS`, `RESERVATION_GUEST_KEYS` |
| [src/modules/content/role-dashboards.seed.ts](<../../src/modules/content/role-dashboards.seed.ts>) | seed | `ROLE_DASHBOARD_KEYS` |
| [src/modules/content/sales-offer.seed.ts](<../../src/modules/content/sales-offer.seed.ts>) | seed | `SALES_LABELS`, `SALES_DRAFTS`, `SALES_KEYS`, `salesDefaults` |
| [src/modules/content/seed.ts](<../../src/modules/content/seed.ts>) | seed | `seedContent` |
| [src/modules/content/session-security.seed.ts](<../../src/modules/content/session-security.seed.ts>) | seed | `SESSION_SECURITY_KEYS` |
| [src/modules/content/sleeping-space.seed.ts](<../../src/modules/content/sleeping-space.seed.ts>) | seed | `SLEEPING_SPACE_KEYS`, `sleepingSpaceLabelsForLocale`, `SLEEPING_SPACE_LOCALE_DRAFTS` |
| [src/modules/content/stay-ux.seed.ts](<../../src/modules/content/stay-ux.seed.ts>) | seed | `stayUxDefaults`, `STAY_UX_KEYS` |
| [src/modules/content/tariff-editor-usability.seed.ts](<../../src/modules/content/tariff-editor-usability.seed.ts>) | seed | `TARIFF_EDITOR_USABILITY_KEYS`, `TARIFF_EDITOR_USABILITY_DRAFTS` |
| [src/modules/content/types.ts](<../../src/modules/content/types.ts>) | implementation | `LOCALES`, `DEFAULT_LOCALE`, `getLocaleFallbackChain` |
| [src/modules/content/unified-stay.seed.ts](<../../src/modules/content/unified-stay.seed.ts>) | seed | `UNIFIED_STAY_KEYS` |
| [src/modules/content/unit-publication.seed.ts](<../../src/modules/content/unit-publication.seed.ts>) | seed | `UNIT_PUBLICATION_KEYS`, `UNIT_PUBLICATION_LABELS`, `UNIT_PUBLICATION_DRAFTS` |
| [src/modules/content/walkthrough-fixes.seed.ts](<../../src/modules/content/walkthrough-fixes.seed.ts>) | seed | `WALKTHROUGH_FIX_KEYS` |
| [src/modules/content/workspace-navigation.seed.ts](<../../src/modules/content/workspace-navigation.seed.ts>) | seed | `WORKSPACE_NAVIGATION_KEYS`, `WORKSPACE_NAVIGATION_LABELS`, `WORKSPACE_NAVIGATION_DRAFTS` |

<a id="module-core"></a>

### core

Файлов: 73; тестовых файлов: 45. [Описание](../../src/modules/core/README.md).

| Исходник | Вид | Named declarations |
|---|---|---|
| [src/modules/core/account.service.ts](<../../src/modules/core/account.service.ts>) | implementation | `SUPPORTED_LOCALES`, `getAccountProfile`, `updateAccountProfile`, `changeAccountPassword`, `getNotificationSettings`, `UNMUTABLE_TYPES`, `setNotificationPreference`, `revokeAllSessions` |
| [src/modules/core/availability.service.ts](<../../src/modules/core/availability.service.ts>) | implementation | `getApplicableSeason`, `isActiveHold`, `checkAvailability`, `getUnitBlockedDates`, `createManualBlock`, `removeBlockedDate`, `getUnitPricingRules`, `createPricingRule`, `removePricingRule` |
| [src/modules/core/booking-occupancy.ts](<../../src/modules/core/booking-occupancy.ts>) | implementation | `lockBookingInventory`, `initialStayConfirmationIssue`, `isActiveBookingHold`, `blockingBookingConditions`, `DEFAULT_MANUAL_HOLD_MINUTES`, `paymentHoldExpiry` |
| [src/modules/core/canonical-pricing.service.ts](<../../src/modules/core/canonical-pricing.service.ts>) | implementation | `computeCanonicalPriceBreakdown`, `computeCanonicalCalendarRates` |
| [src/modules/core/commercial-booking-terms.ts](<../../src/modules/core/commercial-booking-terms.ts>) | implementation | `resolveSourceBookingTerms` |
| [src/modules/core/compliance.service.ts](<../../src/modules/core/compliance.service.ts>) | implementation | `createComplianceRecord`, `updateComplianceRecord`, `getComplianceRecord`, `getUnitComplianceRecords`, `deleteComplianceRecord`, `checkMobilizationGate`, `completeMobilizationStep`, `getUnitMobilizationChecklist`, `isMobilizationComplete`, `MOBILIZATION_STEPS`, `initializeMobilizationChecklist`, `getAdminComplianceOverview` |
| [src/modules/core/engagement.service.ts](<../../src/modules/core/engagement.service.ts>) | implementation | `createDraftUnitEngagementTx`, `createUnitEngagement`, `updateUnitEngagementTx`, `updateUnitEngagement`, `getUnitEngagement`, `getActiveEngagement`, `getUnitEngagements`, `deleteUnitEngagement` |
| [src/modules/core/index.ts](<../../src/modules/core/index.ts>) | barrel | см. исходник |
| [src/modules/core/landing.ts](<../../src/modules/core/landing.ts>) | implementation | `resolveLanding`, `availableSurfaces` |
| [src/modules/core/layantara.seed.ts](<../../src/modules/core/layantara.seed.ts>) | seed | `LAYANTARA_CATEGORIES`, `seedLayantara` |
| [src/modules/core/people.service.ts](<../../src/modules/core/people.service.ts>) | implementation | `inviteIdentity`, `searchIdentities`, `grantRole`, `revokeRole`, `blockIdentity`, `unblockIdentity`, `createOrganization`, `updateOrganization`, `deleteOrganization`, `generateClaimLink`, `claimIdentity`, `getIdentityRoles`, `listOrganizations` |
| [src/modules/core/permissions.ts](<../../src/modules/core/permissions.ts>) | implementation | `accessSatisfies`, `PERMISSIONS`, `resolvePermissionAction`, `isKnownPermissionAction`, `can`, `getIdentityRoles`, `hasRole` |
| [src/modules/core/pricing-access.ts](<../../src/modules/core/pricing-access.ts>) | implementation | `assertUnitPricingAccess`, `listPricingUnits` |
| [src/modules/core/property-capability-access.ts](<../../src/modules/core/property-capability-access.ts>) | implementation | `PropertyCapabilityError`, `readPropertyCapabilityAccess`, `assertPropertyCapabilityForUnit`, `listPropertyCapabilityUnits` |
| [src/modules/core/property-capability-directory.ts](<../../src/modules/core/property-capability-directory.ts>) | implementation | `propertyDelegationWorkspace`, `propertyDelegationUnits`, `resolvePropertyDelegationRecipient` |
| [src/modules/core/property-capability-grants.ts](<../../src/modules/core/property-capability-grants.ts>) | implementation | `parsePropertyCapabilityGrant`, `grantPropertyCapability`, `revokePropertyCapability` |
| [src/modules/core/property-capability-policy.ts](<../../src/modules/core/property-capability-policy.ts>) | implementation | `PROPERTY_CAPABILITY_ROLES`, `isPropertyCapabilityRole`, `validCapabilityScope`, `capabilityScopeContains`, `capabilityScopeMatches`, `capabilityExpiryWithin`, `isEffectiveCapabilityGrant` |
| [src/modules/core/property-workspaces.ts](<../../src/modules/core/property-workspaces.ts>) | implementation | `getPropertyWorkspaces` |
| [src/modules/core/retention.service.ts](<../../src/modules/core/retention.service.ts>) | implementation | `scrubExpiredPassportData`, `deleteExpiredMediaAssets`, `anonymizeDeletedIdentities`, `expireOldTokens`, `exportIdentityData`, `runRetentionJobs`, `requestIdentityDeletion` |
| [src/modules/core/role-assignment-policy.ts](<../../src/modules/core/role-assignment-policy.ts>) | implementation | `validateRoleAssignmentScope` |
| [src/modules/core/roles.ts](<../../src/modules/core/roles.ts>) | implementation | `grantRole`, `revokeRole`, `getIdentityRoleAssignments`, `getProjectRoleAssignments`, `getUnitRoleAssignments`, `getIdentitiesWithRole` |
| [src/modules/core/seasonal-tariff.ts](<../../src/modules/core/seasonal-tariff.ts>) | implementation | `quoteSeasonalTariffGrid`, `annualLeaseMinimumNights`, `previewAnnualLeaseTariff` |
| [src/modules/core/seed.ts](<../../src/modules/core/seed.ts>) | seed | `seedDemoData` |
| [src/modules/core/stay-unquotable.ts](<../../src/modules/core/stay-unquotable.ts>) | implementation | `StayUnquotableError`, `LeaseRequestRequiredError` |
| [src/modules/core/tariff-calendar.ts](<../../src/modules/core/tariff-calendar.ts>) | implementation | `remainingAnnualWindows` |
| [src/modules/core/tariff-editor.ts](<../../src/modules/core/tariff-editor.ts>) | implementation | `validateTariffDraft`, `readTariffDraft`, `readTariffRevision`, `readTariffEditorSnapshot`, `saveTariffDraft`, `saveEmployeeTariffDraft`, `employeeTariffPermissions`, `usesTariffGrid` |
| [src/modules/core/walkthrough.seed.ts](<../../src/modules/core/walkthrough.seed.ts>) | seed | `seedWalkthroughState` |

<a id="module-crm"></a>

### crm

Файлов: 15; тестовых файлов: 7. [Описание](../../src/modules/crm/README.md).

| Исходник | Вид | Named declarations |
|---|---|---|
| [src/modules/crm/consent.service.ts](<../../src/modules/crm/consent.service.ts>) | implementation | `grantConsent`, `withdrawConsent`, `denyConsent`, `getConsentStatus`, `hasConsent`, `getConsentHistory`, `getConsentSummary` |
| [src/modules/crm/crm.service.ts](<../../src/modules/crm/crm.service.ts>) | implementation | `ensureCrmProfile`, `createOpportunity`, `transitionOpportunity`, `addActivity`, `completeActivity`, `capturePublicLead`, `getPipeline` |
| [src/modules/crm/domain.ts](<../../src/modules/crm/domain.ts>) | implementation | `validateProbability`, `lifecycleAfterWin`, `lifecycleAfterWinForExisting`, `opportunityTypeForAudience`, `parseLeadContact` |
| [src/modules/crm/index.ts](<../../src/modules/crm/index.ts>) | barrel | см. исходник |
| [src/modules/crm/private-deal-evidence.ts](<../../src/modules/crm/private-deal-evidence.ts>) | implementation | `encryptDealFile`, `decryptDealFile`, `saveDealEvidence`, `readDealEvidence`, `isAllowedDealEvidenceType` |
| [src/modules/crm/property-deal-serialization.ts](<../../src/modules/crm/property-deal-serialization.ts>) | implementation | `propertyDealJson` |
| [src/modules/crm/property-deal.service.ts](<../../src/modules/crm/property-deal.service.ts>) | implementation | `createPropertyDeal`, `updateDraftPropertyDeal`, `transitionPropertyDeal` |

<a id="module-destinations"></a>

### destinations

Файлов: 3; тестовых файлов: 1. [Описание](../../src/modules/destinations/README.md).

| Исходник | Вид | Named declarations |
|---|---|---|
| [src/modules/destinations/index.ts](<../../src/modules/destinations/index.ts>) | barrel | `getDestination`, `destinationPath`, `allDestinations` |

<a id="module-finance"></a>

### finance

Файлов: 50; тестовых файлов: 25. [Описание](../../src/modules/finance/README.md).

| Исходник | Вид | Named declarations |
|---|---|---|
| [src/modules/finance/bank-transfer.service.ts](<../../src/modules/finance/bank-transfer.service.ts>) | implementation | `transferReference`, `getTransferInstructions`, `recordBankTransfer` |
| [src/modules/finance/cancellation-refunds.ts](<../../src/modules/finance/cancellation-refunds.ts>) | implementation | `reserveCancellationRefunds` |
| [src/modules/finance/deposits.service.ts](<../../src/modules/finance/deposits.service.ts>) | implementation | `getActiveDepositClaimForGuest`, `disputeDepositClaim`, `scheduleDepositPreauth`, `scheduleDepositPreauthIfConfigured`, `ensureDepositPreauthOnStayConfirmed`, `voidDepositPreauthIfClean`, `captureDepositPreauthOnClaim`, `releaseDepositPreauthOnDispute`, `fileDepositClaim`, `getClaimsAwaitingResolution`, `getStaysOpenToClaim`, `approveClaim`, `rejectClaim`, `releaseExpiredDepositPreauths` |
| [src/modules/finance/expense-access.ts](<../../src/modules/finance/expense-access.ts>) | implementation | `canWriteUnitExpenses`, `resolveReceiptReader` |
| [src/modules/finance/expense-receipt-file.ts](<../../src/modules/finance/expense-receipt-file.ts>) | implementation | `MAX_RECEIPT_BYTES`, `RECEIPT_MIME_TYPES`, `RECEIPT_EXTENSIONS`, `ReceiptFileError`, `ReceiptIntegrityError`, `isReceiptMime`, `sniffReceiptType`, `validateReceiptFile`, `sealReceipt`, `openReceipt` |
| [src/modules/finance/expense-receipt-labels.ts](<../../src/modules/finance/expense-receipt-labels.ts>) | implementation | `REPORT_IMPACT_LABEL_KEY`, `reportImpactMessage`, `COST_ERROR_LABEL_KEY`, `RECEIPT_ERROR_LABEL_KEY`, `costErrorMessage`, `receiptErrorMessage` |
| [src/modules/finance/expense-receipt.service.ts](<../../src/modules/finance/expense-receipt.service.ts>) | implementation | `ReceiptError`, `attachExpenseReceipt`, `readExpenseReceipt` |
| [src/modules/finance/finance.service.ts](<../../src/modules/finance/finance.service.ts>) | implementation | `CheckoutStateError`, `recordCashPayment`, `recordCashRefund`, `createCheckout`, `verifyAndConfirm`, `refund`, `processRequestedCardRefund`, `markRefundSucceeded`, `settleManualRefund`, `getBookingRefundDisplayState`, `markRefundFailed`, `markPaymentFailed` |
| [src/modules/finance/index.ts](<../../src/modules/finance/index.ts>) | barrel | см. исходник |
| [src/modules/finance/ledger.service.ts](<../../src/modules/finance/ledger.service.ts>) | implementation | `recordCost`, `recordBookingRevenue`, `recordRefundOut`, `recordServiceCommission`, `reverseLedgerEntry`, `getUnitLedgerEntries`, `getProjectLedgerEntries`, `getLedgerEntry`, `computeUnitLedgerTotals`, `lockUnitLedgerShared`, `lockUnitLedgerExclusive`, `LedgerCorrectionError`, `REVERSAL_REASON_MIN`, `REVERSAL_REASON_MAX`, `reverseManualCost` |
| [src/modules/finance/manual-cost-input.ts](<../../src/modules/finance/manual-cost-input.ts>) | implementation | `MANUAL_COST_TYPES`, `MANUAL_COST_SIGN`, `MAX_COST_SATANG`, `DESCRIPTION_MIN`, `DESCRIPTION_MAX`, `EARLIEST_COST_DAY`, `ManualCostInputError`, `isIdempotencyKey`, `isManualCostType`, `isCalendarDayString`, `normalizeDescription`, `assertBusinessDay`, `businessDayToStoredDate`, `parseManualCostRequest`, `manualCostFingerprint` |
| [src/modules/finance/manual-cost.service.ts](<../../src/modules/finance/manual-cost.service.ts>) | implementation | `ManualCostError`, `reportImpactFor`, `recordManualCost` |
| [src/modules/finance/payout-ledger.service.ts](<../../src/modules/finance/payout-ledger.service.ts>) | implementation | `recordOwnerPayoutAtomic`, `ProviderPayoutConflict`, `recordProviderPayoutAtomic` |
| [src/modules/finance/payout.service.ts](<../../src/modules/finance/payout.service.ts>) | implementation | `resolveProviderPayoutPeriod`, `getProviderRemittancesView`, `computeProviderRemittance`, `getReconciliationData`, `reconcilePayout`, `resolveFailedRefund` |
| [src/modules/finance/provider-webhook.service.ts](<../../src/modules/finance/provider-webhook.service.ts>) | implementation | `processOpnEvent` |
| [src/modules/finance/providers/index.ts](<../../src/modules/finance/providers/index.ts>) | barrel | `PaymentProviderUnavailableError`, `getPaymentProvider`, `getProviderConfig` |
| [src/modules/finance/providers/opn.ts](<../../src/modules/finance/providers/opn.ts>) | implementation | `OpnConfigurationError`, `OpnApiError`, `createOpnProvider` |
| [src/modules/finance/providers/types.ts](<../../src/modules/finance/providers/types.ts>) | implementation | см. исходник |
| [src/modules/finance/refund-recovery.ts](<../../src/modules/finance/refund-recovery.ts>) | implementation | `recoverRequestedBookingRefunds` |
| [src/modules/finance/remittance.service.ts](<../../src/modules/finance/remittance.service.ts>) | implementation | `resolveProviderPayoutPeriod`, `getProviderRemittancesView`, `computeProviderRemittance` |
| [src/modules/finance/statement-expense.ts](<../../src/modules/finance/statement-expense.ts>) | implementation | `OPERATING_EXPENSE_ENTRY_TYPES`, `NON_EXPENSE_STATEMENT_ENTRY_TYPES`, `isReversalRow`, `isStatementLedgerRow`, `operatingExpenseContribution`, `sumOperatingExpenses`, `sumByType`, `buildLedgerLines` |
| [src/modules/finance/statement-signoff.service.ts](<../../src/modules/finance/statement-signoff.service.ts>) | implementation | `OWNER_VISIBLE_STATEMENT_STATUSES`, `isOwnerVisibleStatementStatus`, `SIGNABLE_STATEMENT_STATUSES`, `isSignableStatementStatus`, `StatementSignOffError`, `getStatementSignOffState`, `hasSignedOff`, `recordStatementSignOff` |
| [src/modules/finance/statement-snapshot.ts](<../../src/modules/finance/statement-snapshot.ts>) | implementation | `REVENUE_BOOKING_STATUSES`, `STATEMENT_BOOKING_STATUSES`, `dayAfter`, `StatementReceivableReviewError`, `hasPendingStatementReceivables`, `assertStatementReceivablesResolved`, `StatementAllocationReviewError`, `findUnallocatedStatementStay`, `collectSnapshotSources`, `sourceFingerprint`, `snapshotHash`, `verifyStatementSnapshot` |

<a id="module-home"></a>

### home

Файлов: 7; тестовых файлов: 3. [Описание](../../src/modules/home/README.md).

| Исходник | Вид | Named declarations |
|---|---|---|
| [src/modules/home/home-read-model.ts](<../../src/modules/home/home-read-model.ts>) | implementation | `rankProjects`, `interleaveByProject`, `SERVICE_SITUATIONS`, `groupServicesBySituation` |
| [src/modules/home/homepage-placement.ts](<../../src/modules/home/homepage-placement.ts>) | implementation | `activeHomepagePlacements`, `applyHomepagePlacements` |
| [src/modules/home/public-homepage.service.ts](<../../src/modules/home/public-homepage.service.ts>) | implementation | `getPublicHomepageData` |

<a id="module-integrations"></a>

### integrations

Файлов: 31; тестовых файлов: 14. [Описание](../../src/modules/integrations/README.md).

| Исходник | Вид | Named declarations |
|---|---|---|
| [src/modules/integrations/channel-health.ts](<../../src/modules/integrations/channel-health.ts>) | implementation | `getChannelHealthForUnits` |
| [src/modules/integrations/ical-fetch.ts](<../../src/modules/integrations/ical-fetch.ts>) | implementation | `ICalFetchError`, `assertSafeFeedUrl`, `fetchICalFeed` |
| [src/modules/integrations/ical-import.ts](<../../src/modules/integrations/ical-import.ts>) | implementation | `importICalEvents`, `createConflictNotifications`, `clearOtaImports` |
| [src/modules/integrations/ical-parse.ts](<../../src/modules/integrations/ical-parse.ts>) | implementation | `parseICal` |
| [src/modules/integrations/ical-sync.ts](<../../src/modules/integrations/ical-sync.ts>) | implementation | `ICAL_INTEGRATION_KEYS`, `readFeedUrl`, `syncICalAccount`, `syncAllICalAccounts` |
| [src/modules/integrations/ical-token.ts](<../../src/modules/integrations/ical-token.ts>) | implementation | `icalFeedToken`, `verifyIcalFeedToken`, `icalEventUid`, `icalFeedPath` |
| [src/modules/integrations/index.ts](<../../src/modules/integrations/index.ts>) | barrel | см. исходник |
| [src/modules/integrations/integrations.ts](<../../src/modules/integrations/integrations.ts>) | implementation | `registerIntegrationAccount`, `getDecryptedConfig`, `getIntegrationAccount`, `updateIntegrationStatus`, `recordIntegrationSync`, `disableIntegrationAccount`, `listIntegrationAccounts` |
| [src/modules/integrations/layantara/adapter.ts](<../../src/modules/integrations/layantara/adapter.ts>) | implementation | `classifyLegacyOccupancy`, `auditLegacyOccupancies` |
| [src/modules/integrations/layantara/channel-contract.ts](<../../src/modules/integrations/layantara/channel-contract.ts>) | implementation | `parseChannelEvent`, `verifyChannelSignature`, `channelPayloadHash` |
| [src/modules/integrations/layantara/channel-service.ts](<../../src/modules/integrations/layantara/channel-service.ts>) | implementation | `applyChannelEvent` |
| [src/modules/integrations/layantara/protection.service.ts](<../../src/modules/integrations/layantara/protection.service.ts>) | implementation | `stageProtection` |
| [src/modules/integrations/layantara/reviewed-workbook.ts](<../../src/modules/integrations/layantara/reviewed-workbook.ts>) | implementation | `evidenceDigest`, `readReviewedWorkbook`, `reviewedEntryForEvent`, `reviewedGuestKey` |
| [src/modules/integrations/layantara/workbook-import.ts](<../../src/modules/integrations/layantara/workbook-import.ts>) | implementation | `readXlsxSheet`, `parseReservationsWorkbook`, `mapChannel`, `planWorkbookImport`, `WorkbookReconciliationRequired`, `applyWorkbookImport` |
| [src/modules/integrations/messenger.ts](<../../src/modules/integrations/messenger.ts>) | implementation | `MessengerChannel`, `registerWhatsAppAccount`, `registerTelegramAccount`, `sendMessengerMessage`, `handleMessengerWebhook`, `getMessengerStatus` |
| [src/modules/integrations/unit-ical-conflicts.ts](<../../src/modules/integrations/unit-ical-conflicts.ts>) | implementation | `getUnitIcalConflictAlerts`, `getProjectIcalConflictAlerts` |

<a id="module-media"></a>

### media

Файлов: 16; тестовых файлов: 5. [Описание](../../src/modules/media/README.md).

| Исходник | Вид | Named declarations |
|---|---|---|
| [src/modules/media/client-upload.ts](<../../src/modules/media/client-upload.ts>) | implementation | `PHOTO_MIME_TYPES`, `MAX_PHOTO_BYTES`, `PhotoUploadError`, `validPhoto`, `finalizePhoto`, `uploadPhoto` |
| [src/modules/media/direct-upload.policy.ts](<../../src/modules/media/direct-upload.policy.ts>) | implementation | `DIRECT_UPLOAD_MAX_BYTES`, `DIRECT_UPLOAD_TTL_MS`, `DIRECT_UPLOAD_RECOVERY_MS`, `DIRECT_UPLOAD_JSON_BYTES`, `DirectUploadError`, `uploadFailure`, `parseDirectUploadRequest`, `readDirectUploadJson`, `photoPath`, `signDirectUploadIntent`, `verifyDirectUploadIntent`, `canonicalPhotoUrl`, `matchesPhotoSignature` |
| [src/modules/media/direct-upload.service.ts](<../../src/modules/media/direct-upload.service.ts>) | implementation | `directUploadConfig`, `createDirectUploadService` |
| [src/modules/media/gallery-policy.ts](<../../src/modules/media/gallery-policy.ts>) | implementation | `validateGalleryOrder`, `nextCover` |
| [src/modules/media/index.ts](<../../src/modules/media/index.ts>) | barrel | см. исходник |
| [src/modules/media/managed-yandex-import.ts](<../../src/modules/media/managed-yandex-import.ts>) | implementation | `MANAGED_YANDEX_SOURCES`, `importManagedYandexBatch`, `runManagedYandexImport` |
| [src/modules/media/media.service.ts](<../../src/modules/media/media.service.ts>) | implementation | `MAX_UPLOAD_BYTES`, `isAllowedImageType`, `storeMedia`, `mediaUrl` |
| [src/modules/media/public-readiness.ts](<../../src/modules/media/public-readiness.ts>) | implementation | `MIN_PUBLIC_GALLERY_PHOTOS`, `RECOMMENDED_PUBLIC_GALLERY_PHOTOS`, `PUBLIC_PHOTO_MIME_TYPES`, `assessGalleryReadiness`, `isRepresentativeRoom`, `assessUnitMediaReadiness`, `publicMediaReadinessMessage` |
| [src/modules/media/storage-config.ts](<../../src/modules/media/storage-config.ts>) | implementation | `mediaStorageCredentials` |
| [src/modules/media/video-policy.ts](<../../src/modules/media/video-policy.ts>) | implementation | `MAX_VIDEO_UPLOAD_BYTES`, `VIDEO_MIME_TYPES`, `GALLERY_UPLOAD_ACCEPT`, `VIDEO_UPLOAD_HINT`, `isAllowedVideoType`, `validVideoContent`, `validateVideoUpload` |

<a id="module-onboarding"></a>

### onboarding

Файлов: 26; тестовых файлов: 13. [Описание](../../src/modules/onboarding/README.md).

| Исходник | Вид | Named declarations |
|---|---|---|
| [src/modules/onboarding/canonical-onboarding.ts](<../../src/modules/onboarding/canonical-onboarding.ts>) | implementation | `requestedOfferToCanonical`, `canonicalOfferings`, `classifyPropertySubmission`, `normalizeUnitIdentifier`, `resolveCanonicalUnitTx`, `ensureDraftCommercialOfferingsTx`, `ONBOARDING_TRANSITIONS`, `canOnboardingTransition`, `deriveUnitOnboardingState`, `assertCommercialOfferingReadyForActivation` |
| [src/modules/onboarding/content-proposal.schema.ts](<../../src/modules/onboarding/content-proposal.schema.ts>) | implementation | `CONTENT_AMENITY_TEXT_FIELDS`, `contentAmenityText`, `contentAmenityTextChanged`, `contentAmenityHoursValue`, `ContentProposalValidationError`, `UNIT_FACT_KEYS`, `PROJECT_FACT_KEYS`, `parseScope`, `parseTargetId`, `parseContentProposal` |
| [src/modules/onboarding/content-proposal.service.test-support.ts](<../../src/modules/onboarding/content-proposal.service.test-support.ts>) | test support | `mediaId`, `foreignMediaId`, `fields`, `harness` |
| [src/modules/onboarding/content-proposal.service.ts](<../../src/modules/onboarding/content-proposal.service.ts>) | implementation | `CONTENT_PROPOSAL_SOURCE`, `ContentProposalError`, `authorizeContentTargetTx`, `createContentProposalService`, `contentProposalFailure` |
| [src/modules/onboarding/employee-creation-access.ts](<../../src/modules/onboarding/employee-creation-access.ts>) | implementation | `getEmployeeCreationAccessTx` |
| [src/modules/onboarding/employee-creation.schema.ts](<../../src/modules/onboarding/employee-creation.schema.ts>) | implementation | `EmployeeCreationError`, `creationInvalid`, `creationObject`, `creationExact`, `creationId`, `creationRequestId`, `creationKind`, `creationStatus`, `creationRevision`, `EMPLOYEE_UNIT_FIELDS`, `EMPLOYEE_COMPLEX_FIELDS`, `parseEmployeeCreationDraft`, `parseEmployeeCreationCreate`, `parseEmployeeCreationUpdate`, `hasEmployeeCreationReceipt`, `assertNoEmployeeCreationInput` |
| [src/modules/onboarding/employee-creation.service.ts](<../../src/modules/onboarding/employee-creation.service.ts>) | implementation | `EMPLOYEE_SUBMISSION_SOURCE`, `readEmployeeCreationReceipt`, `employeeCreationForConversionTx`, `getEmployeeCreationReviewOptions`, `hasEmployeeCreatedTargetAccessTx`, `listEmployeeCreatedTargetsTx`, `createEmployeeCreationService`, `employeeCreationFailure` |
| [src/modules/onboarding/employee-creation.test-support.ts](<../../src/modules/onboarding/employee-creation.test-support.ts>) | test support | `requestId`, `nextRequestId`, `employeeHarness` |
| [src/modules/onboarding/index.ts](<../../src/modules/onboarding/index.ts>) | barrel | см. исходник |
| [src/modules/onboarding/submission-description.ts](<../../src/modules/onboarding/submission-description.ts>) | implementation | `SubmissionDescriptionError`, `submissionDescriptionLocale`, `resolveSubmissionDescription`, `createSubmissionDescriptionTx` |
| [src/modules/onboarding/submission-unit-access.ts](<../../src/modules/onboarding/submission-unit-access.ts>) | implementation | `submissionUnitWhere` |
| [src/modules/onboarding/supplier-copy.ts](<../../src/modules/onboarding/supplier-copy.ts>) | implementation | `supplierCopy` |

<a id="module-ops"></a>

### ops

Файлов: 38; тестовых файлов: 20. [Описание](../../src/modules/ops/README.md).

| Исходник | Вид | Named declarations |
|---|---|---|
| [src/modules/ops/check-in-checklist.ts](<../../src/modules/ops/check-in-checklist.ts>) | implementation | `CHECK_IN_CHECKLIST_ITEMS`, `formatCheckInChecklistNotes` |
| [src/modules/ops/check-out-checklist.ts](<../../src/modules/ops/check-out-checklist.ts>) | implementation | см. исходник |
| [src/modules/ops/guest-pii.ts](<../../src/modules/ops/guest-pii.ts>) | implementation | `isEncrypted`, `encryptPii`, `safeDecrypt`, `encryptGuestPii` |
| [src/modules/ops/index.ts](<../../src/modules/ops/index.ts>) | barrel | см. исходник |
| [src/modules/ops/operating-creation-capabilities.ts](<../../src/modules/ops/operating-creation-capabilities.ts>) | implementation | `OPERATING_CREATION_CAPABILITIES`, `isOperatingCreationCapability` |
| [src/modules/ops/operating-space-access.service.ts](<../../src/modules/ops/operating-space-access.service.ts>) | implementation | `TASK_DEPARTMENTS`, `OperatingAccessError`, `getOperationalActor`, `getLegacyOperationalUnitIds`, `getScopedOperationalAccess`, `assertOperationalTaskAccess`, `operationalTaskVisibility`, `validOperatingCapabilities`, `eligibleOrganizationUnits`, `getOperatingSpaceOverviewAccess`, `assertOperationalTeamAssignment`, `assertOperationalTaskMediaAccess` |
| [src/modules/ops/operating-space-capabilities.ts](<../../src/modules/ops/operating-space-capabilities.ts>) | implementation | `GOVERNED_DAILY_CAPABILITIES`, `CAPABILITY_DEPARTMENTS` |
| [src/modules/ops/operating-space-capability-policy.ts](<../../src/modules/ops/operating-space-capability-policy.ts>) | implementation | `OPERATING_SPACE_CAPABILITIES` |
| [src/modules/ops/operating-space-governance.service.ts](<../../src/modules/ops/operating-space-governance.service.ts>) | implementation | `requireGovernanceFounder`, `createGovernedOperatingSpace`, `updateGovernedOperatingScope`, `updateGovernedOperatingMember` |
| [src/modules/ops/operating-space.service.ts](<../../src/modules/ops/operating-space.service.ts>) | implementation | `listOperatingSpacesForIdentity`, `getOperatingSpaceUnitIds`, `getOperatingSpaceMembership`, `hasOperatingSpaceCapability`, `assertOperatingSpaceCapability` |
| [src/modules/ops/operational-task.service.ts](<../../src/modules/ops/operational-task.service.ts>) | implementation | `ensureTurnoverTasksForCheckout`, `assertUnitReadyForCheckIn`, `transitionOperationalTask`, `getUnitReadinessMap`, `listOperationalTasks`, `createOperationalTask`, `createPreventiveMaintenancePlan`, `generateDuePreventiveMaintenanceTasks` |
| [src/modules/ops/ops-board.service.ts](<../../src/modules/ops/ops-board.service.ts>) | implementation | `getOpsBoard`, `getOpsMobilizationQueue`, `getOpsBookingRequests` |
| [src/modules/ops/pms-automation-rules.ts](<../../src/modules/ops/pms-automation-rules.ts>) | implementation | `suggestPmsActions` |
| [src/modules/ops/reservation-guests.service.ts](<../../src/modules/ops/reservation-guests.service.ts>) | implementation | `RESERVATION_DEPARTMENTS`, `RESERVATION_GUEST_SELECT`, `registeredReservationGuestIds`, `canUseReservationGuest`, `registerReservationGuest` |
| [src/modules/ops/tm30-address.ts](<../../src/modules/ops/tm30-address.ts>) | implementation | `TM30_IMMIGRATION_PORTAL_URL`, `buildTm30AddressBlock` |
| [src/modules/ops/tm30-filing.service.ts](<../../src/modules/ops/tm30-filing.service.ts>) | implementation | `createTm30Filing`, `markTm30FilingFiled`, `markTm30FilingFailed`, `getTm30Queue`, `logTm30PassportAccess`, `checkTm30Escalations`, `createConditionReport`, `getConditionReport` |
| [src/modules/ops/verification.service.ts](<../../src/modules/ops/verification.service.ts>) | implementation | `capturePassportData`, `markVerificationFailed`, `decryptPassportNumber`, `checkVerificationDeadlines` |

<a id="module-projects"></a>

### projects

Файлов: 86; тестовых файлов: 43. [Описание](../../src/modules/projects/README.md).

| Исходник | Вид | Named declarations |
|---|---|---|
| [src/modules/projects/amenity-usage-copy.ts](<../../src/modules/projects/amenity-usage-copy.ts>) | implementation | `AMENITY_USAGE_LABELS`, `AMENITY_USAGE_DRAFTS`, `amenityUsageLabels` |
| [src/modules/projects/amenity-usage.ts](<../../src/modules/projects/amenity-usage.ts>) | implementation | `amenityRecord`, `singleAmenityHours`, `hasSimpleAmenityHours`, `amenityLinesInput`, `parseAmenityLines`, `amenityHoursFromForm`, `amenityUsageLines`, `amenityLeadTime`, `amenityLeadTimeFromForm` |
| [src/modules/projects/area.service.ts](<../../src/modules/projects/area.service.ts>) | implementation | `listAreas`, `collectDescendantIds`, `buildAreaTree`, `wouldFormCycle`, `createArea`, `updateArea`, `resolveAreaLabelKey`, `getAreaForBrowse`, `listBrowsableAreas`, `getAreaPerformance`, `getPortfolioByArea` |
| [src/modules/projects/commercial-discovery.ts](<../../src/modules/projects/commercial-discovery.ts>) | implementation | `publicOfferingPriceThb`, `eligiblePublicHomeIntents`, `listPublicCommercialHomes`, `getPublicCommercialHomeById` |
| [src/modules/projects/edit-validation.ts](<../../src/modules/projects/edit-validation.ts>) | implementation | `PropertyEditConflict`, `editVersion`, `requiredText`, `physicalNumber`, `validatePhysicalFacts` |
| [src/modules/projects/engagement-scope.ts](<../../src/modules/projects/engagement-scope.ts>) | implementation | `currentEngagementWhere` |
| [src/modules/projects/index.ts](<../../src/modules/projects/index.ts>) | barrel | см. исходник |
| [src/modules/projects/inventory.seed.ts](<../../src/modules/projects/inventory.seed.ts>) | seed | `ensureSeedInventoryCategory` |
| [src/modules/projects/long-term-lease.ts](<../../src/modules/projects/long-term-lease.ts>) | implementation | `normalizeLongTermLeaseTerms`, `matchesLongTermLeaseSearch` |
| [src/modules/projects/mc.service.ts](<../../src/modules/projects/mc.service.ts>) | implementation | `getMCManagedUnits`, `getMCBookings`, `getMcBookingRequests`, `getMCTickets`, `getMCServiceOrders`, `getMCDashboard`, `getMCFeeReport`, `getMcMobilizationQueue`, `getMcTm30Queue`, `getMcIcalConflictAlerts` |
| [src/modules/projects/notify-owner-stay.ts](<../../src/modules/projects/notify-owner-stay.ts>) | implementation | `notifyOwnerStayBooked` |
| [src/modules/projects/owner-evidence.service.ts](<../../src/modules/projects/owner-evidence.service.ts>) | implementation | `readOwnerEvidenceDraft`, `saveOwnerEvidenceDraft` |
| [src/modules/projects/owner-evidence.ts](<../../src/modules/projects/owner-evidence.ts>) | implementation | `record`, `parseOwnerEvidence`, `readOwnerEvidenceStage` |
| [src/modules/projects/owner-landing.ts](<../../src/modules/projects/owner-landing.ts>) | implementation | `resolveOwnerPortalPath`, `singleOwnerUnitId` |
| [src/modules/projects/owner-period-allocation.ts](<../../src/modules/projects/owner-period-allocation.ts>) | implementation | `allocateBookingGrossToPeriod` |
| [src/modules/projects/owner-stay-turnover.ts](<../../src/modules/projects/owner-stay-turnover.ts>) | implementation | `scheduleOwnerStayTurnoverClean` |
| [src/modules/projects/owner.service.ts](<../../src/modules/projects/owner.service.ts>) | implementation | `bookOwnerStay`, `getOwnerDashboard`, `getOwnerBookingsList`, `getOwnerPortfolioShape`, `getOwnerProjects`, `getOwnerAlerts`, `getOwnerComplianceSummary`, `getOwnerStatements`, `getOwnerUnitDashboard` |
| [src/modules/projects/ownership.service.ts](<../../src/modules/projects/ownership.service.ts>) | implementation | `setUnitOwnerTx`, `setUnitOwner`, `getOwnerAt`, `getOwnershipHistory`, `ensureOwnershipRecorded` |
| [src/modules/projects/passport.service.ts](<../../src/modules/projects/passport.service.ts>) | implementation | `getPublicProjectPassport` |
| [src/modules/projects/project-amenities.service.ts](<../../src/modules/projects/project-amenities.service.ts>) | implementation | `PROJECT_AMENITY_ACCESS_TYPES`, `PROJECT_AMENITY_BOOKING_MODES`, `PROJECT_AMENITY_PRICING_TYPES`, `PROJECT_AMENITY_CONTENT_FIELDS`, `projectAmenityContentKey`, `amenitySlug`, `projectAmenityData`, `publicAmenityInclude`, `listPublicProjectAmenities`, `getPublicAmenityProjectBySlug`, `getPublicProjectAmenityBySlug` |
| [src/modules/projects/project-amenity-reservations.service.ts](<../../src/modules/projects/project-amenity-reservations.service.ts>) | implementation | `ProjectAmenityUnavailableError`, `createProjectAmenityReservation`, `cancelOwnProjectAmenityReservation` |
| [src/modules/projects/project-editorial.ts](<../../src/modules/projects/project-editorial.ts>) | implementation | `projectEditorialKey`, `categoryEditorialKeys` |
| [src/modules/projects/project-experience.ts](<../../src/modules/projects/project-experience.ts>) | implementation | `PROJECT_EXPERIENCE_CONTENT_FIELDS`, `projectExperienceContentKey` |
| [src/modules/projects/project-nearby.service.ts](<../../src/modules/projects/project-nearby.service.ts>) | implementation | `PROJECT_NEARBY_CATEGORIES`, `nearbyPlaceSlug`, `projectNearbyPlaceData`, `distanceMetersBetween`, `listProjectNearbyPlaces` |
| [src/modules/projects/projects.ts](<../../src/modules/projects/projects.ts>) | implementation | `createProject`, `getProject`, `getProjectBySlug`, `listProjects`, `updateProject`, `getProjectDetail` |
| [src/modules/projects/property-booking-mode.ts](<../../src/modules/projects/property-booking-mode.ts>) | implementation | `previewPropertyBookingMode`, `applyPropertyBookingMode` |
| [src/modules/projects/property-facts.service.ts](<../../src/modules/projects/property-facts.service.ts>) | implementation | `createDeveloperOrganization`, `addProjectOrganizationRole`, `getDeveloper360`, `getProjectFacts360`, `getUnitFacts360`, `calculatePropertyFactsCompleteness`, `calculateDeveloperCompleteness` |
| [src/modules/projects/property-readiness.ts](<../../src/modules/projects/property-readiness.ts>) | implementation | `getPropertyReadiness`, `assertUnitReadyForActivation`, `assertProjectReadyForActivation` |
| [src/modules/projects/public-discovery.ts](<../../src/modules/projects/public-discovery.ts>) | implementation | `discoveryVisibility`, `listPublicDiscoveryUnits` |
| [src/modules/projects/public-managed-import.ts](<../../src/modules/projects/public-managed-import.ts>) | implementation | `managedImportedInventoryIds` |
| [src/modules/projects/public-responsibility.ts](<../../src/modules/projects/public-responsibility.ts>) | implementation | `resolveUnitResponsibility`, `resolveProjectResponsibility` |
| [src/modules/projects/public-sleeping.ts](<../../src/modules/projects/public-sleeping.ts>) | implementation | `PUBLIC_SLEEPING_SPACES_QUERY`, `PUBLIC_BED_TYPES`, `publicSleepingSpaces` |
| [src/modules/projects/public.service.ts](<../../src/modules/projects/public.service.ts>) | implementation | `listPublicProjects`, `getPublicProjectBySlug`, `getPublicUnitById`, `listPublicUnitIds` |
| [src/modules/projects/residence.service.ts](<../../src/modules/projects/residence.service.ts>) | implementation | `getResidences` |
| [src/modules/projects/sleeping-space-input.ts](<../../src/modules/projects/sleeping-space-input.ts>) | implementation | `SLEEPING_BED_TYPES`, `validateSleepingSpace` |
| [src/modules/projects/sleeping-space-write.ts](<../../src/modules/projects/sleeping-space-write.ts>) | implementation | `SleepingSpaceRequestConflict`, `sleepingSpaceRequestKey`, `saveSleepingSpace` |
| [src/modules/projects/stay-offering-backfill.ts](<../../src/modules/projects/stay-offering-backfill.ts>) | implementation | `ensureStayOfferingsForLiveUnits` |
| [src/modules/projects/structure-kinds.ts](<../../src/modules/projects/structure-kinds.ts>) | implementation | `structureKinds`, `assertAcyclicStructureParent` |
| [src/modules/projects/taxonomies.ts](<../../src/modules/projects/taxonomies.ts>) | implementation | `PROJECT_TYPES`, `ORGANIZATION_ROLES`, `PROJECT_FACILITIES`, `BED_TYPES`, `VIEWS`, `OWNERSHIP_TENURES`, `BLOCKING_REASONS`, `getLabel` |
| [src/modules/projects/unit-marketing-title.ts](<../../src/modules/projects/unit-marketing-title.ts>) | implementation | `resolveUnitMarketingTitleKey` |
| [src/modules/projects/unit-publication-readiness.ts](<../../src/modules/projects/unit-publication-readiness.ts>) | implementation | `getUnitPublicationReadiness` |
| [src/modules/projects/units.ts](<../../src/modules/projects/units.ts>) | implementation | `createUnit`, `getUnit`, `listUnits`, `updateUnit`, `confirmPermittedUse`, `getUnitDetail` |

<a id="module-sales-offers"></a>

### sales-offers

Файлов: 10; тестовых файлов: 2. [Описание](../../src/modules/sales-offers/README.md).

| Исходник | Вид | Named declarations |
|---|---|---|
| [src/modules/sales-offers/contracts.ts](<../../src/modules/sales-offers/contracts.ts>) | implementation | `OfferError`, `parseStay` |
| [src/modules/sales-offers/http.ts](<../../src/modules/sales-offers/http.ts>) | implementation | `offerResponse`, `offerFailure` |
| [src/modules/sales-offers/offer.service.ts](<../../src/modules/sales-offers/offer.service.ts>) | implementation | `quoteOption`, `searchOffers`, `createOffer`, `readOffer`, `guestProjection`, `sanitizeOption`, `revalidateOffer`, `requestOfferBooking` |
| [src/modules/sales-offers/presentation.ts](<../../src/modules/sales-offers/presentation.ts>) | implementation | `offerMoney`, `offerText`, `priceRows` |
| [src/modules/sales-offers/public-shell.ts](<../../src/modules/sales-offers/public-shell.ts>) | implementation | `proposalShell` |
| [src/modules/sales-offers/share.service.ts](<../../src/modules/sales-offers/share.service.ts>) | implementation | `issueOfferShare`, `revokeOfferShare`, `viewOfferShare` |
| [src/modules/sales-offers/tariff-provenance.ts](<../../src/modules/sales-offers/tariff-provenance.ts>) | implementation | `SALES_PRICING_CONTRACT`, `stableHash`, `tariffFingerprint` |

<a id="module-services"></a>

### services

Файлов: 23; тестовых файлов: 12. [Описание](../../src/modules/services/README.md).

| Исходник | Вид | Named declarations |
|---|---|---|
| [src/modules/services/index.ts](<../../src/modules/services/index.ts>) | barrel | см. исходник |
| [src/modules/services/notify-order-reminder.ts](<../../src/modules/services/notify-order-reminder.ts>) | implementation | `notifyServiceOrderReminder`, `remindUnansweredServiceOrders`, `sendServiceOrderReviewPrompts` |
| [src/modules/services/project-service-offer.ts](<../../src/modules/services/project-service-offer.ts>) | implementation | `resolveProjectServiceOffer` |
| [src/modules/services/provider-notify.ts](<../../src/modules/services/provider-notify.ts>) | implementation | `notifyProviderMembers` |
| [src/modules/services/provider.service.ts](<../../src/modules/services/provider.service.ts>) | implementation | `createProviderApplication`, `getProviderApplications`, `approveProvider`, `rejectProvider`, `getProviderForIdentity`, `getProvider` |
| [src/modules/services/service-order-closure.ts](<../../src/modules/services/service-order-closure.ts>) | implementation | `FULFILMENT_WINDOW_KEY`, `ServiceOrderClosureError`, `lockServiceOrder`, `fulfilmentDeadline`, `serviceOrderDeadline`, `assertServiceOrderDisputable`, `confirmServiceOrder`, `closeFulfilledServiceOrders` |
| [src/modules/services/service-order-customer-view.ts](<../../src/modules/services/service-order-customer-view.ts>) | implementation | `getServiceOrderCustomerView`, `customerServiceTerms` |
| [src/modules/services/service-order.service.ts](<../../src/modules/services/service-order.service.ts>) | implementation | `ServiceOrderRequestConflict`, `createServiceOrder`, `acceptServiceOrder`, `declineServiceOrder`, `fulfillServiceOrder`, `reportProviderNoShow`, `cancelServiceOrder`, `getServiceOrder`, `getServiceOrdersByProvider`, `rateServiceOrder`, `expireStaleServiceOrders` |
| [src/modules/services/service.service.ts](<../../src/modules/services/service.service.ts>) | implementation | `pickLocalizedServiceCopy`, `createService`, `getService`, `updateService`, `getServicesByProvider`, `listPublicServices`, `getPublicMarketplaceServiceDetail`, `listPublicMarketplaceServices`, `approveService`, `rejectService`, `getServiceAverageRating` |
| [src/modules/services/standalone-context.ts](<../../src/modules/services/standalone-context.ts>) | implementation | `parseStandaloneContext`, `getStandaloneServiceOffer`, `validateStandaloneServiceContext`, `standaloneOrganizationId` |

<a id="module-workflows"></a>

### workflows

Файлов: 4; тестовых файлов: 3. [Описание](../../src/modules/workflows/README.md).

| Исходник | Вид | Named declarations |
|---|---|---|

## Shared helpers, components и route-local orchestration

Помимо modules, реализация находится в app/actions, app/libs, lib, jobs и components. Source links позволяют сверить каждую поверхность с конкретным компонентом.


### src/lib

- [src/lib/bookingRequestInboxLabels.ts](<../../src/lib/bookingRequestInboxLabels.ts>)
- [src/lib/calendar-navigation.ts](<../../src/lib/calendar-navigation.ts>)
- [src/lib/checkOutModalLabels.ts](<../../src/lib/checkOutModalLabels.ts>)
- [src/lib/csv.ts](<../../src/lib/csv.ts>)
- [src/lib/date.ts](<../../src/lib/date.ts>)
- [src/lib/design-tokens.ts](<../../src/lib/design-tokens.ts>)
- [src/lib/discovery-navigation.ts](<../../src/lib/discovery-navigation.ts>)
- [src/lib/encryption.ts](<../../src/lib/encryption.ts>)
- [src/lib/enum-labels.ts](<../../src/lib/enum-labels.ts>)
- [src/lib/example.ts](<../../src/lib/example.ts>)
- [src/lib/format.ts](<../../src/lib/format.ts>)
- [src/lib/gallery-copy.ts](<../../src/lib/gallery-copy.ts>)
- [src/lib/guest-journey.ts](<../../src/lib/guest-journey.ts>)
- [src/lib/i18n.ts](<../../src/lib/i18n.ts>)
- [src/lib/launch-readiness.ts](<../../src/lib/launch-readiness.ts>)
- [src/lib/money.ts](<../../src/lib/money.ts>)
- [src/lib/observability.ts](<../../src/lib/observability.ts>)
- [src/lib/place-search.ts](<../../src/lib/place-search.ts>)
- [src/lib/plus-code.ts](<../../src/lib/plus-code.ts>)
- [src/lib/pms-navigation.ts](<../../src/lib/pms-navigation.ts>)
- [src/lib/presentation-media.ts](<../../src/lib/presentation-media.ts>)
- [src/lib/prisma.ts](<../../src/lib/prisma.ts>)
- [src/lib/property-area.ts](<../../src/lib/property-area.ts>)
- [src/lib/property-count.ts](<../../src/lib/property-count.ts>)
- [src/lib/property-editor-return.ts](<../../src/lib/property-editor-return.ts>)
- [src/lib/resolveDatabaseUrl.ts](<../../src/lib/resolveDatabaseUrl.ts>)
- [src/lib/safe-next-path.ts](<../../src/lib/safe-next-path.ts>)
- [src/lib/secret-catalog.ts](<../../src/lib/secret-catalog.ts>)
- [src/lib/seo.ts](<../../src/lib/seo.ts>)
- [src/lib/session-generation.ts](<../../src/lib/session-generation.ts>)
- [src/lib/session-policy.ts](<../../src/lib/session-policy.ts>)
- [src/lib/session.ts](<../../src/lib/session.ts>)
- [src/lib/status.ts](<../../src/lib/status.ts>)
- [src/lib/stitch-surface.ts](<../../src/lib/stitch-surface.ts>)
- [src/lib/workspace-navigation-server.ts](<../../src/lib/workspace-navigation-server.ts>)
- [src/lib/workspace-navigation.ts](<../../src/lib/workspace-navigation.ts>)

### src/jobs

- [src/jobs/auth.ts](<../../src/jobs/auth.ts>)
- [src/jobs/dispatch.ts](<../../src/jobs/dispatch.ts>)
- [src/jobs/health.ts](<../../src/jobs/health.ts>)
- [src/jobs/index.ts](<../../src/jobs/index.ts>)
- [src/jobs/record.ts](<../../src/jobs/record.ts>)
- [src/jobs/registry.ts](<../../src/jobs/registry.ts>)

### src/app/actions

- [src/app/actions/getActiveStay.ts](<../../src/app/actions/getActiveStay.ts>)
- [src/app/actions/getAdminSignals.ts](<../../src/app/actions/getAdminSignals.ts>)
- [src/app/actions/getCurrentUser.ts](<../../src/app/actions/getCurrentUser.ts>)
- [src/app/actions/getHandbookContent.ts](<../../src/app/actions/getHandbookContent.ts>)
- [src/app/actions/getInStayHomeSpace.ts](<../../src/app/actions/getInStayHomeSpace.ts>)
- [src/app/actions/getIntegrationHealth.ts](<../../src/app/actions/getIntegrationHealth.ts>)
- [src/app/actions/getMCDashboard.ts](<../../src/app/actions/getMCDashboard.ts>)
- [src/app/actions/getOwnerDashboard.ts](<../../src/app/actions/getOwnerDashboard.ts>)
- [src/app/actions/session-identity.ts](<../../src/app/actions/session-identity.ts>)

### src/app/libs

- [src/app/libs/bookingAccess.ts](<../../src/app/libs/bookingAccess.ts>)
- [src/app/libs/bookingCancelled.ts](<../../src/app/libs/bookingCancelled.ts>)
- [src/app/libs/bookingConfirmed.ts](<../../src/app/libs/bookingConfirmed.ts>)
- [src/app/libs/bookingOperationsAccess.ts](<../../src/app/libs/bookingOperationsAccess.ts>)
- [src/app/libs/bookingOperatorAccess.ts](<../../src/app/libs/bookingOperatorAccess.ts>)
- [src/app/libs/errorHandler.ts](<../../src/app/libs/errorHandler.ts>)
- [src/app/libs/managedMediaGuard.ts](<../../src/app/libs/managedMediaGuard.ts>)
- [src/app/libs/mcGuard.ts](<../../src/app/libs/mcGuard.ts>)
- [src/app/libs/onboardingGuard.ts](<../../src/app/libs/onboardingGuard.ts>)
- [src/app/libs/opsProjectContext.ts](<../../src/app/libs/opsProjectContext.ts>)
- [src/app/libs/pricingGuard.ts](<../../src/app/libs/pricingGuard.ts>)
- [src/app/libs/prismadb.ts](<../../src/app/libs/prismadb.ts>)
- [src/app/libs/projectExperienceGuard.ts](<../../src/app/libs/projectExperienceGuard.ts>)
- [src/app/libs/projectScope.ts](<../../src/app/libs/projectScope.ts>)
- [src/app/libs/providerGuard.ts](<../../src/app/libs/providerGuard.ts>)
- [src/app/libs/rateLimit.ts](<../../src/app/libs/rateLimit.ts>)
- [src/app/libs/requireAdminPage.ts](<../../src/app/libs/requireAdminPage.ts>)
- [src/app/libs/serviceOrderGuards.ts](<../../src/app/libs/serviceOrderGuards.ts>)
- [src/app/libs/serviceOrderSerializer.ts](<../../src/app/libs/serviceOrderSerializer.ts>)
- [src/app/libs/supplierListingAccess.ts](<../../src/app/libs/supplierListingAccess.ts>)
- [src/app/libs/ticketScope.ts](<../../src/app/libs/ticketScope.ts>)
- [src/app/libs/unitCalendarLabels.ts](<../../src/app/libs/unitCalendarLabels.ts>)

### src/components

- [src/components/announcements/AnnouncementsComposer.tsx](<../../src/components/announcements/AnnouncementsComposer.tsx>)
- [src/components/Avatar.tsx](<../../src/components/Avatar.tsx>)
- [src/components/Badge.tsx](<../../src/components/Badge.tsx>)
- [src/components/booking/BankTransferInstructions.tsx](<../../src/components/booking/BankTransferInstructions.tsx>)
- [src/components/booking/BookingRequestInboxDetails.tsx](<../../src/components/booking/BookingRequestInboxDetails.tsx>)
- [src/components/booking/BookingRequestRespondActions.tsx](<../../src/components/booking/BookingRequestRespondActions.tsx>)
- [src/components/BookingSteps.tsx](<../../src/components/BookingSteps.tsx>)
- [src/components/Breadcrumb.tsx](<../../src/components/Breadcrumb.tsx>)
- [src/components/Button.tsx](<../../src/components/Button.tsx>)
- [src/components/Chip.tsx](<../../src/components/Chip.tsx>)
- [src/components/ChoiceControls.tsx](<../../src/components/ChoiceControls.tsx>)
- [src/components/ConfirmDialog.tsx](<../../src/components/ConfirmDialog.tsx>)
- [src/components/Counter.tsx](<../../src/components/Counter.tsx>)
- [src/components/DataTable.tsx](<../../src/components/DataTable.tsx>)
- [src/components/DiscoveryHomes.tsx](<../../src/components/DiscoveryHomes.tsx>)
- [src/components/DiscoverySearch.tsx](<../../src/components/DiscoverySearch.tsx>)
- [src/components/FeedbackLink.tsx](<../../src/components/FeedbackLink.tsx>)
- [src/components/FieldLabel.tsx](<../../src/components/FieldLabel.tsx>)
- [src/components/fieldStyles.ts](<../../src/components/fieldStyles.ts>)
- [src/components/Footer.tsx](<../../src/components/Footer.tsx>)
- [src/components/home/EcosystemEntry.tsx](<../../src/components/home/EcosystemEntry.tsx>)
- [src/components/home/home-intent.ts](<../../src/components/home/home-intent.ts>)
- [src/components/home/HomeFinder.tsx](<../../src/components/home/HomeFinder.tsx>)
- [src/components/home/HomeIntentProvider.tsx](<../../src/components/home/HomeIntentProvider.tsx>)
- [src/components/home/HomeOffersRail.tsx](<../../src/components/home/HomeOffersRail.tsx>)
- [src/components/home/PlaceCombobox.tsx](<../../src/components/home/PlaceCombobox.tsx>)
- [src/components/HomeIntentRail.tsx](<../../src/components/HomeIntentRail.tsx>)
- [src/components/index.ts](<../../src/components/index.ts>)
- [src/components/Input.tsx](<../../src/components/Input.tsx>)
- [src/components/instay/ActiveOrdersList.tsx](<../../src/components/instay/ActiveOrdersList.tsx>)
- [src/components/instay/AnnouncementsSection.tsx](<../../src/components/instay/AnnouncementsSection.tsx>)
- [src/components/instay/ExtendStayPanel.tsx](<../../src/components/instay/ExtendStayPanel.tsx>)
- [src/components/instay/index.ts](<../../src/components/instay/index.ts>)
- [src/components/instay/QuickActionsRow.tsx](<../../src/components/instay/QuickActionsRow.tsx>)
- [src/components/instay/ServiceOrderRatingModal.tsx](<../../src/components/instay/ServiceOrderRatingModal.tsx>)
- [src/components/instay/ServicesRail.tsx](<../../src/components/instay/ServicesRail.tsx>)
- [src/components/instay/StayCard.tsx](<../../src/components/instay/StayCard.tsx>)
- [src/components/LeadForm.tsx](<../../src/components/LeadForm.tsx>)
- [src/components/LegalEntityBlock.tsx](<../../src/components/LegalEntityBlock.tsx>)
- [src/components/LocalDate.tsx](<../../src/components/LocalDate.tsx>)
- [src/components/LocaleProvider.tsx](<../../src/components/LocaleProvider.tsx>)
- [src/components/LocaleSwitcher.tsx](<../../src/components/LocaleSwitcher.tsx>)
- [src/components/MobileTabBar.tsx](<../../src/components/MobileTabBar.tsx>)
- [src/components/MoneyAmount.tsx](<../../src/components/MoneyAmount.tsx>)
- [src/components/Navbar.tsx](<../../src/components/Navbar.tsx>)
- [src/components/NotificationBell.tsx](<../../src/components/NotificationBell.tsx>)
- [src/components/ops/ArrivalPassportCaptureModal.tsx](<../../src/components/ops/ArrivalPassportCaptureModal.tsx>)
- [src/components/ops/CheckInConditionReportModal.tsx](<../../src/components/ops/CheckInConditionReportModal.tsx>)
- [src/components/ops/CheckOutConditionReportModal.tsx](<../../src/components/ops/CheckOutConditionReportModal.tsx>)
- [src/components/ops/ManualReservationForm.tsx](<../../src/components/ops/ManualReservationForm.tsx>)
- [src/components/ops/OperationalTaskCreateForm.tsx](<../../src/components/ops/OperationalTaskCreateForm.tsx>)
- [src/components/ops/OperationalTaskQueueClient.tsx](<../../src/components/ops/OperationalTaskQueueClient.tsx>)
- [src/components/ops/OpsProjectSwitcher.tsx](<../../src/components/ops/OpsProjectSwitcher.tsx>)
- [src/components/ops/OpsStatusPill.tsx](<../../src/components/ops/OpsStatusPill.tsx>)
- [src/components/ops/PreventiveMaintenanceForm.tsx](<../../src/components/ops/PreventiveMaintenanceForm.tsx>)
- [src/components/ops/ReservationGroupForm.tsx](<../../src/components/ops/ReservationGroupForm.tsx>)
- [src/components/ops/ReservationSummaryCard.tsx](<../../src/components/ops/ReservationSummaryCard.tsx>)
- [src/components/ops/StayActions.tsx](<../../src/components/ops/StayActions.tsx>)
- [src/components/ops/Tm30FilingDetailDrawer.tsx](<../../src/components/ops/Tm30FilingDetailDrawer.tsx>)
- [src/components/ops/UnifiedStayCalendar.tsx](<../../src/components/ops/UnifiedStayCalendar.tsx>)
- [src/components/owner/BookingsList.tsx](<../../src/components/owner/BookingsList.tsx>)
- [src/components/owner/index.ts](<../../src/components/owner/index.ts>)
- [src/components/owner/LatestStatementCard.tsx](<../../src/components/owner/LatestStatementCard.tsx>)
- [src/components/owner/OpenTicketsList.tsx](<../../src/components/owner/OpenTicketsList.tsx>)
- [src/components/owner/OwnerStayModal.tsx](<../../src/components/owner/OwnerStayModal.tsx>)
- [src/components/owner/ProjectSwitcher.tsx](<../../src/components/owner/ProjectSwitcher.tsx>)
- [src/components/owner/SellInterestCard.tsx](<../../src/components/owner/SellInterestCard.tsx>)
- [src/components/owner/StatTile.tsx](<../../src/components/owner/StatTile.tsx>)
- [src/components/OwnerEvidenceDraftEditor.tsx](<../../src/components/OwnerEvidenceDraftEditor.tsx>)
- [src/components/Placeholder.tsx](<../../src/components/Placeholder.tsx>)
- [src/components/premium/AudienceLanding.tsx](<../../src/components/premium/AudienceLanding.tsx>)
- [src/components/premium/PremiumPrimitives.tsx](<../../src/components/premium/PremiumPrimitives.tsx>)
- [src/components/premium/StitchPage.tsx](<../../src/components/premium/StitchPage.tsx>)
- [src/components/PriceBreakdown.tsx](<../../src/components/PriceBreakdown.tsx>)
- [src/components/ProjectCard.tsx](<../../src/components/ProjectCard.tsx>)
- [src/components/projects/AmenityBookingClient.tsx](<../../src/components/projects/AmenityBookingClient.tsx>)
- [src/components/projects/AmenityHoursEditor.tsx](<../../src/components/projects/AmenityHoursEditor.tsx>)
- [src/components/projects/AmenityTranslationsEditor.tsx](<../../src/components/projects/AmenityTranslationsEditor.tsx>)
- [src/components/projects/ProjectAmenitiesSection.tsx](<../../src/components/projects/ProjectAmenitiesSection.tsx>)
- [src/components/projects/ProjectEditorialSections.tsx](<../../src/components/projects/ProjectEditorialSections.tsx>)
- [src/components/projects/ProjectNearbySection.tsx](<../../src/components/projects/ProjectNearbySection.tsx>)
- [src/components/projects/ProjectPortalNav.tsx](<../../src/components/projects/ProjectPortalNav.tsx>)
- [src/components/projects/ProjectServiceMarketplace.tsx](<../../src/components/projects/ProjectServiceMarketplace.tsx>)
- [src/components/projects/ProjectStoryEditor.tsx](<../../src/components/projects/ProjectStoryEditor.tsx>)
- [src/components/projects/ProjectWorkspaceNav.tsx](<../../src/components/projects/ProjectWorkspaceNav.tsx>)
- [src/components/projects/UnitProjectAmenities.tsx](<../../src/components/projects/UnitProjectAmenities.tsx>)
- [src/components/property/ManagedGallery.tsx](<../../src/components/property/ManagedGallery.tsx>)
- [src/components/property/ManagedSleepingSpaces.tsx](<../../src/components/property/ManagedSleepingSpaces.tsx>)
- [src/components/property/PropertyDealClient.tsx](<../../src/components/property/PropertyDealClient.tsx>)
- [src/components/property/PropertyImage.tsx](<../../src/components/property/PropertyImage.tsx>)
- [src/components/property/SaveHomeButton.tsx](<../../src/components/property/SaveHomeButton.tsx>)
- [src/components/property/ScopedGalleryEditor.tsx](<../../src/components/property/ScopedGalleryEditor.tsx>)
- [src/components/property/ShareStayOffer.tsx](<../../src/components/property/ShareStayOffer.tsx>)
- [src/components/property/SimilarAvailableHomes.tsx](<../../src/components/property/SimilarAvailableHomes.tsx>)
- [src/components/property/StructureEditor.tsx](<../../src/components/property/StructureEditor.tsx>)
- [src/components/property/usePropertyEdit.ts](<../../src/components/property/usePropertyEdit.ts>)
- [src/components/public-analytics.ts](<../../src/components/public-analytics.ts>)
- [src/components/PublicAnalyticsLink.tsx](<../../src/components/PublicAnalyticsLink.tsx>)
- [src/components/RoleContextBanner.tsx](<../../src/components/RoleContextBanner.tsx>)
- [src/components/search/SearchResultsMap.tsx](<../../src/components/search/SearchResultsMap.tsx>)
- [src/components/SearchBar.tsx](<../../src/components/SearchBar.tsx>)
- [src/components/Select.tsx](<../../src/components/Select.tsx>)
- [src/components/ServiceCard.tsx](<../../src/components/ServiceCard.tsx>)
- [src/components/ServiceCategoryIcon.tsx](<../../src/components/ServiceCategoryIcon.tsx>)
- [src/components/SkeletonBlock.tsx](<../../src/components/SkeletonBlock.tsx>)
- [src/components/SlaCountdown.tsx](<../../src/components/SlaCountdown.tsx>)
- [src/components/StateComponents.tsx](<../../src/components/StateComponents.tsx>)
- [src/components/StatTile.tsx](<../../src/components/StatTile.tsx>)
- [src/components/StatusTimeline.tsx](<../../src/components/StatusTimeline.tsx>)
- [src/components/StayDatePicker.tsx](<../../src/components/StayDatePicker.tsx>)
- [src/components/stitch/ApplicationFrame.tsx](<../../src/components/stitch/ApplicationFrame.tsx>)
- [src/components/stitch/McWorkspaceShell.tsx](<../../src/components/stitch/McWorkspaceShell.tsx>)
- [src/components/stitch/StitchShells.tsx](<../../src/components/stitch/StitchShells.tsx>)
- [src/components/Textarea.tsx](<../../src/components/Textarea.tsx>)
- [src/components/TrustMark.tsx](<../../src/components/TrustMark.tsx>)
- [src/components/UnitPhotoMosaic.tsx](<../../src/components/UnitPhotoMosaic.tsx>)
- [src/components/units/AvailabilityPricingPanel.tsx](<../../src/components/units/AvailabilityPricingPanel.tsx>)
- [src/components/units/PublicSleepingSummary.tsx](<../../src/components/units/PublicSleepingSummary.tsx>)
- [src/components/units/tariff-labels.ts](<../../src/components/units/tariff-labels.ts>)
- [src/components/units/UnitIcalConflictBanner.tsx](<../../src/components/units/UnitIcalConflictBanner.tsx>)
- [src/components/units/UnitIntegrationHealthStrip.tsx](<../../src/components/units/UnitIntegrationHealthStrip.tsx>)
- [src/components/units/UnitPublicationPanel.tsx](<../../src/components/units/UnitPublicationPanel.tsx>)
- [src/components/VerifyEmailBanner.tsx](<../../src/components/VerifyEmailBanner.tsx>)
- [src/components/viz/BarChart.tsx](<../../src/components/viz/BarChart.tsx>)
- [src/components/viz/ChartTable.tsx](<../../src/components/viz/ChartTable.tsx>)
- [src/components/viz/DeltaChip.tsx](<../../src/components/viz/DeltaChip.tsx>)
- [src/components/viz/HBarStack.tsx](<../../src/components/viz/HBarStack.tsx>)
- [src/components/viz/HeroNumber.tsx](<../../src/components/viz/HeroNumber.tsx>)
- [src/components/viz/index.ts](<../../src/components/viz/index.ts>)
- [src/components/viz/LineChart.tsx](<../../src/components/viz/LineChart.tsx>)
- [src/components/viz/MonthHeatStrip.tsx](<../../src/components/viz/MonthHeatStrip.tsx>)
- [src/components/viz/palette.ts](<../../src/components/viz/palette.ts>)
- [src/components/viz/Sparkline.tsx](<../../src/components/viz/Sparkline.tsx>)
- [src/components/WorkspaceNavigation.tsx](<../../src/components/WorkspaceNavigation.tsx>)

## Все модели и enum values

Source: [prisma/schema.prisma](<../../prisma/schema.prisma>). Ни одна модель автоматически не считается реализованным user journey. Scalar/relation/default/index/mapping definitions ниже воспроизводятся из schema; SQL constraints и triggers находятся в migrations.

### enum IdentityStatus

```prisma
enum IdentityStatus {
  active
  invited
  blocked
  merged
  deletion_requested
}
```

### enum AuthProvider

```prisma
enum AuthProvider {
  google
  apple
}
```

### enum OneTimeTokenPurpose

```prisma
enum OneTimeTokenPurpose {
  password_reset
  email_verify
  account_claim
}
```

### enum ProjectStatus

```prisma
enum ProjectStatus {
  draft
  live
  archived
}
```

### enum AreaStatus

```prisma
enum AreaStatus {
  draft
  live
}
```

### enum UnitType

```prisma
enum UnitType {
  villa
  condo
  townhouse
}
```

### enum UnitStatus

```prisma
enum UnitStatus {
  draft
  mobilizing
  live
  paused
  offboarded
}
```

### enum UnitEngagementType

```prisma
enum UnitEngagementType {
  direct_managed
  via_management_company
  owner_direct
}
```

### enum UnitEngagementStatus

```prisma
enum UnitEngagementStatus {
  draft
  active
  ended
}
```

### enum OrganizationType

```prisma
enum OrganizationType {
  management_company
  juristic_person
  developer
}
```

### enum OrganizationStatus

```prisma
enum OrganizationStatus {
  active
  suspended
}
```

### enum RoleType

```prisma
enum RoleType {
  owner
  guest
  resident
  buyer
  provider_member
  mc_member
  juristic_member
  staff_ops
  onsite_host
  content_contributor
  pricing_editor
  booking_mode_editor
}
```

### enum RoleScopeType

```prisma
enum RoleScopeType {
  platform
  project
  unit
}
```

### enum RoleStatus

```prisma
enum RoleStatus {
  active
  revoked
}
```

### enum BlockedDateReason

```prisma
enum BlockedDateReason {
  maintenance
  owner_hold
  ota_import
  other
}
```

### enum BookingType

```prisma
enum BookingType {
  guest_stay
  owner_stay
  external_ota
  internal_block
}
```

### enum BookingChannel

```prisma
enum BookingChannel {
  direct
  airbnb
  booking_com
  agoda
  agent
  manual
  expedia
  trip_com
}
```

### enum BookingStatus

```prisma
enum BookingStatus {
  requested
  pending_payment
  confirmed
  checked_in
  checked_out
  completed
  declined
  expired
  cancelled
}
```

### enum BookingPartyDetailsStatus

```prisma
enum BookingPartyDetailsStatus {
  known
  source_unknown
}
```

### enum BookingReceivableStatus

```prisma
enum BookingReceivableStatus {
  collectible
  pending_reconciliation
}
```

### enum VerificationStatus

```prisma
enum VerificationStatus {
  not_required
  pending
  passports_received
  failed
}
```

### enum BookingChangeType

```prisma
enum BookingChangeType {
  dates
  party
  cancel
  status
  price
}
```

### enum PaymentPurpose

```prisma
enum PaymentPurpose {
  stay
  stay_balance
  service_order
  deposit_preauth
}
```

### enum PaymentMethod

```prisma
enum PaymentMethod {
  cash
  bank_transfer
  card_provider
}
```

### enum PaymentProvider

```prisma
enum PaymentProvider {
  cash
  bank_transfer
  mock
  opn
}
```

### enum PaymentStatus

```prisma
enum PaymentStatus {
  created
  pending
  succeeded
  failed
  expired
  voided
}
```

### enum RefundMethod

```prisma
enum RefundMethod {
  cash
  card_provider
}
```

### enum RefundReason

```prisma
enum RefundReason {
  cancellation
  modification_decrease
  provider_no_show
  dispute_resolution
  goodwill
}
```

### enum RefundStatus

```prisma
enum RefundStatus {
  requested
  processing
  succeeded
  failed
  written_off
}
```

### enum LedgerEntryType

```prisma
enum LedgerEntryType {
  rental_revenue
  service_commission
  ota_commission_cost
  cleaning_cost
  maintenance_cost
  consumables_cost
  utilities_cost
  mc_platform_fee
  owner_direct_fee
  setup_fee
  tax_collected
  payout_owner
  payout_provider
  refund_out
  adjustment
  payment_unallocated
}
```

### enum OwnerStatementStatus

```prisma
enum OwnerStatementStatus {
  draft
  published
  superseded
  // Appended, in this order, by 20260813000010_owner_reporting_and_transparency.
  // The order has to match the database, or Prisma sees a difference and
  // rewrites the type.
  pending_owner_review
  signed_off
  distributed
}
```

### enum LineItemCategory

```prisma
enum LineItemCategory {
  booking_revenue
  refund
  service_fee
  operating_expense
  tax
  performance_fee
}
```

### enum PayoutPayeeType

```prisma
enum PayoutPayeeType {
  owner
  provider
}
```

### enum PayoutMethod

```prisma
enum PayoutMethod {
  bank_transfer_thb
  other
}
```

### enum PayoutStatus

```prisma
enum PayoutStatus {
  recorded
  reconciled
}
```

### enum DepositClaimStatus

```prisma
enum DepositClaimStatus {
  filed
  approved
  rejected
  disputed
}
```

### enum DepositPreauthStatus

```prisma
enum DepositPreauthStatus {
  authorized
  voided
  captured
}
```

### enum MediaAssetKind

```prisma
enum MediaAssetKind {
  photo
  document
  receipt
  passport
  avatar
  brand
}
```

### enum NotificationChannel

```prisma
enum NotificationChannel {
  in_app
  email
  whatsapp
  telegram
}
```

### enum NotificationType

```prisma
enum NotificationType {
  auth_verify_email
  auth_password_reset
  auth_account_claim
  stay_confirmed
  stay_request_placed
  stay_request_approved
  stay_request_declined
  stay_hold_expired
  stay_prearrival_passports
  stay_checkin_instructions
  stay_checkout_reminder
  stay_cancelled
  stay_dates_modified
  stay_review_prompt
  stay_post_stay
  stay_new_booking_ops
  stay_request_received
  stay_modified_ops
  stay_verification_failed
  stay_owner_stay_booked
  ops_ical_conflict
  compliance_tm30_escalation
  order_new
  order_accepted
  order_declined
  order_cancelled
  order_failed_no_show
  order_review_prompt
  provider_remittance
  provider_approved
  provider_rejected
  provider_application_reminder
  owner_statement_published
  owner_payout_recorded
  owner_unit_live
  finance_refund_failed
  stay_damage_claim
  message_new
  ticket_status_changed
  ticket_assigned
  ticket_sla_escalation
  announcement_published
  review_reply
  lead_received
}
```

### enum NotificationDeliveryStatus

```prisma
enum NotificationDeliveryStatus {
  pending
  sent
  failed
  read
}
```

### enum ThreadContextType

```prisma
enum ThreadContextType {
  booking
  service_order
  ticket
  unit
  general
  statement
}
```

### enum MessageKind

```prisma
enum MessageKind {
  user
  system
}
```

### enum TicketPriority

```prisma
enum TicketPriority {
  low
  normal
  high
  urgent
}
```

### enum TicketStatus

```prisma
enum TicketStatus {
  open
  acknowledged
  in_progress
  waiting_reporter
  resolved
  closed
  cancelled
}
```

### enum TicketEventType

```prisma
enum TicketEventType {
  status_change
  assignment
  comment_added
  sla_escalation
}
```

### enum AnnouncementAudience

```prisma
enum AnnouncementAudience {
  everyone
  owners
  residents
  guests_in_stay
  staff
}
```

### enum AnnouncementPostedAs

```prisma
enum AnnouncementPostedAs {
  myuno
  management_company
  juristic_person
}
```

### enum AnnouncementStatus

```prisma
enum AnnouncementStatus {
  draft
  published
  unpublished
}
```

### enum ProviderStatus

```prisma
enum ProviderStatus {
  applied
  vetting
  active
  suspended
  offboarded
}
```

### enum ServiceStatus

```prisma
enum ServiceStatus {
  draft
  active
  paused
}
```

### enum PriceModel

```prisma
enum PriceModel {
  fixed
  per_hour
  per_person
  quote
}
```

### enum FulfilmentMode

```prisma
enum FulfilmentMode {
  referred
  operated
}
```

### enum ServiceOrderStatus

```prisma
enum ServiceOrderStatus {
  placed
  paid
  accepted
  declined
  expired
  fulfilled
  cancelled
  failed
  closed
}
```

### enum ReviewTargetType

```prisma
enum ReviewTargetType {
  stay
  service_order
  /// A review *of* the guest, written after their stay. `target_id` is the
  /// booking, not the identity — see the 20260818000018 migration for why.
  guest
}
```

### enum Tm30FilingStatus

```prisma
enum Tm30FilingStatus {
  pending
  filed
  failed
  escalated
  not_required
}
```

### enum ConditionReportType

```prisma
enum ConditionReportType {
  baseline
  check_in
  check_out
  incident
}
```

### enum ComplianceRecordType

```prisma
enum ComplianceRecordType {
  permitted_use
  insurance
  license
  title_audit
  other
}
```

### enum ComplianceRecordStatus

```prisma
enum ComplianceRecordStatus {
  pending
  confirmed
  expired
  failed
}
```

### enum MobilizationChecklistItemStep

```prisma
enum MobilizationChecklistItemStep {
  qualify
  mandate
  legal_audit
  condition_survey
  standards_uplift
  pricing_setup
  golive_checklist
}
```

### enum MobilizationChecklistItemStatus

```prisma
enum MobilizationChecklistItemStatus {
  pending
  done
  blocked
  skipped
}
```

### enum AnalyticsEventKey

```prisma
enum AnalyticsEventKey {
  intent_selected
  search_submitted
  search_completed
  search_failed
  search_zero_results
  result_opened
  project_opened
  unit_opened
  service_opened
  owner_goal_selected
  lead_started
  login_started
  login_success
  quote_succeeded
  quote_failed
  page_landing_viewed
  page_project_viewed
  page_unit_viewed
  page_audience_viewed
  search_performed
  search_no_results
  stay_booking_started
  stay_booking_requested
  stay_request_approved
  stay_request_declined
  stay_payment_succeeded
  stay_payment_failed
  stay_hold_expired
  stay_confirmed
  stay_modified
  stay_cancelled
  stay_checked_in
  stay_checked_out
  stay_completed
  stay_no_show
  stay_extension_requested
  service_catalog_viewed
  service_service_viewed
  service_order_placed
  service_order_paid
  service_order_accepted
  service_order_declined
  service_order_fulfilled
  service_order_cancelled
  service_order_no_show
  review_submitted
  message_thread_started
  ticket_raised
  ticket_resolved
  ticket_sla_breached
  announcement_published
  announcement_read
  owner_statement_viewed
  owner_payout_recorded
  owner_sell_interest
  lead_submitted
  signal_detected
  signal_reviewed
  signal_handed_to_capital
  signal_dismissed
  auth_registered
  auth_claimed
  notify_delivered
  notify_failed
  service_order_closed
}
```

### enum BuyerSignalKey

```prisma
enum BuyerSignalKey {
  repeat_stay
  long_stay
  purchase_question
  listing_engagement
  direct_inquiry
}
```

### enum BuyerSignalStatus

```prisma
enum BuyerSignalStatus {
  open
  reviewed
  handed_to_capital
  dismissed
}
```

### enum IntegrationKey

```prisma
enum IntegrationKey {
  ical_airbnb
  ical_booking
  ical_agoda
  payment_provider
  whatsapp
  telegram
  crm_hubspot
}
```

### enum IntegrationScopeType

```prisma
enum IntegrationScopeType {
  platform
  project
  unit
}
```

### enum IntegrationStatus

```prisma
enum IntegrationStatus {
  active
  error
  disabled
}
```

### enum CrmLifecycleStage

```prisma
enum CrmLifecycleStage {
  contact
  guest
  repeat
  prospect
  investor
  buyer
  owner
  managed
  seller
  former_client
}
```

### enum AssetStatus

```prisma
enum AssetStatus {
  managed
  verified_partner
  one_off_sourced
  suspended
}
```

### enum CrmOpportunityType

```prisma
enum CrmOpportunityType {
  rental
  purchase
  sale
  management
  developer_advisory
  capex
  compliance
}
```

### enum CrmOpportunityStage

```prisma
enum CrmOpportunityStage {
  new
  qualified
  discovery
  proposal
  negotiation
  won
  lost
  nurture
}
```

### enum CrmActivityType

```prisma
enum CrmActivityType {
  note
  task
  call
  meeting
  email
  whatsapp
  telegram
  system
}
```

### enum CrmActivityStatus

```prisma
enum CrmActivityStatus {
  open
  completed
  cancelled
}
```

### enum CrmConsentPurpose

```prisma
enum CrmConsentPurpose {
  service
  marketing
  property_matching
  analytics
}
```

### enum CrmConsentStatus

```prisma
enum CrmConsentStatus {
  granted
  withdrawn
  denied
}
```

### enum CrmTouchType

```prisma
enum CrmTouchType {
  first_touch
  lead_creation
  conversion
  assisted
}
```

### enum KPIStatus

```prisma
enum KPIStatus {
  on_track
  at_risk
  below_target
}
```

### enum IncidentSeverity

```prisma
enum IncidentSeverity {
  low
  medium
  high
  critical
}
```

### enum IncidentStatus

```prisma
enum IncidentStatus {
  open
  acknowledged
  in_progress
  resolved
  closed
}
```

### enum IncidentType

```prisma
enum IncidentType {
  maintenance
  complaint
  violation
}
```

### enum ComplianceChecklistFrequency

```prisma
enum ComplianceChecklistFrequency {
  weekly
  monthly
  quarterly
  annual
}
```

### enum ChannelCategory

```prisma
enum ChannelCategory {
  owned
  earned
  paid
}
```

### enum ProspectingAccountType

```prisma
enum ProspectingAccountType {
  owner
  developer
  institutional_partner
}
```

### enum ProspectingAccountStatus

```prisma
enum ProspectingAccountStatus {
  new
  contacted
  interested
  pitched
  closed
}
```

### enum ManagementFeeBasis

```prisma
enum ManagementFeeBasis {
  percentage_gop
  percentage_noi
  percentage_gross_booking
  fixed
}
```

### enum FeeType

```prisma
enum FeeType {
  management
  performance
  transaction
  distribution
}
```

### enum FeeStatus

```prisma
enum FeeStatus {
  accrued
  invoiced
  paid
}
```

### enum ContractStatus

```prisma
enum ContractStatus {
  active
  pending_signature
  expired
  terminated
}
```

### enum JobRunOutcome

```prisma
enum JobRunOutcome {
  ok
  failed
}
```

### model Identity

```prisma
model Identity {
  salesValidations SalesTariffValidation[]
  salesOffers SalesOffer[]
  salesOfferShares SalesOfferShare[]
  reservationGroupsAsGuest   ReservationGroup[] @relation("reservationGroupGuest")
  reservationGroupsCreated   ReservationGroup[] @relation("reservationGroupCreator")
  preventiveMaintenancePlansAssigned PreventiveMaintenancePlan[] @relation("preventivePlanAssignee")
  operatingSpaceMemberships OperatingSpaceMember[]
  operatingTeamMemberships OperatingTeamMember[]
  teamPermissions ProjectStaffPermission[]
  unitAccessUpdates UnitAccessInstruction[]
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  firstName       String         @map("first_name")
  lastName        String         @map("last_name")
  latinFirstName  String?        @map("latin_first_name")
  latinLastName   String?        @map("latin_last_name")
  email           String?        @unique @db.Citext
  emailVerifiedAt DateTime?      @map("email_verified_at")
  /// Sessions issued before this instant are refused (log out everywhere, password change/reset).
  sessionsValidFrom DateTime?    @map("sessions_valid_from")
  phone           String?        @unique
  phoneVerifiedAt DateTime?      @map("phone_verified_at")
  hashedPassword  String?        @map("hashed_password")
  preferredLocale String         @default("en") @map("preferred_locale")
  avatarMediaId   String?        @map("avatar_media_id")
  status          IdentityStatus @default(active)
  isAdmin         Boolean        @default(false) @map("is_admin")
  notesInternal   String?        @map("notes_internal")
  mergedIntoId    String?        @map("merged_into_id")

  // Relations
  avatarMedia MediaAsset? @relation(name: "identityAvatar", fields: [avatarMediaId], references: [id])
  mergedInto  Identity?   @relation(name: "identityMerge", fields: [mergedIntoId], references: [id])
  mergedFrom  Identity[]  @relation(name: "identityMerge")

  authAccounts                  AuthAccount[]
  oneTimeTokens                 OneTimeToken[]
  ownedUnits                    Unit[]                        @relation("unitOwner")
  ownershipPeriods              OwnershipPeriod[]             @relation("ownershipPeriodOwner")
  savedUnits                    SavedUnit[]
  savedSearches                 SavedSearch[]
  ownershipPeriodsRecorded      OwnershipPeriod[]             @relation("ownershipPeriodRecorder")
  roleAssignments               RoleAssignment[]              @relation("roleAssignmentIdentity")
  grantedRoles                  RoleAssignment[]              @relation("grantedRoles")
  mediaAssets                   MediaAsset[]                  @relation("uploadedBy")
  auditLogs                     AuditLog[]                    @relation("actor")
  contentKeyUpdates             Translation[]                 @relation("updatedBy")
  configChanges                 ConfigChange[]                @relation("changedBy")
  unitEngagements               UnitEngagement[]              @relation("engagementOwner")
  createdBlockedDates           BlockedDate[]                 @relation("blockedDateCreator")
  bookingsAsGuest               Booking[]                     @relation("bookingGuest")
  bookingsCancelled             Booking[]                     @relation("bookingCancelledBy")
  bookingGuestsAs               BookingGuest[]
  bookingChanges                BookingChange[]
  paymentsPayer                 Payment[]                     @relation("paymentPayer")
  paymentsReceivedBy            Payment[]                     @relation("paymentReceivedBy")
  refundsPaidBy                 Refund[]                      @relation("refundPaidBy")
  refundsInitiatedBy            Refund[]                      @relation("refundInitiatedBy")
  ledgerEntriesCreated          LedgerEntry[]                 @relation("ledgerEntryCreator")
  expenseReceiptsUploaded       ExpenseReceipt[]              @relation("expenseReceiptUploader")
  disputesDecided               Dispute[]                     @relation("disputeDecidedBy")
  notifications                 Notification[]
  notificationPreferences       NotificationPreference[]
  threadParticipants            ThreadParticipant[]
  sentMessages                  Message[]
  ticketsRaised                 Ticket[]                      @relation("ticketRaisedBy")
  ticketsAssigned               Ticket[]                      @relation("ticketAssignee")
  ticketEvents                  TicketEvent[]
  serviceOrdersPlaced           ServiceOrder[]                @relation("serviceOrderOrderer")
  amenityReservations           ProjectAmenityReservation[]
  serviceOrdersCancelled        ServiceOrder[]                @relation("serviceOrderCancelledBy")
  serviceOrdersClosed           ServiceOrder[]                @relation("serviceOrderClosedBy")
  serviceQuoteRequests          ServiceQuoteRequest[]         @relation("serviceQuoteRequestOrderer")
  bookingReschedulesRequested   BookingReschedule[]           @relation("bookingRescheduleRequestedBy")
  projectOnboardingDraftsSaved  ProjectOnboardingDraft[]      @relation("projectOnboardingDraftUpdatedBy")
  reviewsWritten                Review[]
  reviewsReplied                Review[]                      @relation("reviewRepliedBy")
  announcementsCreated          Announcement[]
  announcementReads             AnnouncementRead[]
  vettedProviders               Provider[]                    @relation("providerVettedBy")
  servicesApproved              Service[]                     @relation("serviceApprovedBy")
  providerApplications          Provider[]                    @relation("providerApplicant")
  tm30FilingsFiled              Tm30Filing[]                  @relation("tm30FilingFiled")
  conditionReportsCreated       ConditionReport[]
  complianceRecordsVerified     ComplianceRecord[]            @relation("complianceVerifier")
  mobilizationCompletions       MobilizationChecklistItem[]   @relation("mobilizationCompletedBy")
  statementsOwned               OwnerStatement[]              @relation("statementOwner")
  statementsPublished           OwnerStatement[]              @relation("statementPublishedBy")
  payoutsRecorded               Payout[]
  depositClaimsFiled            DepositClaim[]                @relation("depositClaimFiled")
  analyticsEventsAsIdentity     AnalyticsEvent[]              @relation("analyticsEventIdentity")
  analyticsEventsAsActor        AnalyticsEvent[]              @relation("analyticsEventActor")
  buyerSignals                  BuyerSignal[]
  buyerSignalsReviewed          BuyerSignal[]                 @relation("buyerSignalReviewer")
  crmProfile                    CrmProfile?
  crmOpportunities              CrmOpportunity[]              @relation("crmOpportunityContact")
  crmOpportunitiesAssigned      CrmOpportunity[]              @relation("crmOpportunityAssignee")
  crmActivities                 CrmActivity[]                 @relation("crmActivityContact")
  crmActivitiesCreated          CrmActivity[]                 @relation("crmActivityCreator")
  crmConsents                   CrmConsent[]
  crmAttributionTouches         CrmAttributionTouch[]
  accountOwnedProfiles          CrmProfile[]                  @relation("accountOwner")
  referredProfiles              CrmProfile[]                  @relation("referrerTo")
  lifecycleApprovalsGiven       LifecycleTransitionLog[]      @relation("lifecycleApprover")
  incidentsReported             IncidentLog[]                 @relation("incidentReportedBy")
  incidentsAssigned             IncidentLog[]                 @relation("incidentAssignedTo")
  complianceChecklistsChecked   ComplianceChecklistInstance[] @relation("complianceChecklistCheckedBy")
  prospectingAccounts           ProspectingAccount[]          @relation("prospectingContact")
  prospectingAccountsAssigned   ProspectingAccount[]          @relation("prospectingAssignee")
  managementContractsOwned      ManagementContract[]          @relation("contractOwner")
  managementContractsSigned     ManagementContract[]          @relation("contractSignatory")
  regulatoryCredentialsVerified RegulatoryCredential[]        @relation("credentialVerifier")

  @@map("identity")
  operationalTasksAssigned OperationalTask[] @relation("operationalTaskAssignee")
}
```

### model AuthAccount

```prisma
model AuthAccount {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  identityId        String       @map("identity_id")
  provider          AuthProvider
  providerAccountId String       @map("provider_account_id")

  identity Identity @relation(fields: [identityId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("auth_account")
}
```

### model OneTimeToken

```prisma
model OneTimeToken {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  identityId String              @map("identity_id")
  purpose    OneTimeTokenPurpose
  tokenHash  String              @map("token_hash")
  expiresAt  DateTime            @map("expires_at")
  consumedAt DateTime?           @map("consumed_at")

  identity Identity @relation(fields: [identityId], references: [id], onDelete: Cascade)

  @@map("one_time_token")
}
```

### model Area

```prisma
model Area {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  /// The URL segment. Browse is half the reason this model exists.
  slug           String     @unique
  nameKey        String     @map("name_key")
  descriptionKey String?    @map("description_key")
  parentId       String?    @map("parent_id")
  status         AreaStatus @default(draft)
  /// Display order among siblings; ties fall back to slug.
  sort           Int        @default(0)

  // Relations
  parent   Area?     @relation(name: "areaParent", fields: [parentId], references: [id], onDelete: SetNull)
  children Area[]    @relation(name: "areaParent")
  projects Project[]

  @@index([parentId])
  @@index([status])
  @@map("area")
}
```

### model Project

```prisma
model Project {
  preventiveMaintenancePlans PreventiveMaintenancePlan[]
  teamPermissions ProjectStaffPermission[]
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  slug           String        @unique
  name           String
  /// Legacy: the project's own label for where it is. Superseded by `areaId` —
  /// two projects in Bang Tao must not be able to name Bang Tao differently.
  /// Read through `resolveAreaLabelKey`, which prefers the area when one is
  /// set. Droppable once every project has an area.
  areaLabelKey   String        @map("area_label_key")
  areaId         String?       @map("area_id")
  descriptionKey String        @map("description_key")
  latitude       Decimal       @db.Decimal(9, 6)
  longitude      Decimal       @db.Decimal(9, 6)
  address        String
  timezone       String        @default("Asia/Bangkok")
  coverMediaId   String?       @map("cover_media_id")
  amenityKeys    String[]      @default([]) @map("amenity_keys")
  handbookKey    String        @map("handbook_key")
  status         ProjectStatus @default(draft)

  // Extended Physical Property & Development Facts
  projectType                String?   @map("project_type")
  hospitalityClassification  String?   @map("hospitality_classification")
  developmentLifecycleStatus String?   @map("development_lifecycle_status")
  operationalStatus          String?   @map("operational_status")
  brand                      String?
  country                    String    @default("TH")
  region                     String?
  city                       String?
  district                   String?
  subdistrict                String?
  postcode                   String?
  constructionStatus         String?   @map("construction_status")
  launchDate                 DateTime? @map("launch_date")
  completionDate             DateTime? @map("completion_date")
  completionYear             Int?      @map("completion_year")
  expectedCompletion         DateTime? @map("expected_completion")
  totalUnits                 Int?      @map("total_units")
  totalBuildings             Int?      @map("total_buildings")
  floors                     Int?
  landAreaSqm                Decimal?  @map("land_area_sqm") @db.Decimal(10, 2)
  commonAreaSqm              Decimal?  @map("common_area_sqm") @db.Decimal(10, 2)
  masterplanMediaId          String?   @map("masterplan_media_id")
  phases                     Json?     @db.JsonB
  facilities                 String[]  @default([])
  hospitalityConfig          Json?     @map("hospitality_config") @db.JsonB

  // Relations
  /// SetNull, never cascade: deleting an area must not delete the projects in
  /// it. An area is a way of describing where a project is, not its owner.
  area                  Area?                     @relation(fields: [areaId], references: [id], onDelete: SetNull)
  coverMedia            MediaAsset?               @relation(name: "projectCover", fields: [coverMediaId], references: [id])
  masterplanMedia       MediaAsset?               @relation(name: "projectMasterplan", fields: [masterplanMediaId], references: [id], onDelete: SetNull)
  units                 Unit[]
  structureNodes        ProjectStructureNode[]
  roleAssignments       RoleAssignment[]          @relation("projectScope")
  galleryMedia          ProjectMedia[]
  amenities             ProjectAmenity[]
  nearbyPlaces          ProjectNearbyPlace[]
  organizations         Organization[]
  orgRoles              ProjectOrganizationRole[]
  commercialOfferings   CommercialOffering[]
  regulatoryCredentials RegulatoryCredential[]
  inventoryCategories   InventoryCategory[]
  ratePlans             RatePlan[]
  bookings              Booking[]
  operationalTasks       OperationalTask[]
  ledgerEntries         LedgerEntry[]
  threads               Thread[]
  tickets               Ticket[]
  announcements         Announcement[]
  providerServiceAreas  ProviderProject[]
  serviceProjects       ServiceProject[]
  serviceOrders         ServiceOrder[]
  analyticsEvents       AnalyticsEvent[]
  metricsDaily          MetricDaily[]
  integrationAccounts   IntegrationAccount[]
  crmOpportunities      CrmOpportunity[]
  managementContracts   ManagementContract[]

  serviceQuoteRequests ServiceQuoteRequest[]
  onboardingDraft      ProjectOnboardingDraft?

  @@index([areaId])
  @@map("project")
}
```

### model Unit

```prisma
model Unit {
  salesValidations SalesTariffValidation[]
  salesOfferOptions SalesOfferOption[]
  /// Stable public marketing title; null retains the legacy description-derived key.
  marketingTitleKey String? @map("marketing_title_key")
  preventiveMaintenancePlans PreventiveMaintenancePlan[]
  operatingSpaces OperatingSpaceUnit[]
  accessInstruction UnitAccessInstruction?
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  projectId               String      @map("project_id")
  inventoryCategoryId     String?     @map("inventory_category_id")
  ownerIdentityId         String?     @map("owner_identity_id")
  name                    String
  unitType                UnitType    @map("unit_type")
  categoryKey             String?     @map("category_key")
  bedrooms                Int
  bathrooms               Int
  maxGuests               Int         @map("max_guests")
  sizeSqm                 Int?        @map("size_sqm")
  floor                   String?
  structureNodeId         String?     @map("structure_node_id")
  addressSupplement       String      @map("address_supplement")
  descriptionKey          String?     @map("description_key")
  amenityKeys             String[]    @default([]) @map("amenity_keys")
  baseNightlyThb          Int         @map("base_nightly_thb")
  minNights               Int         @map("min_nights")
  instantBook             Boolean     @default(true) @map("instant_book")
  cancellationPolicyKey   String?     @map("cancellation_policy_key")
  status                  UnitStatus  @default(draft)
  assetStatus             AssetStatus @default(managed) @map("asset_status")
  assetStatusChangedAt    DateTime?   @map("asset_status_changed_at")
  assetStatusReason       String?     @map("asset_status_reason")
  permittedUseConfirmedAt DateTime?   @map("permitted_use_confirmed_at")
  /// Null means the unit has not said — which is not the same as "no".
  petsAllowed             Boolean?    @map("pets_allowed")
  maxPets                 Int?        @map("max_pets")
  coverMediaId            String?     @map("cover_media_id")

  // Extended Physical Unit Facts
  privacyType        String?  @default("entire_place") @map("privacy_type")
  accommodationType  String?  @map("accommodation_type")
  usableAreaSqm      Decimal? @map("usable_area_sqm") @db.Decimal(10, 2)
  grossAreaSqm       Decimal? @map("gross_area_sqm") @db.Decimal(10, 2)
  outdoorAreaSqm     Decimal? @map("outdoor_area_sqm") @db.Decimal(10, 2)
  plotAreaSqm        Decimal? @map("plot_area_sqm") @db.Decimal(10, 2)
  balconyAreaSqm     Decimal? @map("balcony_area_sqm") @db.Decimal(10, 2)
  unitFeatures       String[] @default([]) @map("unit_features")
  accessibilityFacts String[] @default([]) @map("accessibility_facts")
  safetyFacts        String[] @default([]) @map("safety_facts")
  furnishingStatus   String?  @map("furnishing_status")
  views              String[] @default([])
  petFeeThb          Int?     @map("pet_fee_thb")
  petRules           String?  @map("pet_rules")

  // Relations
  project                      Project                       @relation(fields: [projectId], references: [id], onDelete: Cascade)
  inventoryCategory            InventoryCategory?            @relation(fields: [inventoryCategoryId], references: [id], onDelete: SetNull)
  structureNode                ProjectStructureNode?          @relation(fields: [structureNodeId], references: [id], onDelete: Restrict)
  owner                        Identity?                     @relation(name: "unitOwner", fields: [ownerIdentityId], references: [id])
  coverMedia                   MediaAsset?                   @relation(name: "unitCover", fields: [coverMediaId], references: [id])
  media                        UnitMedia[]
  sleepingSpaces               SleepingSpace[]
  commercialOfferings          CommercialOffering[]
  regulatoryCredentials        RegulatoryCredential[]
  ratePlans                    RatePlan[]
  engagements                  UnitEngagement[]
  roleAssignments              RoleAssignment[]              @relation("unitScope")
  blockedDates                 BlockedDate[]
  pricingRules                 PricingRule[]
  bookings                     Booking[]
  operationalTasks             OperationalTask[]
  ledgerEntries                LedgerEntry[]
  tickets                      Ticket[]
  serviceOrders                ServiceOrder[]
  amenityReservations          ProjectAmenityReservation[]
  conditionReports             ConditionReport[]
  complianceRecords            ComplianceRecord[]
  mobilizationChecklist        MobilizationChecklistItem[]
  statements                   OwnerStatement[]
  analyticsEvents              AnalyticsEvent[]
  metricsDaily                 MetricDaily[]
  integrationAccounts          IntegrationAccount[]
  crmOpportunities             CrmOpportunity[]
  propertyDeals                PropertyDeal[]
  operationalKpis              OperationalKpi[]
  incidentLogs                 IncidentLog[]
  complianceChecklistInstances ComplianceChecklistInstance[]
  managementContracts          ManagementContract[]
  ownershipPeriods             OwnershipPeriod[]
  savedBy                      SavedUnit[]

  @@unique([projectId, name])
  @@index([projectId, categoryKey])
  @@index([structureNodeId])
  @@index([assetStatus])
  @@map("unit")
}
```

### model BlockedDate

```prisma
model BlockedDate {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  unitId              String            @map("unit_id")
  startDate           DateTime          @map("start_date") @db.Date
  endDate             DateTime          @map("end_date") @db.Date
  reason              BlockedDateReason
  note                String?
  createdByIdentityId String?           @map("created_by_identity_id")
  externalRef         String?           @map("external_ref")
  propertyDealId      String?           @unique @map("property_deal_id")

  // Relations
  unit      Unit      @relation(fields: [unitId], references: [id], onDelete: Cascade)
  createdBy Identity? @relation(name: "blockedDateCreator", fields: [createdByIdentityId], references: [id], onDelete: SetNull)
  propertyDeal PropertyDeal? @relation(fields: [propertyDealId], references: [id], onDelete: Restrict)

  @@index([unitId, startDate, endDate])
  @@map("blocked_date")
}
```

### model PricingRule

```prisma
model PricingRule {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  unitId            String   @map("unit_id")
  startDate         DateTime @map("start_date") @db.Date
  endDate           DateTime @map("end_date") @db.Date
  nightlyThb        Int      @map("nightly_thb")
  label             String?
  minNightsOverride Int?     @map("min_nights_override")

  // Relations
  unit Unit @relation(fields: [unitId], references: [id], onDelete: Cascade)

  @@index([unitId, startDate, endDate])
  @@map("pricing_rule")
}
```

### model ReservationGroup

```prisma
model ReservationGroup {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  guestIdentityId     String  @map("guest_identity_id")
  createdByIdentityId String? @map("created_by_identity_id")
  operatingSpaceId    String? @map("operating_space_id")
  title               String?
  status              String  @default("active")
  currency            String  @default("THB")
  notes               String?

  guest          Identity        @relation("reservationGroupGuest", fields: [guestIdentityId], references: [id], onDelete: Restrict)
  createdBy      Identity?       @relation("reservationGroupCreator", fields: [createdByIdentityId], references: [id], onDelete: SetNull)
  operatingSpace OperatingSpace? @relation(fields: [operatingSpaceId], references: [id], onDelete: SetNull)
  bookings       Booking[]

  @@index([guestIdentityId, status])
  @@index([operatingSpaceId, status])
  @@map("reservation_group")
}
```

### model Booking

```prisma
model Booking {
  reservationGroupId String? @map("reservation_group_id")
  // Human-readable reference (e.g. UN-84920); generated by the application on create.
  reference          String? @unique
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  unitId                     String             @map("unit_id")
  projectId                  String             @map("project_id")
  guestIdentityId            String             @map("guest_identity_id")
  bookingType                BookingType        @map("booking_type")
  channel                    BookingChannel
  externalRef                String?            @map("external_ref")
  status                     BookingStatus      @default(pending_payment)
  /// Chosen settlement rail. Null preserves legacy holds; actual receipts remain in Payment.
  paymentMethod              PaymentMethod?     @map("payment_method")
  creationKey                String?            @map("creation_key") @db.VarChar(36)
  creationFingerprint        String?            @map("creation_fingerprint") @db.VarChar(64)
  startDate                  DateTime           @map("start_date") @db.Date
  endDate                    DateTime           @map("end_date") @db.Date
  /// Unknown counts are permitted only for reviewed external operating records.
  partyDetailsStatus         BookingPartyDetailsStatus @default(known) @map("party_details_status")
  adults                     Int
  children                   Int
  /// Not counted toward occupancy — an infant needs a cot, not a bed.
  infants                    Int                @default(0)
  /// Recorded against the unit's pet policy, not against its bed count.
  pets                       Int                @default(0)
  priceBreakdown             Json?              @map("price_breakdown") @db.JsonB
  totalThb                   Int                @map("total_thb")
  /// Collection eligibility is independent of source-reported payments and stay status.
  receivableStatus           BookingReceivableStatus @default(collectible) @map("receivable_status")
  balanceDueThb              Int                @default(0) @map("balance_due_thb")
  refundAccruedThb           Int                @default(0) @map("refund_accrued_thb")
  cancellationPolicySnapshot Json?              @map("cancellation_policy_snapshot") @db.JsonB
  holdExpiresAt              DateTime?          @map("hold_expires_at")
  requestExpiresAt           DateTime?          @map("requested_expires_at")
  verificationStatus         VerificationStatus @default(not_required) @map("verification_status")
  checkedInAt                DateTime?          @map("checked_in_at")
  checkedOutAt               DateTime?          @map("checked_out_at")
  cancelledAt                DateTime?          @map("cancelled_at")
  cancelledByIdentityId      String?            @map("cancelled_by_identity_id")
  cancellationReason         String?            @map("cancellation_reason")
  guestNote                  String?            @map("guest_note")
  internalNote               String?            @map("internal_note")

  // Relations
  reservationGroup ReservationGroup? @relation(fields: [reservationGroupId], references: [id], onDelete: SetNull)
  unit             Unit                @relation(fields: [unitId], references: [id], onDelete: Cascade)
  project          Project             @relation(fields: [projectId], references: [id], onDelete: Cascade)
  guestIdentity    Identity            @relation(name: "bookingGuest", fields: [guestIdentityId], references: [id])
  cancelledBy      Identity?           @relation(name: "bookingCancelledBy", fields: [cancelledByIdentityId], references: [id], onDelete: SetNull)
  guests           BookingGuest[]
  changes          BookingChange[]
  payments         Payment[]
  ledgerEntries    LedgerEntry[]
  serviceOrders    ServiceOrder[]
  amenityReservations ProjectAmenityReservation[]
  tm30Filings      Tm30Filing[]
  conditionReports ConditionReport[]
  operationalTasks OperationalTask[]
  depositClaims    DepositClaim[]
  depositPreauth   DepositPreauth?
  analyticsEvents  AnalyticsEvent[]
  statementLines   StatementLineItem[]

  reschedules BookingReschedule[]

  @@unique([externalRef, channel])
  @@unique([guestIdentityId, creationKey])
  @@index([reservationGroupId])
  @@index([unitId, status, startDate, endDate])
  @@index([guestIdentityId])
  @@index([projectId])
  @@index([status])
  @@map("booking")
}
```

### model BookingGuest

```prisma
model BookingGuest {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  bookingId       String  @map("booking_id")
  identityId      String? @map("identity_id")
  // 🔒 fullName, passportNumber, and dateOfBirth hold AES-256-GCM ciphertext
  // (ops/guest-pii seam). nationality stays plaintext: the TM30 obligation
  // filters on it in SQL (doc 02 §3.2 note).
  fullName        String  @map("full_name")
  nationality     String
  passportNumber  String  @map("passport_number")
  dateOfBirth     String? @map("date_of_birth")
  passportMediaId String? @map("passport_media_id")
  isLead          Boolean @default(false)

  // Relations
  booking       Booking     @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  identity      Identity?   @relation(fields: [identityId], references: [id], onDelete: SetNull)
  passportMedia MediaAsset? @relation(fields: [passportMediaId], references: [id], onDelete: SetNull)
  tm30Filing    Tm30Filing?

  @@index([bookingId])
  @@map("booking_guest")
}
```

### model BookingChange

```prisma
model BookingChange {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")

  bookingId       String            @map("booking_id")
  changeType      BookingChangeType @map("change_type")
  oldValue        Json?             @map("old_value") @db.JsonB
  newValue        Json?             @map("new_value") @db.JsonB
  priceDeltaThb   Int               @default(0) @map("price_delta_thb")
  actorIdentityId String            @map("actor_identity_id")

  // Relations
  booking Booking  @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  actor   Identity @relation(fields: [actorIdentityId], references: [id])

  @@index([bookingId])
  @@map("booking_change")
}
```

### model Payment

```prisma
model Payment {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")

  purpose              PaymentPurpose
  bookingId            String?         @map("booking_id")
  serviceOrderId       String?         @map("service_order_id")
  payerIdentityId      String          @map("payer_identity_id")
  method               PaymentMethod
  provider             PaymentProvider
  providerSessionId    String?         @map("provider_session_id")
  amountThb            Int             @map("amount_thb")
  receivedByIdentityId String?         @map("received_by_identity_id")
  receivedAt           DateTime?       @map("received_at")
  receiptRef           String?         @map("receipt_ref")
  receiptMediaId       String?         @map("receipt_media_id")
  status               PaymentStatus   @default(created)
  succeededAt          DateTime?       @map("succeeded_at")
  failureReason        String?         @map("failure_reason")
  reconciliationReason String?         @map("reconciliation_reason")
  checkoutUrlEncrypted String?         @map("checkout_url_encrypted")
  checkoutExpiresAt    DateTime?       @map("checkout_expires_at")

  // Relations
  booking       Booking?      @relation(fields: [bookingId], references: [id], onDelete: SetNull)
  serviceOrder  ServiceOrder? @relation(fields: [serviceOrderId], references: [id], onDelete: SetNull)
  payer         Identity      @relation(name: "paymentPayer", fields: [payerIdentityId], references: [id])
  receivedBy    Identity?     @relation(name: "paymentReceivedBy", fields: [receivedByIdentityId], references: [id])
  receiptMedia  MediaAsset?   @relation(name: "paymentReceipt", fields: [receiptMediaId], references: [id])
  refunds       Refund[]
  ledgerEntries LedgerEntry[]

  bookingReschedules BookingReschedule[]

  @@unique([providerSessionId, provider])
  @@index([bookingId])
  @@index([payerIdentityId])
  @@index([status])
  @@map("payment")
}
```

### model Refund

```prisma
model Refund {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")

  paymentId             String       @map("payment_id")
  method                RefundMethod
  amountThb             Int          @map("amount_thb")
  reason                RefundReason
  status                RefundStatus @default(requested)
  providerRefundId      String?      @map("provider_refund_id")
  // A new/explicitly reconciled booking request may be dispatched once.
  // Null on legacy rows: requested alone never proves no provider attempt.
  dispatchAuthorizedAt  DateTime?    @map("dispatch_authorized_at")
  paidBackByIdentityId  String?      @map("paid_back_by_identity_id")
  initiatedByIdentityId String       @map("initiated_by_identity_id")

  // Relations
  payment       Payment       @relation(fields: [paymentId], references: [id], onDelete: Cascade)
  paidBackBy    Identity?     @relation(name: "refundPaidBy", fields: [paidBackByIdentityId], references: [id])
  initiatedBy   Identity      @relation(name: "refundInitiatedBy", fields: [initiatedByIdentityId], references: [id])
  ledgerEntries LedgerEntry[]
  disputes      Dispute[]

  @@index([paymentId])
  @@index([status])
  @@map("refund")
}
```

### model LedgerEntry

```prisma
model LedgerEntry {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")

  entryType           LedgerEntryType @map("entry_type")
  amountThb           Int             @map("amount_thb")
  unitId              String?         @map("unit_id")
  projectId           String?         @map("project_id")
  bookingId           String?         @map("booking_id")
  serviceOrderId      String?         @map("service_order_id")
  paymentId           String?         @map("payment_id")
  refundId            String?         @map("refund_id")
  statementId         String?         @map("statement_id")
  // One ledger entry per payout, enforced by a unique index: a payout must
  // have exactly one append-only ledger consequence, never two.
  payoutId            String?         @unique @map("payout_id")
  occurredOn          DateTime        @map("occurred_on")
  description         String
  createdByIdentityId String?         @map("created_by_identity_id")

  // Manual cost integrity. A replay key belongs to the person who recorded the
  // cost; the fingerprint is the normalised content it was recorded with, so a
  // retry is recognised as the same cost and a reused key with different
  // content is a conflict, not a second row. Both are set together or not at
  // all (CHECK). Null on every system-written and legacy row.
  manualCostKey         String? @map("manual_cost_key") @db.VarChar(36)
  manualCostFingerprint String? @map("manual_cost_fingerprint") @db.VarChar(64)
  // A reversal points at exactly one original, and an original has at most one
  // reversal (UNIQUE) — two concurrent reversals cannot both land.
  reversesEntryId       String? @unique @map("reverses_entry_id")

  // Relations
  unit      Unit?           @relation(fields: [unitId], references: [id], onDelete: SetNull)
  project   Project?        @relation(fields: [projectId], references: [id], onDelete: SetNull)
  booking   Booking?        @relation(fields: [bookingId], references: [id], onDelete: SetNull)
  payment   Payment?        @relation(fields: [paymentId], references: [id], onDelete: SetNull)
  refund    Refund?         @relation(fields: [refundId], references: [id], onDelete: SetNull)
  statement OwnerStatement? @relation(fields: [statementId], references: [id], onDelete: SetNull)
  createdBy Identity?       @relation(name: "ledgerEntryCreator", fields: [createdByIdentityId], references: [id])
  payout    Payout?         @relation(fields: [payoutId], references: [id], onDelete: Restrict)
  disputes  Dispute[]
  reverses  LedgerEntry?    @relation(name: "ledgerReversal", fields: [reversesEntryId], references: [id], onDelete: Restrict)
  reversal  LedgerEntry?    @relation(name: "ledgerReversal")
  receipts  ExpenseReceipt[]
  statementLines StatementLineItem[]

  @@unique([createdByIdentityId, manualCostKey])
  @@index([unitId, occurredOn])
  @@index([projectId, occurredOn])
  @@index([bookingId])
  @@index([paymentId])
  @@index([refundId])
  @@map("ledger_entry")
}
```

### model ExpenseReceipt

```prisma
model ExpenseReceipt {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")

  ledgerEntryId        String    @map("ledger_entry_id")
  uploadedByIdentityId String    @map("uploaded_by_identity_id")
  uploadKey            String    @map("upload_key") @db.VarChar(36)
  mimeType             String    @map("mime_type")
  sizeBytes            Int       @map("size_bytes")
  sha256               String    @db.VarChar(64)
  ciphertext           String
  supersededAt         DateTime? @map("superseded_at")

  ledgerEntry    LedgerEntry         @relation(fields: [ledgerEntryId], references: [id], onDelete: Restrict)
  uploadedBy     Identity            @relation(name: "expenseReceiptUploader", fields: [uploadedByIdentityId], references: [id])
  statementLines StatementLineItem[]

  @@unique([uploadedByIdentityId, uploadKey])
  @@index([ledgerEntryId])
  @@map("expense_receipt")
}
```

### model OwnerStatement

```prisma
model OwnerStatement {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  unitId                String               @map("unit_id")
  ownerIdentityId       String               @map("owner_identity_id")
  engagementId          String               @map("engagement_id")
  periodStart           DateTime             @map("period_start")
  periodEnd             DateTime             @map("period_end")
  grossRevenueTh        Int                  @map("gross_revenue_thb")
  totalCostsTh          Int                  @map("total_costs_thb")
  noiTh                 Int                  @map("noi_thb")
  ownerShareTh          Int                  @map("owner_share_thb")
  estateShareTh         Int                  @map("estate_share_thb")
  capApplied            Boolean              @default(false) @map("cap_applied")
  status                OwnerStatementStatus @default(draft)
  publishedAt           DateTime?            @map("published_at")
  publishedByIdentityId String?              @map("published_by_identity_id")
  pdfMediaId            String?              @map("pdf_media_id")

  // The transparency block CLAUDE.md requires on every monthly statement:
  // gross bookings, service fees, expenses, adjusted NOI, distributable cash and
  // the performance fee with the basis it was calculated on. Nullable because
  // statements drafted before this existed have none of it.
  grossBookingsAmountTh     Int?      @map("gross_bookings_amount_thb")
  guestPaymentsReceivedTh   Int?      @map("guest_payments_received_thb")
  serviceFeesAmountTh       Int?      @map("service_fees_amount_thb")
  operatingExpensesAmountTh Int?      @map("operating_expenses_amount_thb")
  taxesAmountTh             Int?      @map("taxes_amount_thb")
  adjustedNoiTh             Int?      @map("adjusted_noi_thb")
  distributableCashTh       Int?      @map("distributable_cash_thb")
  performanceFeeAmountTh    Int?      @map("performance_fee_amount_thb")
  performanceFeeBasisText   String?   @map("performance_fee_basis_text")
  signedOffByOwnerAt        DateTime? @map("signed_off_by_owner_at")
  signedOffByOperatorAt     DateTime? @map("signed_off_by_operator_at")
  approvedAt                DateTime? @map("approved_at")

  // The verified snapshot. `sourceFingerprint` hashes every source fact the
  // figures were computed from (stays, guest payments, ledger rows, current
  // receipts, ownership chain); `snapshotHash` hashes the figures and line
  // items as issued. Null on statements generated before these existed.
  sourceFingerprint         String?   @map("source_fingerprint") @db.VarChar(64)
  snapshotHash              String?   @map("snapshot_hash") @db.VarChar(64)

  // Relations
  unit          Unit                @relation(fields: [unitId], references: [id], onDelete: Cascade)
  owner         Identity            @relation(name: "statementOwner", fields: [ownerIdentityId], references: [id])
  engagement    UnitEngagement      @relation(fields: [engagementId], references: [id])
  publishedBy   Identity?           @relation(name: "statementPublishedBy", fields: [publishedByIdentityId], references: [id])
  pdfMedia      MediaAsset?         @relation(name: "statementPdf", fields: [pdfMediaId], references: [id])
  ledgerEntries LedgerEntry[]
  payouts       Payout[]
  lineItems     StatementLineItem[]

  @@index([unitId, periodStart, periodEnd])
  @@index([ownerIdentityId, status])
  @@index([status, publishedAt])
  @@map("owner_statement")
}
```

### model StatementLineItem

```prisma
model StatementLineItem {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  statementId String           @map("statement_id")
  category    LineItemCategory
  description String
  amountTh    Int              @map("amount_thb")

  // What the line traces back to: a booking for revenue and refunds, an uploaded
  // receipt for an expense. Both optional — a performance fee traces to the
  // management contract, which the statement already identifies.
  bookingId            String? @map("booking_id")
  supportingDocumentId String? @map("supporting_document_id")
  // The ledger row an expense line was built from, and the private receipt that
  // was current for it when the statement was generated. A ledger row appears
  // at most once per statement (UNIQUE).
  ledgerEntryId        String? @map("ledger_entry_id")
  expenseReceiptId     String? @map("expense_receipt_id")

  statement      OwnerStatement  @relation(fields: [statementId], references: [id], onDelete: Cascade)
  booking        Booking?        @relation(fields: [bookingId], references: [id], onDelete: SetNull)
  ledgerEntry    LedgerEntry?    @relation(fields: [ledgerEntryId], references: [id], onDelete: Restrict)
  expenseReceipt ExpenseReceipt? @relation(fields: [expenseReceiptId], references: [id], onDelete: Restrict)

  @@unique([statementId, ledgerEntryId])
  @@index([ledgerEntryId])
  @@index([expenseReceiptId])
  @@index([statementId, category])
  @@index([bookingId])
  @@map("statement_line_item")
}
```

### model Payout

```prisma
model Payout {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")

  payeeType            PayoutPayeeType @map("payee_type")
  ownerStatementId     String?         @map("owner_statement_id")
  providerId           String?         @map("provider_id")
  periodStart          DateTime?       @map("period_start")
  periodEnd            DateTime?       @map("period_end")
  amountThb            Int             @map("amount_thb")
  method               PayoutMethod
  reference            String
  executedOn           DateTime        @map("executed_on") @db.Date
  recordedByIdentityId String          @map("recorded_by_identity_id")
  status               PayoutStatus    @default(recorded)

  // Relations
  ownerStatement OwnerStatement? @relation(fields: [ownerStatementId], references: [id], onDelete: SetNull)
  provider       Provider?       @relation(fields: [providerId], references: [id], onDelete: SetNull)
  recordedBy     Identity        @relation(fields: [recordedByIdentityId], references: [id])
  ledgerEntry    LedgerEntry?

  @@index([payeeType, status])
  @@index([ownerStatementId])
  @@index([providerId, periodStart, periodEnd])
  @@index([executedOn])
  @@map("payout")
}
```

### model DepositClaim

```prisma
model DepositClaim {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  bookingId          String             @map("booking_id")
  claimantIdentityId String             @map("claimant_identity_id")
  description        String
  claimedAmountThb   Int                @map("claimed_amount_thb")
  status             DepositClaimStatus @default(filed)
  evidenceMediaIds   String[]           @default([]) @map("evidence_media_ids")
  filedAt            DateTime           @map("filed_at")
  resolutionAt       DateTime?          @map("resolution_at")
  resolutionNote     String?

  // Relations
  booking           Booking         @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  claimant          Identity        @relation(name: "depositClaimFiled", fields: [claimantIdentityId], references: [id])
  evidenceMedia     MediaAsset[]    @relation(name: "claimEvidence")
  depositPreauthCap DepositPreauth? @relation("depositClaimCapture")

  @@index([bookingId, status])
  @@index([claimantIdentityId, filedAt])
  @@map("deposit_claim")
}
```

### model DepositPreauth

```prisma
model DepositPreauth {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  bookingId         String               @map("booking_id")
  amountThb         Int                  @map("amount_thb")
  providerSessionId String?              @map("provider_session_id")
  status            DepositPreauthStatus @default(authorized)
  authorizedAt      DateTime             @map("authorized_at")
  voidedAt          DateTime?            @map("voided_at")
  capturedAt        DateTime?            @map("captured_at")
  captureViaClaimId String?              @unique @map("capture_via_claim_id")

  // Relations
  booking      Booking       @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  captureClaim DepositClaim? @relation(name: "depositClaimCapture", fields: [captureViaClaimId], references: [id], onDelete: SetNull)

  @@unique([bookingId])
  @@index([status, authorizedAt])
  @@map("deposit_preauth")
}
```

### model UnitEngagement

```prisma
model UnitEngagement {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  unitId          String               @map("unit_id")
  engagementType  UnitEngagementType   @map("engagement_type")
  ownerIdentityId String               @map("owner_identity_id")
  managementOrgId String?              @map("management_org_id")
  noiCapAnnualThb Int?                 @map("noi_cap_annual_thb")
  feeOverridePct  Decimal?             @map("fee_override_pct") @db.Decimal(5, 2)
  setupFeeThb     Int?                 @map("setup_fee_thb")
  mandateMediaId  String?              @map("mandate_media_id")
  startsOn        DateTime?            @map("starts_on")
  endsOn          DateTime?            @map("ends_on")
  status          UnitEngagementStatus @default(draft)

  // Relations
  unit          Unit             @relation(fields: [unitId], references: [id], onDelete: Cascade)
  owner         Identity         @relation(name: "engagementOwner", fields: [ownerIdentityId], references: [id])
  managementOrg Organization?    @relation(fields: [managementOrgId], references: [id])
  mandateMedia  MediaAsset?      @relation(name: "engagementMandate", fields: [mandateMediaId], references: [id])
  statements    OwnerStatement[]

  @@index([unitId, status])
  @@map("unit_engagement")
}
```

### model Organization

```prisma
model Organization {
  serviceSupportTickets Ticket[] @relation("serviceSupportOrganization")
  operatingSpaces OperatingSpace[]
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  name         String
  orgType      OrganizationType   @map("org_type")
  projectId    String?            @map("project_id")
  contactEmail String             @map("contact_email")
  contactPhone String             @map("contact_phone")
  status       OrganizationStatus @default(active)

  // Canonical Developer / Organization Facts
  legalName             String? @map("legal_name")
  tradingName           String? @map("trading_name")
  logoMediaId           String? @map("logo_media_id")
  website               String?
  hqCountry             String? @map("hq_country")
  officeAddress         String? @map("office_address")
  registrationNumber    String? @map("registration_number")
  taxIdentifier         String? @map("tax_identifier")
  yearEstablished       Int?    @map("year_established")
  profileKey            String? @map("profile_key")
  parentOrganizationId  String? @map("parent_organization_id")
  listedExchange        String? @map("listed_exchange")
  developerTrackRecord  Json?   @map("developer_track_record") @db.JsonB
  developerVerification String? @default("unverified") @map("developer_verification")

  // Relations
  project               Project?                  @relation(fields: [projectId], references: [id], onDelete: SetNull)
  logoMedia             MediaAsset?               @relation(name: "orgLogo", fields: [logoMediaId], references: [id], onDelete: SetNull)
  parentOrg             Organization?             @relation(name: "orgParent", fields: [parentOrganizationId], references: [id], onDelete: SetNull)
  childOrgs             Organization[]            @relation(name: "orgParent")
  projectRoles          ProjectOrganizationRole[]
  regulatoryCredentials RegulatoryCredential[]
  engagements           UnitEngagement[]
  roleAssignments       RoleAssignment[]
  announcements         Announcement[]

  @@map("organization")
}
```

### model Provider

```prisma
model Provider {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  name                  String
  description           String?
  contactEmail          String         @map("contact_email")
  contactPhone          String         @map("contact_phone")
  categoryKeys          String[]       @default([]) @map("category_keys")
  status                ProviderStatus @default(applied)
  vetted_at             DateTime?      @map("vetted_at")
  vetted_by_identity_id String?        @map("vetted_by_identity_id")
  // The identity that submitted the application — receives the
  // provider_member role and the N-18/N-19 vetting outcome (F-PROV-1).
  applicant_identity_id String?        @map("applicant_identity_id")
  payoutMethod          Json?          @map("payout_method") @db.JsonB
  logoMediaId           String?        @map("logo_media_id")

  // Relations
  vetted_by       Identity?         @relation("providerVettedBy", fields: [vetted_by_identity_id], references: [id], onDelete: SetNull)
  applicant       Identity?         @relation("providerApplicant", fields: [applicant_identity_id], references: [id], onDelete: SetNull)
  logoMedia       MediaAsset?       @relation("providerLogo", fields: [logoMediaId], references: [id], onDelete: SetNull)
  roleAssignments RoleAssignment[]
  services        Service[]
  serviceAreas    ProviderProject[]
  serviceOrders   ServiceOrder[]
  payouts         Payout[]

  quoteVersions ServiceQuoteVersion[]

  @@index([status, vetted_at])
  @@map("provider")
}
```

### model ProviderProject

```prisma
model ProviderProject {
  provider_id String @map("provider_id")
  project_id  String @map("project_id")

  provider Provider @relation(fields: [provider_id], references: [id], onDelete: Cascade)
  project  Project  @relation(fields: [project_id], references: [id], onDelete: Cascade)

  @@id([provider_id, project_id])
  @@map("provider_project")
}
```

### model Service

```prisma
model Service {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  provider_id        String         @map("provider_id")
  categoryKey        String         @map("category_key")
  title              String
  description        String?
  titleRu            String?        @map("title_ru")
  titleEn            String?        @map("title_en")
  titleTh            String?        @map("title_th")
  descriptionRu      String?        @map("description_ru")
  descriptionEn      String?        @map("description_en")
  descriptionTh      String?        @map("description_th")
  priceModel         PriceModel     @map("price_model")
  basePriceThb       Int?           @map("base_price_thb")
  durationMin        Int?           @map("duration_min")
  fulfilmentMode     FulfilmentMode @default(referred) @map("fulfilment_mode")
  advanceNoticeHours Int            @default(0) @map("advance_notice_hours")
  status             ServiceStatus  @default(draft)
  coverMediaId       String?        @map("cover_media_id")

  // Who approved this service and when. Mirrors Provider.vetted_at /
  // vetted_by_identity_id: approval is a gate an admin passes a service through,
  // so it needs the same audit trail (CLAUDE.md, "Audit Logging"). Cleared on
  // rejection so a resubmitted service is not left carrying a stale approval.
  approved_at             DateTime? @map("approved_at")
  approved_by_identity_id String?   @map("approved_by_identity_id")

  // Relations
  provider          Provider         @relation(fields: [provider_id], references: [id], onDelete: Cascade)
  approved_by       Identity?        @relation("serviceApprovedBy", fields: [approved_by_identity_id], references: [id], onDelete: SetNull)
  coverMedia        MediaAsset?      @relation("serviceCover", fields: [coverMediaId], references: [id], onDelete: SetNull)
  media             ServiceMedia[]   @relation("serviceMediaList")
  availableProjects ServiceProject[]
  serviceOrders     ServiceOrder[]

  quoteRequests ServiceQuoteRequest[]

  @@index([provider_id, status])
  @@index([categoryKey])
  @@index([status, approved_at])
  @@map("service")
}
```

### model ServiceMedia

```prisma
model ServiceMedia {
  service_id String @map("service_id")
  media_id   String @map("media_id")
  position   Int    @default(0)

  service Service    @relation("serviceMediaList", fields: [service_id], references: [id], onDelete: Cascade)
  media   MediaAsset @relation("serviceImage", fields: [media_id], references: [id], onDelete: Cascade)

  @@id([service_id, media_id])
  @@map("service_media")
}
```

### model ServiceProject

```prisma
model ServiceProject {
  service_id String @map("service_id")
  project_id String @map("project_id")

  // Per-project commercial overrides, added by the canonical v3 commerce
  // federation migration. In the database today; not yet read by any code.
  enabled             Boolean   @default(true)
  public              Boolean   @default(true)
  price_override_thb  Int?      @map("price_override_thb")
  cost_thb            Int?      @map("cost_thb")
  take_rate_pct       Decimal?  @map("take_rate_pct") @db.Decimal(5, 2)
  collector           String    @default("platform")
  fulfillment_owner   String    @default("provider") @map("fulfillment_owner")
  complaint_owner     String    @default("platform") @map("complaint_owner")
  lead_time_hours     Int?      @map("lead_time_hours")
  sla_minutes         Int?      @map("sla_minutes")
  inclusions          Json      @default("[]") @db.JsonB
  cancellation_policy Json      @default("{}") @map("cancellation_policy") @db.JsonB
  terms_version       Int       @default(1) @map("terms_version")
  effective_from      DateTime? @map("effective_from") @db.Timestamptz(6)
  effective_to        DateTime? @map("effective_to") @db.Timestamptz(6)
  updated_at          DateTime  @default(now()) @map("updated_at") @db.Timestamptz(6)

  service Service @relation(fields: [service_id], references: [id], onDelete: Cascade)
  project Project @relation(fields: [project_id], references: [id], onDelete: Cascade)

  @@id([service_id, project_id])
  @@map("service_project")
}
```

### model ServiceOrder

```prisma
model ServiceOrder {
  request_key String? @map("request_key") @db.VarChar(36)
  request_fingerprint String? @map("request_fingerprint") @db.VarChar(64)
  supportTickets Ticket[]
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // What and where
  service_id  String  @map("service_id")
  provider_id String  @map("provider_id")
  // Nullable since the canonical v3 commerce migration: an order need not
  // belong to a project (SERVICES_MARKETPLACE.md §7 standalone commerce).
  project_id  String? @map("project_id")
  unit_id     String? @map("unit_id")
  booking_id  String? @map("booking_id")

  // Who ordered
  orderer_identity_id String   @map("orderer_identity_id")
  orderer_role        RoleType @map("orderer_role")

  // Slot and quantity
  scheduled_start DateTime @map("scheduled_start")
  scheduled_end   DateTime @map("scheduled_end")
  quantity        Int      @default(1)

  // Pricing
  price_breakdown        Json    @map("price_breakdown") @db.JsonB
  total_thb              Int     @map("total_thb")
  take_rate_pct_snapshot Decimal @map("take_rate_pct_snapshot")

  // Status and lifecycle
  status                   ServiceOrderStatus @default(placed)
  cancelled_at             DateTime?          @map("cancelled_at")
  cancelled_by_identity_id String?            @map("cancelled_by_identity_id")
  cancellation_reason      String?            @map("cancellation_reason")
  expired_at               DateTime?          @map("expired_at")
  fulfilled_at             DateTime?          @map("fulfilled_at")
  closed_at                DateTime?          @map("closed_at")
  closed_by_identity_id    String?            @map("closed_by_identity_id")
  refund_accrued_thb       Int                @default(0) @map("refund_accrued_thb")

  // Canonical v3 order context. Present in the database since the commerce
  // federation migration; no application code reads these yet.
  service_context     Json    @default("{}") @map("service_context") @db.JsonB
  quantity_dimensions Json    @default("{}") @map("quantity_dimensions") @db.JsonB
  terms_snapshot      Json    @default("{}") @map("terms_snapshot") @db.JsonB
  quote_version_id    String? @map("quote_version_id")

  // Notes
  note_to_provider String? @map("note_to_provider")
  address_note     String? @map("address_note")

  // Relations
  service         Service              @relation(fields: [service_id], references: [id], onDelete: Cascade)
  provider        Provider             @relation(fields: [provider_id], references: [id], onDelete: Cascade)
  project         Project?             @relation(fields: [project_id], references: [id], onDelete: SetNull)
  unit            Unit?                @relation(fields: [unit_id], references: [id], onDelete: SetNull)
  booking         Booking?             @relation(fields: [booking_id], references: [id], onDelete: SetNull)
  orderer         Identity             @relation(name: "serviceOrderOrderer", fields: [orderer_identity_id], references: [id], onDelete: Cascade)
  cancelledBy     Identity?            @relation(name: "serviceOrderCancelledBy", fields: [cancelled_by_identity_id], references: [id])
  closedBy        Identity?            @relation(name: "serviceOrderClosedBy", fields: [closed_by_identity_id], references: [id], onDelete: SetNull)
  quoteVersion    ServiceQuoteVersion? @relation(fields: [quote_version_id], references: [id], onDelete: SetNull)
  payments        Payment[]
  analyticsEvents AnalyticsEvent[]

  @@index([project_id, status, createdAt])
  @@index([provider_id, status])
  @@index([orderer_identity_id, createdAt])
  @@unique([orderer_identity_id, request_key])
  dispatch ServiceOrderDispatch?

  @@map("service_order")
}
```

### model Review

```prisma
model Review {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  target_type        ReviewTargetType @map("target_type")
  target_id          String           @map("target_id")
  author_identity_id String           @map("author_identity_id")

  rating  Int // 1-5
  comment String?

  reply               String?
  replied_at          DateTime? @map("replied_at")
  replier_identity_id String?   @map("replier_identity_id")

  status String @default("published") // "published" or "hidden"

  // Relations — polymorphic pattern (target_type determines what target_id references)
  author  Identity  @relation(fields: [author_identity_id], references: [id], onDelete: Cascade)
  replier Identity? @relation(name: "reviewRepliedBy", fields: [replier_identity_id], references: [id], onDelete: SetNull)

  @@unique([target_type, target_id, author_identity_id])
  @@index([target_type, target_id])
  @@index([author_identity_id])
  @@map("review")
}
```

### model RoleAssignment

```prisma
model RoleAssignment {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  identityId          String        @map("identity_id")
  role                RoleType
  scopeType           RoleScopeType @map("scope_type")
  projectId           String?       @map("project_id")
  unitId              String?       @map("unit_id")
  organizationId      String?       @map("organization_id")
  providerId          String?       @map("provider_id")
  status              RoleStatus    @default(active)
  grantedByIdentityId String?       @map("granted_by_identity_id")
  canDelegate         Boolean       @default(false) @map("can_delegate")
  parentGrantId       String?       @map("parent_grant_id")
  expiresAt           DateTime?     @map("expires_at")

  // Relations
  identity     Identity      @relation(name: "roleAssignmentIdentity", fields: [identityId], references: [id], onDelete: Cascade)
  project      Project?      @relation(name: "projectScope", fields: [projectId], references: [id], onDelete: Cascade)
  unit         Unit?         @relation(name: "unitScope", fields: [unitId], references: [id], onDelete: Cascade)
  organization Organization? @relation(fields: [organizationId], references: [id], onDelete: SetNull)
  provider     Provider?     @relation(fields: [providerId], references: [id], onDelete: Cascade)
  grantedBy    Identity?     @relation(name: "grantedRoles", fields: [grantedByIdentityId], references: [id])

  parentGrant RoleAssignment?  @relation("PropertyCapabilityDelegation", fields: [parentGrantId], references: [id], onDelete: Cascade, onUpdate: NoAction, map: "role_assignment_parent_grant_fk")
  delegatedGrants RoleAssignment[] @relation("PropertyCapabilityDelegation")

  @@index([parentGrantId])
  @@index([identityId, status])
  @@map("role_assignment")
}
```

### model MediaAsset

```prisma
model MediaAsset {
  operationalTaskMedia OperationalTaskMedia[]
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  storageKey           String         @unique @map("storage_key")
  kind                 MediaAssetKind
  mimeType             String         @map("mime_type")
  sizeBytes            Int            @map("size_bytes")
  uploadedByIdentityId String         @map("uploaded_by_identity_id")
  encrypted            Boolean        @default(false)
  deleteAfter          DateTime?      @map("delete_after")

  // Relations
  uploadedBy               Identity               @relation(name: "uploadedBy", fields: [uploadedByIdentityId], references: [id])
  identityAvatars          Identity[]             @relation("identityAvatar")
  projectCovers            Project[]              @relation("projectCover")
  categoryCovers           InventoryCategory[]    @relation("categoryCover")
  categoryMedia            InventoryCategoryMedia[]
  unitCovers               Unit[]                 @relation("unitCover")
  unitMedia                UnitMedia[]
  projectMedia             ProjectMedia[]
  amenityCovers            ProjectAmenity[]      @relation("projectAmenityCover")
  amenityMedia             ProjectAmenityMedia[]
  engagementMandates       UnitEngagement[]       @relation("engagementMandate")
  bookingGuestPassports    BookingGuest[]
  paymentReceipts          Payment[]              @relation("paymentReceipt")
  ticketMedias             TicketMedia[]
  providerLogos            Provider[]             @relation("providerLogo")
  serviceCoverMedia        Service[]              @relation("serviceCover")
  serviceMedia             ServiceMedia[]         @relation("serviceImage")
  tm30Receipts             Tm30Filing[]           @relation("tm30Receipt")
  conditionReportPhotos    ConditionReportMedia[] @relation("conditionReportPhoto")
  complianceRecordDocs     ComplianceRecord[]     @relation("complianceRecordDoc")
  statementPdfs            OwnerStatement[]       @relation("statementPdf")
  claimEvidence            DepositClaim[]         @relation("claimEvidence")
  orgLogos                 Organization[]         @relation("orgLogo")
  projectMasterplans       Project[]              @relation("projectMasterplan")
  regulatoryCredentialDocs RegulatoryCredential[] @relation("regulatoryDoc")
  dealContracts PropertyDeal[] @relation("propertyDealContract")
  dealCompletionEvidence PropertyDeal[] @relation("propertyDealCompletion")

  @@index([deleteAfter])
  @@map("media_asset")
}
```

### model AuditLog

```prisma
model AuditLog {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")

  actorIdentityId String?  @map("actor_identity_id")
  action          String
  entityType      String   @map("entity_type")
  entityId        String   @map("entity_id")
  data            Json?    @db.JsonB
  at              DateTime @default(now())

  // Relations
  actor Identity? @relation(name: "actor", fields: [actorIdentityId], references: [id], onDelete: SetNull)

  @@index([entityType, entityId])
  @@index([actorIdentityId])
  @@map("audit_log")
}
```

### model UnitMedia

```prisma
model UnitMedia {
  unitId  String @map("unit_id")
  mediaId String @map("media_id")
  sort    Int    @default(0)

  unit  Unit       @relation(fields: [unitId], references: [id], onDelete: Cascade)
  media MediaAsset @relation(fields: [mediaId], references: [id], onDelete: Cascade)

  @@id([unitId, mediaId])
  @@map("unit_media")
}
```

### model InventoryCategoryMedia

```prisma
model InventoryCategoryMedia {
  categoryId String @map("category_id")
  mediaId String @map("media_id")
  sort Int @default(0)
  category InventoryCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  media MediaAsset @relation(fields: [mediaId], references: [id], onDelete: Cascade)

  @@id([categoryId, mediaId])
  @@index([categoryId, sort], map: "inventory_category_media_sort_idx")
  @@map("inventory_category_media")
}
```

### model ProjectMedia

```prisma
model ProjectMedia {
  projectId String @map("project_id")
  mediaId   String @map("media_id")
  sort      Int    @default(0)

  project Project    @relation(fields: [projectId], references: [id], onDelete: Cascade)
  media   MediaAsset @relation(fields: [mediaId], references: [id], onDelete: Cascade)

  @@id([projectId, mediaId])
  @@map("project_media")
}
```

### model ProjectNearbyPlace

```prisma
model ProjectNearbyPlace {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  projectId        String   @map("project_id")
  slug             String
  name             String
  categoryKey      String   @default("other") @map("category_key")
  shortDescription String?  @map("short_description")
  address          String?
  latitude         Decimal? @db.Decimal(9, 6)
  longitude        Decimal? @db.Decimal(9, 6)
  /// Manual fallback used only when a coordinate-derived distance is unavailable.
  distanceMeters   Int?     @map("distance_meters")
  walkingMinutes   Int?     @map("walking_minutes")
  drivingMinutes   Int?     @map("driving_minutes")
  externalUrl      String?  @map("external_url")
  isFeatured       Boolean  @default(false) @map("is_featured")
  published        Boolean  @default(false)
  sort             Int      @default(0)

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, slug])
  @@index([projectId, published, sort])
  @@map("project_nearby_place")
}
```

### model ProjectAmenity

```prisma
model ProjectAmenity {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  projectId        String   @map("project_id")
  slug             String
  name             String
  categoryKey      String?  @map("category_key")
  shortDescription String?  @map("short_description")
  description      String?
  iconKey          String?  @map("icon_key")
  locationLabel    String?  @map("location_label")
  coverMediaId     String?  @map("cover_media_id")

  // Guest access / use. Strings are intentionally open vocabularies: projects
  // can add novel access or booking modes without a database migration.
  accessType         String  @default("open") @map("access_type")
  accessInstructions String? @map("access_instructions")
  bookingRequired    Boolean @default(false) @map("booking_required")
  bookingMode        String  @default("none") @map("booking_mode")
  bookingUrl         String? @map("booking_url")
  reservationConfig  Json?   @map("reservation_config") @db.JsonB

  // Commercial/use policy. Monetary values are integer satang, matching the
  // rest of myUNO money storage.
  pricingType String  @default("included") @map("pricing_type")
  priceThb    Int?    @map("price_thb")
  capacity    Int?
  minAge      Int?    @map("min_age")

  // Flexible structured schedules/rules while keeping common fields queryable.
  openingHours Json?  @map("opening_hours") @db.JsonB
  rules        Json?  @db.JsonB
  terms        String?

  isFeatured Boolean @default(false) @map("is_featured")
  published  Boolean @default(false)
  sort       Int     @default(0)

  project    Project    @relation(fields: [projectId], references: [id], onDelete: Cascade)
  coverMedia MediaAsset? @relation("projectAmenityCover", fields: [coverMediaId], references: [id], onDelete: SetNull)
  media        ProjectAmenityMedia[]
  reservations ProjectAmenityReservation[]

  @@unique([projectId, slug])
  @@index([projectId, published, sort])
  @@index([projectId, categoryKey])
  @@map("project_amenity")
}
```

### model ProjectAmenityMedia

```prisma
model ProjectAmenityMedia {
  amenityId String @map("amenity_id")
  mediaId   String @map("media_id")
  sort      Int    @default(0)

  amenity ProjectAmenity @relation(fields: [amenityId], references: [id], onDelete: Cascade)
  media   MediaAsset     @relation(fields: [mediaId], references: [id], onDelete: Cascade)

  @@id([amenityId, mediaId])
  @@index([amenityId, sort])
  @@map("project_amenity_media")
}
```

### model ProjectAmenityReservation

```prisma
model ProjectAmenityReservation {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  amenityId  String @map("amenity_id")
  identityId String @map("identity_id")
  bookingId  String? @map("booking_id")
  unitId     String? @map("unit_id")
  startAt    DateTime @map("start_at")
  endAt      DateTime @map("end_at")
  partySize  Int @default(1) @map("party_size")
  status     String @default("confirmed")
  note       String?
  source     String @default("guest")

  amenity  ProjectAmenity @relation(fields: [amenityId], references: [id], onDelete: Cascade)
  identity Identity       @relation(fields: [identityId], references: [id], onDelete: Cascade)
  booking  Booking?       @relation(fields: [bookingId], references: [id], onDelete: SetNull)
  unit     Unit?          @relation(fields: [unitId], references: [id], onDelete: SetNull)

  @@index([amenityId, status, startAt, endAt])
  @@index([identityId, startAt])
  @@index([bookingId])
  @@map("project_amenity_reservation")
}
```

### model ConfigParameter

```prisma
model ConfigParameter {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  key          String @unique
  valueType    String @map("value_type")
  defaultValue Json?  @map("default_value") @db.JsonB
  enumOptions  Json?  @map("enum_options") @db.JsonB
  jsonSchema   Json?  @map("json_schema") @db.JsonB
  scopeableTo  String @map("scopeable_to")
  groupKey     String @map("group_key")
  description  String

  @@map("config_parameter")
}
```

### model ConfigOverride

```prisma
model ConfigOverride {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  parameterKey        String @map("parameter_key")
  scopeType           String @map("scope_type")
  scopeId             String @map("scope_id")
  value               Json   @db.JsonB
  updatedByIdentityId String @map("updated_by_identity_id")

  @@unique([parameterKey, scopeType, scopeId])
  @@map("config_override")
}
```

### model ConfigChange

```prisma
model ConfigChange {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")

  parameterKey        String  @map("parameter_key")
  scopeType           String? @map("scope_type")
  scopeId             String? @map("scope_id")
  oldValue            Json?   @map("old_value") @db.JsonB
  newValue            Json?   @map("new_value") @db.JsonB
  changedByIdentityId String  @map("changed_by_identity_id")

  changedBy Identity @relation(name: "changedBy", fields: [changedByIdentityId], references: [id])

  @@index([parameterKey])
  @@map("config_change")
}
```

### model ContentKey

```prisma
model ContentKey {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  key          String  @unique
  namespace    String
  description  String
  supportsRich Boolean @default(false) @map("supports_rich")

  translations Translation[]

  @@index([namespace])
  @@map("content_key")
}
```

### model Translation

```prisma
model Translation {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  contentKeyId        String @map("content_key_id")
  locale              String
  value               String
  status              String @default("ok")
  updatedByIdentityId String @map("updated_by_identity_id")

  contentKey ContentKey @relation(fields: [contentKeyId], references: [id], onDelete: Cascade)
  updatedBy  Identity   @relation(name: "updatedBy", fields: [updatedByIdentityId], references: [id])

  @@unique([contentKeyId, locale])
  @@map("translation")
}
```

### model HomepagePlacement

```prisma
model HomepagePlacement {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  destinationKey String   @map("destination_key")
  locale         String?
  sectionKey     String   @map("section_key")
  entityType     String   @map("entity_type")
  entityId       String?  @map("entity_id")
  query          Json?    @db.JsonB
  position       Int      @default(0)
  visibleFrom    DateTime? @map("visible_from")
  visibleUntil   DateTime? @map("visible_until")
  status         String   @default("active")
  editorialReason String? @map("editorial_reason")

  @@index([destinationKey, sectionKey, status, position])
  @@index([entityType, entityId])
  @@map("homepage_placement")
}
```

### model Notification

```prisma
model Notification {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")

  identityId String           @map("identity_id")
  type       NotificationType
  params     Json             @db.JsonB
  titleKey   String           @map("title_key")
  bodyKey    String           @map("body_key")
  readAt     DateTime?        @map("read_at")

  identity   Identity               @relation(fields: [identityId], references: [id], onDelete: Cascade)
  deliveries NotificationDelivery[]

  @@index([identityId, createdAt])
  @@map("notification")
}
```

### model NotificationDelivery

```prisma
model NotificationDelivery {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  notificationId String                     @map("notification_id")
  channel        NotificationChannel
  status         NotificationDeliveryStatus @default(pending)
  sentAt         DateTime?                  @map("sent_at")
  failureReason  String?                    @map("failure_reason")
  externalRef    String?                    @map("external_ref")

  notification Notification @relation(fields: [notificationId], references: [id], onDelete: Cascade)

  @@index([notificationId, channel])
  @@map("notification_delivery")
}
```

### model NotificationPreference

```prisma
model NotificationPreference {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  identityId String              @map("identity_id")
  type       NotificationType
  channel    NotificationChannel
  muted      Boolean             @default(false)

  identity Identity @relation(fields: [identityId], references: [id], onDelete: Cascade)

  @@unique([identityId, type, channel])
  @@map("notification_preference")
}
```

### model Thread

```prisma
model Thread {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  contextType   ThreadContextType @map("context_type")
  contextId     String?           @map("context_id")
  projectId     String?           @map("project_id")
  lastMessageAt DateTime?         @map("last_message_at")

  project Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)

  participants ThreadParticipant[]
  messages     Message[]
  tickets      Ticket[]

  @@index([projectId, lastMessageAt])
  @@index([contextType, contextId])
  @@map("thread")
}
```

### model ThreadParticipant

```prisma
model ThreadParticipant {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  threadId        String    @map("thread_id")
  identityId      String    @map("identity_id")
  participantRole String    @map("participant_role")
  lastReadAt      DateTime? @map("last_read_at")
  muted           Boolean   @default(false)

  thread   Thread   @relation(fields: [threadId], references: [id], onDelete: Cascade)
  identity Identity @relation(fields: [identityId], references: [id], onDelete: Cascade)

  @@unique([threadId, identityId])
  @@index([identityId])
  @@map("thread_participant")
}
```

### model Message

```prisma
model Message {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")

  threadId         String      @map("thread_id")
  senderIdentityId String?     @map("sender_identity_id")
  body             String?
  messageKind      MessageKind @default(user) @map("message_kind")

  thread Thread    @relation(fields: [threadId], references: [id], onDelete: Cascade)
  sender Identity? @relation(fields: [senderIdentityId], references: [id], onDelete: SetNull)

  @@index([threadId, createdAt])
  @@map("message")
}
```

### enum OperationalTaskType

```prisma
enum OperationalTaskType {
  turnover_cleaning
  turnover_inspection
  maintenance_followup
  preventive_maintenance
  deep_cleaning
  restocking
  guest_request
  prearrival
  owner_request
  utilities
  pool
  garden
  pest_control
  compliance
  custom
}
```

### enum OperationalTaskStatus

```prisma
enum OperationalTaskStatus {
  planned
  assigned
  in_progress
  inspected
  blocked
  ready
  cancelled
}
```

### model OperationalTask

```prisma
model OperationalTask {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  projectId                  String                @map("project_id")
  unitId                     String                @map("unit_id")
  bookingId                  String?               @map("booking_id")
  operatingSpaceId           String?               @map("operating_space_id")
  assignedTeamId             String?               @map("assigned_team_id")
  preventiveMaintenancePlanId String?              @map("preventive_maintenance_plan_id")
  taskType                   OperationalTaskType   @map("task_type")
  status                     OperationalTaskStatus @default(planned)
  title                      String?
  description                String?
  priority                   String                @default("normal")
  dueAt                      DateTime              @map("due_at")
  assignedIdentityId         String?               @map("assigned_identity_id")
  estimatedCostSatang        Int?                  @map("estimated_cost_satang")
  actualCostSatang           Int?                  @map("actual_cost_satang")
  blocksInventory            Boolean               @default(false) @map("blocks_inventory")
  startedAt                  DateTime?             @map("started_at")
  inspectedAt                DateTime?             @map("inspected_at")
  readyAt                    DateTime?             @map("ready_at")
  completedAt                DateTime?             @map("completed_at")
  notes                      String?

  project         Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  unit            Unit      @relation(fields: [unitId], references: [id], onDelete: Cascade)
  booking         Booking?  @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  assignee        Identity? @relation("operationalTaskAssignee", fields: [assignedIdentityId], references: [id], onDelete: SetNull)
  operatingSpace  OperatingSpace? @relation(fields: [operatingSpaceId], references: [id], onDelete: SetNull)
  assignedTeam    OperatingTeam? @relation(fields: [assignedTeamId], references: [id], onDelete: SetNull)
  preventivePlan  PreventiveMaintenancePlan? @relation(fields: [preventiveMaintenancePlanId], references: [id], onDelete: SetNull)
  media           OperationalTaskMedia[]

  @@unique([bookingId, taskType])
  @@index([projectId, status, dueAt])
  @@index([unitId, status, dueAt])
  @@index([assignedIdentityId, status, dueAt])
  @@index([operatingSpaceId, status, dueAt])
  @@index([assignedTeamId, status, dueAt])
  @@index([preventiveMaintenancePlanId, dueAt])
  checklist Json? @db.JsonB

  @@map("operational_task")
}
```

### model OperationalTaskMedia

```prisma
model OperationalTaskMedia {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")

  operationalTaskId String @map("operational_task_id")
  mediaAssetId      String @map("media_asset_id")
  sortOrder         Int    @default(0) @map("sort_order")

  task  OperationalTask @relation(fields: [operationalTaskId], references: [id], onDelete: Cascade)
  media MediaAsset      @relation(fields: [mediaAssetId], references: [id], onDelete: Cascade)

  @@unique([operationalTaskId, mediaAssetId])
  @@index([mediaAssetId])
  @@map("operational_task_media")
}
```

### model PreventiveMaintenancePlan

```prisma
model PreventiveMaintenancePlan {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  operatingSpaceId       String              @map("operating_space_id")
  projectId              String?             @map("project_id")
  unitId                 String?             @map("unit_id")
  assignedTeamId         String?             @map("assigned_team_id")
  assignedIdentityId     String?             @map("assigned_identity_id")
  taskType               OperationalTaskType @default(preventive_maintenance) @map("task_type")
  title                  String
  description            String?
  frequencyDays          Int                 @map("frequency_days")
  nextDueAt              DateTime            @map("next_due_at")
  lastGeneratedAt        DateTime?           @map("last_generated_at")
  estimatedCostSatang    Int?                @map("estimated_cost_satang")
  blocksInventory        Boolean             @default(false) @map("blocks_inventory")
  active                 Boolean             @default(true)

  operatingSpace OperatingSpace @relation(fields: [operatingSpaceId], references: [id], onDelete: Cascade)
  project        Project?       @relation(fields: [projectId], references: [id], onDelete: Cascade)
  unit           Unit?          @relation(fields: [unitId], references: [id], onDelete: Cascade)
  assignedTeam   OperatingTeam? @relation(fields: [assignedTeamId], references: [id], onDelete: SetNull)
  assignee       Identity?      @relation("preventivePlanAssignee", fields: [assignedIdentityId], references: [id], onDelete: SetNull)
  tasks          OperationalTask[]

  @@index([operatingSpaceId, active, nextDueAt])
  @@index([unitId, active, nextDueAt])
  @@map("preventive_maintenance_plan")
}
```

### model Ticket

```prisma
model Ticket {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  projectId          String?  @map("project_id")
  unitId             String?  @map("unit_id")
  serviceOrderId String? @map("service_order_id")
  responsibleOrganizationId String? @map("responsible_organization_id")
  raisedByIdentityId String   @map("raised_by_identity_id")
  raisedByRole       RoleType @map("raised_by_role")
  assigneeIdentityId String?  @map("assignee_identity_id")

  categoryKey String         @map("category_key")
  title       String
  description String?
  priority    TicketPriority @default(normal)
  status      TicketStatus   @default(open)

  slaDueAt       DateTime? @map("sla_due_at")
  resolvedAt     DateTime? @map("resolved_at")
  resolutionNote String?   @map("resolution_note")

  threadId String? @map("thread_id")

  // Relations
  serviceOrder ServiceOrder? @relation(fields: [serviceOrderId], references: [id], onDelete: Restrict)
  responsibleOrganization Organization? @relation("serviceSupportOrganization", fields: [responsibleOrganizationId], references: [id], onDelete: Restrict)
  project  Project?      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  unit     Unit?         @relation(fields: [unitId], references: [id], onDelete: SetNull)
  raisedBy Identity      @relation(name: "ticketRaisedBy", fields: [raisedByIdentityId], references: [id], onDelete: Restrict)
  assignee Identity?     @relation(name: "ticketAssignee", fields: [assigneeIdentityId], references: [id], onDelete: SetNull)
  thread   Thread?       @relation(fields: [threadId], references: [id], onDelete: SetNull)
  events   TicketEvent[]
  media    TicketMedia[]
  dispute  Dispute?

  @@index([projectId, status])
  @@index([serviceOrderId])
  @@index([responsibleOrganizationId, status])
  @@index([assigneeIdentityId, slaDueAt])
  @@map("ticket")
}
```

### model TicketEvent

```prisma
model TicketEvent {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")

  ticketId        String          @map("ticket_id")
  eventType       TicketEventType @map("event_type")
  actorIdentityId String?         @map("actor_identity_id")
  data            Json?

  // Relations
  ticket Ticket    @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  actor  Identity? @relation(fields: [actorIdentityId], references: [id], onDelete: SetNull)

  @@index([ticketId, createdAt])
  @@map("ticket_event")
}
```

### model TicketMedia

```prisma
model TicketMedia {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")

  ticketId String @map("ticket_id")
  mediaId  String @map("media_id")
  position Int    @default(0)

  // Relations
  ticket Ticket     @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  media  MediaAsset @relation(fields: [mediaId], references: [id], onDelete: Restrict)

  @@unique([ticketId, mediaId])
  @@index([ticketId, position])
  @@map("ticket_media")
}
```

### enum DisputeSubjectType

```prisma
enum DisputeSubjectType {
  booking
  service_order
  statement
}
```

### model Dispute

```prisma
model Dispute {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  ticketId    String             @unique @map("ticket_id")
  subjectType DisputeSubjectType @map("subject_type")
  subjectId   String             @map("subject_id")

  resolutionAmountThb Int?      @map("resolution_amount_thb")
  refundId            String?   @map("refund_id")
  ledgerEntryId       String?   @map("ledger_entry_id")
  decidedByIdentityId String?   @map("decided_by_identity_id")
  decidedAt           DateTime? @map("decided_at")

  // Relations
  ticket      Ticket       @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  refund      Refund?      @relation(fields: [refundId], references: [id], onDelete: SetNull)
  ledgerEntry LedgerEntry? @relation(fields: [ledgerEntryId], references: [id], onDelete: SetNull)
  decidedBy   Identity?    @relation(name: "disputeDecidedBy", fields: [decidedByIdentityId], references: [id], onDelete: SetNull)

  @@index([subjectType, subjectId])
  @@map("dispute")
}
```

### model Announcement

```prisma
model Announcement {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  projectId           String  @map("project_id")
  createdByIdentityId String  @map("created_by_identity_id")
  organizationId      String? @map("organization_id")

  title       String
  body        String
  audience    AnnouncementAudience
  postedAs    AnnouncementPostedAs @map("posted_as")
  status      AnnouncementStatus   @default(draft)
  isPinned    Boolean              @default(false) @map("is_pinned")
  isImportant Boolean              @default(false) @map("is_important")
  expiresAt   DateTime?            @map("expires_at")

  // Relations
  project      Project            @relation(fields: [projectId], references: [id], onDelete: Cascade)
  createdBy    Identity           @relation(fields: [createdByIdentityId], references: [id], onDelete: Cascade)
  organization Organization?      @relation(fields: [organizationId], references: [id], onDelete: SetNull)
  reads        AnnouncementRead[]

  @@index([projectId, status, createdAt])
  @@index([postedAs, organizationId])
  @@map("announcement")
}
```

### model AnnouncementRead

```prisma
model AnnouncementRead {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")

  announcementId String @map("announcement_id")
  identityId     String @map("identity_id")

  // Relations
  announcement Announcement @relation(fields: [announcementId], references: [id], onDelete: Cascade)
  identity     Identity     @relation(fields: [identityId], references: [id], onDelete: Cascade)

  @@unique([announcementId, identityId])
  @@index([identityId, createdAt])
  @@map("announcement_read")
}
```

### model Tm30Filing

```prisma
model Tm30Filing {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  bookingId      String           @map("booking_id")
  bookingGuestId String           @unique @map("booking_guest_id")
  dueAt          DateTime         @map("due_at")
  status         Tm30FilingStatus @default(pending)

  filedAt           DateTime? @map("filed_at")
  filedByIdentityId String?   @map("filed_by_identity_id")
  receiptMediaId    String?   @map("receipt_media_id")
  failureNote       String?   @map("failure_note")
  escalatedAt       DateTime? @map("escalated_at")

  // Relations
  booking      Booking      @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  bookingGuest BookingGuest @relation(fields: [bookingGuestId], references: [id], onDelete: Cascade)
  filedBy      Identity?    @relation(name: "tm30FilingFiled", fields: [filedByIdentityId], references: [id], onDelete: SetNull)
  receiptMedia MediaAsset?  @relation(name: "tm30Receipt", fields: [receiptMediaId], references: [id], onDelete: SetNull)

  @@index([bookingId, status])
  @@index([dueAt, status])
  @@index([filedByIdentityId])
  @@map("tm30_filing")
}
```

### model ConditionReport

```prisma
model ConditionReport {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  unitId              String              @map("unit_id")
  bookingId           String?             @map("booking_id")
  reportType          ConditionReportType @map("report_type")
  notes               String?
  createdByIdentityId String              @map("created_by_identity_id")

  // Relations
  unit      Unit                   @relation(fields: [unitId], references: [id], onDelete: Cascade)
  booking   Booking?               @relation(fields: [bookingId], references: [id], onDelete: SetNull)
  createdBy Identity               @relation(fields: [createdByIdentityId], references: [id], onDelete: Cascade)
  media     ConditionReportMedia[]

  @@index([unitId, reportType, createdAt])
  @@index([bookingId])
  @@map("condition_report")
}
```

### model ConditionReportMedia

```prisma
model ConditionReportMedia {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")

  reportId String  @map("report_id")
  mediaId  String  @map("media_id")
  sort     Int     @default(0)
  caption  String?

  // Relations
  report ConditionReport @relation(fields: [reportId], references: [id], onDelete: Cascade)
  media  MediaAsset      @relation(name: "conditionReportPhoto", fields: [mediaId], references: [id], onDelete: Restrict)

  @@unique([reportId, mediaId])
  @@index([reportId, sort])
  @@map("condition_report_media")
}
```

### model ComplianceRecord

```prisma
model ComplianceRecord {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  unitId     String                 @map("unit_id")
  recordType ComplianceRecordType   @map("record_type")
  status     ComplianceRecordStatus @default(pending)

  label                String?
  expiresOn            DateTime? @map("expires_on") @db.Date
  mediaId              String?   @map("media_id")
  notes                String?
  verifiedAt           DateTime? @map("verified_at")
  verifiedByIdentityId String?   @map("verified_by_identity_id")

  // Relations
  unit       Unit        @relation(fields: [unitId], references: [id], onDelete: Cascade)
  media      MediaAsset? @relation(name: "complianceRecordDoc", fields: [mediaId], references: [id], onDelete: SetNull)
  verifiedBy Identity?   @relation(name: "complianceVerifier", fields: [verifiedByIdentityId], references: [id], onDelete: SetNull)

  @@index([unitId, status])
  @@index([unitId, recordType])
  @@map("compliance_record")
}
```

### model MobilizationChecklistItem

```prisma
model MobilizationChecklistItem {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  unitId String                          @map("unit_id")
  step   MobilizationChecklistItemStep
  status MobilizationChecklistItemStatus @default(pending)

  completedAt           DateTime? @map("completed_at")
  completedByIdentityId String?   @map("completed_by_identity_id")
  notes                 String?
  requirementLabel      String?   @map("requirement_label")

  // Relations
  unit        Unit      @relation(fields: [unitId], references: [id], onDelete: Cascade)
  completedBy Identity? @relation(name: "mobilizationCompletedBy", fields: [completedByIdentityId], references: [id], onDelete: SetNull)

  @@unique([unitId, step])
  @@index([unitId, status])
  @@map("mobilization_checklist_item")
}
```

### model OperationalKpi

```prisma
model OperationalKpi {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")

  unitId      String    @map("unit_id")
  metricName  String    @map("metric_name")
  periodStart DateTime  @map("period_start") @db.Date
  periodEnd   DateTime  @map("period_end") @db.Date
  targetValue Decimal?  @map("target_value") @db.Decimal(10, 2)
  actualValue Decimal?  @map("actual_value") @db.Decimal(10, 2)
  status      KPIStatus @default(on_track)

  // Relations
  unit Unit @relation(fields: [unitId], references: [id], onDelete: Cascade)

  @@index([unitId, periodStart, periodEnd])
  @@index([metricName, status])
  @@map("operational_kpi")
}
```

### model IncidentLog

```prisma
model IncidentLog {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  unitId               String           @map("unit_id")
  incidentType         IncidentType     @map("incident_type")
  severity             IncidentSeverity
  description          String
  reportedByIdentityId String           @map("reported_by_identity_id")
  assignedToIdentityId String?          @map("assigned_to_identity_id")
  status               IncidentStatus   @default(open)
  resolvedAt           DateTime?        @map("resolved_at")
  resolutionNotes      String?          @map("resolution_notes")

  // Relations
  unit       Unit      @relation(fields: [unitId], references: [id], onDelete: Cascade)
  reportedBy Identity  @relation(name: "incidentReportedBy", fields: [reportedByIdentityId], references: [id], onDelete: Restrict)
  assignedTo Identity? @relation(name: "incidentAssignedTo", fields: [assignedToIdentityId], references: [id], onDelete: SetNull)

  @@index([unitId, status])
  @@index([severity])
  @@index([createdAt])
  @@map("incident_log")
}
```

### model ComplianceChecklistTemplate

```prisma
model ComplianceChecklistTemplate {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  name      String
  frequency ComplianceChecklistFrequency
  items     Json                         @default("[]") @db.JsonB

  // Relations
  instances ComplianceChecklistInstance[]

  @@map("compliance_checklist_template")
}
```

### model ComplianceChecklistInstance

```prisma
model ComplianceChecklistInstance {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  unitId              String    @map("unit_id")
  templateId          String    @map("template_id")
  dueDate             DateTime  @map("due_date") @db.Date
  completedDate       DateTime? @map("completed_date") @db.Date
  checkedByIdentityId String?   @map("checked_by_identity_id")
  passed              Boolean?
  notes               String?

  // Relations
  unit      Unit                        @relation(fields: [unitId], references: [id], onDelete: Cascade)
  template  ComplianceChecklistTemplate @relation(fields: [templateId], references: [id], onDelete: Restrict)
  checkedBy Identity?                   @relation(name: "complianceChecklistCheckedBy", fields: [checkedByIdentityId], references: [id], onDelete: SetNull)

  @@index([unitId, dueDate])
  @@index([passed])
  @@map("compliance_checklist_instance")
}
```

### model AnalyticsEvent

```prisma
model AnalyticsEvent {
  id         String   @id @default(uuid())
  occurredAt DateTime @default(now()) @map("occurred_at")

  eventKey        AnalyticsEventKey @map("event_key")
  projectId       String?           @map("project_id")
  unitId          String?           @map("unit_id")
  bookingId       String?           @map("booking_id")
  serviceOrderId  String?           @map("service_order_id")
  identityId      String?           @map("identity_id")
  actorIdentityId String?           @map("actor_identity_id")

  // JSON payload for event-specific dimensions (no PII per doc 12)
  dimensions Json @default("{}")

  // Relations
  project       Project?      @relation(fields: [projectId], references: [id], onDelete: SetNull)
  unit          Unit?         @relation(fields: [unitId], references: [id], onDelete: SetNull)
  booking       Booking?      @relation(fields: [bookingId], references: [id], onDelete: SetNull)
  serviceOrder  ServiceOrder? @relation(fields: [serviceOrderId], references: [id], onDelete: SetNull)
  identity      Identity?     @relation(name: "analyticsEventIdentity", fields: [identityId], references: [id], onDelete: SetNull)
  actorIdentity Identity?     @relation(name: "analyticsEventActor", fields: [actorIdentityId], references: [id], onDelete: SetNull)

  @@index([eventKey, occurredAt])
  @@index([projectId, occurredAt])
  @@index([unitId, occurredAt])
  @@index([identityId, occurredAt])
  @@map("analytics_event")
}
```

### model MetricDaily

```prisma
model MetricDaily {
  id   String   @id @default(uuid())
  date DateTime @map("date") @db.Date

  projectId String @map("project_id")
  unitId    String @map("unit_id")

  // Core metrics
  nightsAvailable          Int @default(0) @map("nights_available")
  nightsOccupied           Int @default(0) @map("nights_occupied")
  ownerStayNights          Int @default(0) @map("owner_stay_nights")
  rentalRevenueCents       Int @default(0) @map("rental_revenue_cents")
  serviceOrderCount        Int @default(0) @map("service_order_count")
  serviceOrderRevenueCents Int @default(0) @map("service_order_revenue_cents")

  // Derived metrics (computed on read)
  occupancyPct Float? @map("occupancy_pct")
  adrCents     Int?   @map("adr_cents")
  revpanCents  Int?   @map("revpan_cents")

  // Relations
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  unit    Unit    @relation(fields: [unitId], references: [id], onDelete: Cascade)

  @@unique([unitId, date])
  @@index([projectId, date])
  @@index([date])
  @@map("metric_daily")
}
```

### model BuyerSignal

```prisma
model BuyerSignal {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  identityId String            @map("identity_id")
  signalKey  BuyerSignalKey    @map("signal_key")
  status     BuyerSignalStatus @default(open)
  strength   Int               @default(1)

  // Dedup: only one open signal per identity+key at a time
  closedAt             DateTime? @map("closed_at")
  notes                String?
  reviewedByIdentityId String?   @map("reviewed_by_identity_id")

  // Relations
  identity   Identity  @relation(fields: [identityId], references: [id], onDelete: Cascade)
  reviewedBy Identity? @relation(name: "buyerSignalReviewer", fields: [reviewedByIdentityId], references: [id], onDelete: SetNull)

  @@unique([identityId, signalKey])
  @@index([status, createdAt])
  @@index([signalKey, status])
  @@map("buyer_signal")
}
```

### model CrmProfile

```prisma
model CrmProfile {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  identityId                String            @unique @map("identity_id")
  lifecycleStage            CrmLifecycleStage @default(contact) @map("lifecycle_stage")
  accountOwnerIdentityId    String?           @map("account_owner_identity_id")
  leadScore                 Int               @default(0) @map("lead_score")
  tags                      String[]          @default([])
  preferredChannel          String?           @map("preferred_channel")
  firstSource               String?           @map("first_source")
  lastSource                String?           @map("last_source")
  lastInteractionAt         DateTime?         @map("last_interaction_at")
  nextActionAt              DateTime?         @map("next_action_at")
  ownerSince                DateTime?         @map("owner_since")
  guestSince                DateTime?         @map("guest_since")
  lifecycleChangedAt        DateTime?         @map("lifecycle_changed_at")
  lifecycleChangeReason     String?           @map("lifecycle_change_reason")
  lifecycleChangeApprovedBy String?           @map("lifecycle_change_approved_by")
  customFields              Json              @default("{}") @map("custom_fields")
  sourceChannelId           String?           @map("source_channel_id")
  sourceMedium              String?           @map("source_medium")
  sourceCampaign            String?           @map("source_campaign")
  referrerIdentityId        String?           @map("referrer_identity_id")

  identity             Identity                 @relation(fields: [identityId], references: [id], onDelete: Cascade)
  accountOwner         Identity?                @relation("accountOwner", fields: [accountOwnerIdentityId], references: [id], onDelete: SetNull)
  sourceChannel        Channel?                 @relation(fields: [sourceChannelId], references: [id], onDelete: SetNull)
  referrer             Identity?                @relation("referrerTo", fields: [referrerIdentityId], references: [id], onDelete: SetNull)
  lifecycleTransitions LifecycleTransitionLog[] @relation("profileTransitions")

  @@index([lifecycleStage, nextActionAt])
  @@index([leadScore])
  @@index([accountOwnerIdentityId])
  @@index([sourceChannelId])
  @@index([referrerIdentityId])
  @@map("crm_profile")
}
```

### model LifecycleTransitionLog

```prisma
model LifecycleTransitionLog {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")

  profileId            String            @map("profile_id")
  fromStage            CrmLifecycleStage @map("from_stage")
  toStage              CrmLifecycleStage @map("to_stage")
  reason               String?
  approvedByIdentityId String?           @map("approved_by_identity_id")

  profile    CrmProfile @relation("profileTransitions", fields: [profileId], references: [id], onDelete: Cascade)
  approvedBy Identity?  @relation("lifecycleApprover", fields: [approvedByIdentityId], references: [id], onDelete: SetNull)

  @@index([profileId])
  @@index([createdAt])
  @@map("lifecycle_transition_log")
}
```

### model Channel

```prisma
model Channel {
  id          String          @id @default(uuid())
  createdAt   DateTime        @default(now()) @map("created_at")
  updatedAt   DateTime        @updatedAt @map("updated_at")
  name        String
  category    ChannelCategory
  description String?

  crmProfiles CrmProfile[]

  @@index([category])
  @@map("channel")
}
```

### model ProspectingAccount

```prisma
model ProspectingAccount {
  id                   String                   @id @default(uuid())
  createdAt            DateTime                 @default(now()) @map("created_at")
  updatedAt            DateTime                 @updatedAt @map("updated_at")
  identityId           String                   @map("identity_id")
  accountType          ProspectingAccountType   @map("account_type")
  status               ProspectingAccountStatus @default(new)
  reasonForContact     String?                  @map("reason_for_contact")
  priority             Int                      @default(1)
  assignedToIdentityId String?                  @map("assigned_to_identity_id")
  lastContactedAt      DateTime?                @map("last_contacted_at")
  expectedCloseAt      DateTime?                @map("expected_close_at")

  identity   Identity  @relation("prospectingContact", fields: [identityId], references: [id], onDelete: Cascade)
  assignedTo Identity? @relation("prospectingAssignee", fields: [assignedToIdentityId], references: [id], onDelete: SetNull)

  @@index([identityId])
  @@index([status])
  @@index([assignedToIdentityId])
  @@index([expectedCloseAt])
  @@map("prospecting_account")
}
```

### model PropertyDeal

```prisma
model PropertyDeal {
  id String @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  opportunityId String @unique @map("opportunity_id")
  offeringId String @map("offering_id")
  unitId String @map("unit_id")
  kind String
  status String @default("draft")
  amountThb BigInt @map("amount_thb")
  depositThb BigInt @default(0) @map("deposit_thb")
  currency String @default("THB")
  startsOn DateTime? @map("starts_on") @db.Date
  endsOn DateTime? @map("ends_on") @db.Date
  termsSnapshot Json @default("{}") @map("terms_snapshot") @db.JsonB
  contractMediaId String? @map("contract_media_id")
  completionMediaId String? @map("completion_media_id")
  acceptedAt DateTime? @map("accepted_at")
  signedAt DateTime? @map("signed_at")
  closedAt DateTime? @map("closed_at")
  settlementReference String? @map("settlement_reference")
  handoverAt DateTime? @map("handover_at")

  opportunity CrmOpportunity @relation(fields: [opportunityId], references: [id], onDelete: Restrict)
  offering CommercialOffering @relation(fields: [offeringId], references: [id], onDelete: Restrict)
  unit Unit @relation(fields: [unitId], references: [id], onDelete: Restrict)
  contractMedia MediaAsset? @relation("propertyDealContract", fields: [contractMediaId], references: [id], onDelete: Restrict)
  completionMedia MediaAsset? @relation("propertyDealCompletion", fields: [completionMediaId], references: [id], onDelete: Restrict)
  calendarBlock BlockedDate?

  @@index([unitId,status])
  @@index([offeringId,status])
  @@map("property_deal")
}
```

### model CrmOpportunity

```prisma
model CrmOpportunity {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  identityId           String              @map("identity_id")
  assignedToIdentityId String?             @map("assigned_to_identity_id")
  projectId            String?             @map("project_id")
  unitId               String?             @map("unit_id")
  type                 CrmOpportunityType
  stage                CrmOpportunityStage @default(new)
  title                String
  source               String
  /// Satang, like every other amount in this schema (CLAUDE.md money rules,
  /// D11). Held baht until 20260906000026; see that migration.
  valueThb             Int?                @map("value_thb")
  probability          Int                 @default(10)
  requirements         Json                @default("{}")
  expectedCloseAt      DateTime?           @map("expected_close_at")
  nextActionAt         DateTime?           @map("next_action_at")
  wonAt                DateTime?           @map("won_at")
  lostAt               DateTime?           @map("lost_at")
  lostReason           String?             @map("lost_reason")
  externalPartner      String?             @map("external_partner")

  identity   Identity      @relation("crmOpportunityContact", fields: [identityId], references: [id], onDelete: Cascade)
  assignedTo Identity?     @relation("crmOpportunityAssignee", fields: [assignedToIdentityId], references: [id], onDelete: SetNull)
  project    Project?      @relation(fields: [projectId], references: [id], onDelete: SetNull)
  unit       Unit?         @relation(fields: [unitId], references: [id], onDelete: SetNull)
  activities CrmActivity[]
  propertyDeal PropertyDeal?

  @@index([stage, nextActionAt])
  @@index([identityId, createdAt])
  @@index([assignedToIdentityId, stage])
  @@index([type, stage])
  @@map("crm_opportunity")
}
```

### model CrmActivity

```prisma
model CrmActivity {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  identityId          String            @map("identity_id")
  opportunityId       String?           @map("opportunity_id")
  createdByIdentityId String?           @map("created_by_identity_id")
  type                CrmActivityType
  status              CrmActivityStatus @default(open)
  subject             String
  body                String?
  dueAt               DateTime?         @map("due_at")
  completedAt         DateTime?         @map("completed_at")
  channelReference    String?           @map("channel_reference")
  metadata            Json              @default("{}")

  identity    Identity        @relation("crmActivityContact", fields: [identityId], references: [id], onDelete: Cascade)
  opportunity CrmOpportunity? @relation(fields: [opportunityId], references: [id], onDelete: Cascade)
  createdBy   Identity?       @relation("crmActivityCreator", fields: [createdByIdentityId], references: [id], onDelete: SetNull)

  @@index([status, dueAt])
  @@index([identityId, createdAt])
  @@index([opportunityId, createdAt])
  @@map("crm_activity")
}
```

### model CrmConsent

```prisma
model CrmConsent {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  identityId String            @map("identity_id")
  purpose    CrmConsentPurpose
  status     CrmConsentStatus
  channel    String
  capturedAt DateTime          @default(now()) @map("captured_at")
  expiresAt  DateTime?         @map("expires_at")
  evidence   Json              @default("{}")

  identity Identity @relation(fields: [identityId], references: [id], onDelete: Cascade)

  @@index([identityId, purpose, capturedAt])
  @@index([status, expiresAt])
  @@map("crm_consent")
}
```

### model CrmAttributionTouch

```prisma
model CrmAttributionTouch {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")

  identityId  String       @map("identity_id")
  touchType   CrmTouchType @map("touch_type")
  source      String
  medium      String?
  campaign    String?
  content     String?
  landingPage String?      @map("landing_page")
  referrer    String?
  occurredAt  DateTime     @default(now()) @map("occurred_at")
  metadata    Json         @default("{}")

  identity Identity @relation(fields: [identityId], references: [id], onDelete: Cascade)

  @@index([identityId, occurredAt])
  @@index([source, campaign, occurredAt])
  @@map("crm_attribution_touch")
}
```

### model ManagementContract

```prisma
model ManagementContract {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  unitId                   String             @map("unit_id")
  projectId                String             @map("project_id")
  ownerIdentityId          String             @map("owner_identity_id")
  managementFeeBasis       ManagementFeeBasis @map("management_fee_basis")
  managementFeeRate        Decimal?           @map("management_fee_rate") @db.Decimal(5, 4)
  managementFeeFixedAmount Int?               @map("management_fee_fixed_amount")
  performanceFeeEnabled    Boolean            @default(false) @map("performance_fee_enabled")
  performanceFeeBasis      String?            @map("performance_fee_basis")
  performanceFeeRate       Decimal?           @map("performance_fee_rate") @db.Decimal(5, 4)
  performanceFeeBaseline   Int?               @map("performance_fee_baseline")
  contractStartDate        DateTime           @map("contract_start_date") @db.Date
  contractEndDate          DateTime?          @map("contract_end_date") @db.Date
  status                   ContractStatus     @default(active)
  signedAt                 DateTime?          @map("signed_at")
  signedByOwnerIdentityId  String?            @map("signed_by_owner_identity_id")

  // Relations
  unit             Unit        @relation(fields: [unitId], references: [id], onDelete: Cascade)
  project          Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  ownerIdentity    Identity    @relation("contractOwner", fields: [ownerIdentityId], references: [id], onDelete: Cascade)
  signedByIdentity Identity?   @relation("contractSignatory", fields: [signedByOwnerIdentityId], references: [id], onDelete: SetNull)
  earnedFees       EarnedFee[]

  @@index([unitId])
  @@index([projectId])
  @@index([ownerIdentityId])
  @@index([status])
  @@index([contractStartDate])
  @@map("management_contract")
}
```

### model EarnedFee

```prisma
model EarnedFee {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")

  managementContractId String    @map("management_contract_id")
  feeType              FeeType   @map("fee_type")
  periodStart          DateTime  @map("period_start") @db.Date
  periodEnd            DateTime  @map("period_end") @db.Date
  calculationBasis     String    @map("calculation_basis")
  amount               Int
  status               FeeStatus @default(accrued)
  invoiceId            String?   @map("invoice_id")
  paidAt               DateTime? @map("paid_at")

  // Relations
  managementContract ManagementContract @relation(fields: [managementContractId], references: [id], onDelete: Cascade)

  @@index([managementContractId])
  @@index([periodStart, periodEnd])
  @@index([status])
  @@index([feeType])
  @@map("earned_fee")
}
```

### model IntegrationAccount

```prisma
model IntegrationAccount {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // What integration and where it's scoped
  integrationKey IntegrationKey       @map("integration_key")
  scopeType      IntegrationScopeType @map("scope_type")

  // Scope IDs: only one of these is populated based on scopeType
  platformId String? @map("platform_id")
  projectId  String? @map("project_id")
  unitId     String? @map("unit_id")

  // Integration state & secrets
  config     Json              @default("{}") // contains provider_account, auth tokens, etc. — encrypted per doc 12
  status     IntegrationStatus @default(active)
  lastSyncAt DateTime?         @map("last_sync_at")
  lastError  String?           @map("last_error")

  // Relations
  project Project? @relation(fields: [projectId], references: [id], onDelete: Cascade)
  unit    Unit?    @relation(fields: [unitId], references: [id], onDelete: Cascade)

  @@unique([integrationKey, scopeType, projectId, unitId])
  @@index([scopeType, projectId])
  @@index([scopeType, unitId])
  @@index([status, lastSyncAt])
  @@map("integration_account")
}
```

### model OwnershipPeriod

```prisma
model OwnershipPeriod {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")

  unitId               String    @map("unit_id")
  ownerIdentityId      String    @map("owner_identity_id")
  startsOn             DateTime  @map("starts_on") @db.Date
  /// Null means this is the current owner.
  endsOn               DateTime? @map("ends_on") @db.Date
  note                 String?
  recordedByIdentityId String?   @map("recorded_by_identity_id")

  // Relations
  unit       Unit      @relation(fields: [unitId], references: [id], onDelete: Cascade)
  owner      Identity  @relation(name: "ownershipPeriodOwner", fields: [ownerIdentityId], references: [id])
  recordedBy Identity? @relation(name: "ownershipPeriodRecorder", fields: [recordedByIdentityId], references: [id], onDelete: SetNull)

  @@index([unitId, startsOn])
  @@index([ownerIdentityId])
  @@map("ownership_period")
}
```

### model SavedUnit

```prisma
model SavedUnit {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")

  identityId String  @map("identity_id")
  unitId     String  @map("unit_id")
  /// Free-text list name. Null is the default list.
  collection String?
  note       String?

  identity Identity @relation(fields: [identityId], references: [id], onDelete: Cascade)
  unit     Unit     @relation(fields: [unitId], references: [id], onDelete: Cascade)

  @@index([identityId])
  @@index([unitId])
  @@map("saved_unit")
}
```

### model SavedSearch

```prisma
model SavedSearch {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  /// `@default(now())` mirrors the DEFAULT the creating migration wrote. Prisma
  /// always supplies this value, so the default never fires — but without it
  /// declared, `migrate diff` reports drift on an otherwise clean database.
  updatedAt DateTime @default(now()) @updatedAt @map("updated_at")

  identityId    String    @map("identity_id")
  name          String?
  /// The criteria themselves, not a query string — a URL shape is presentation.
  criteria      Json      @db.JsonB
  alertsEnabled Boolean   @default(true) @map("alerts_enabled")
  lastAlertedAt DateTime? @map("last_alerted_at")

  identity Identity @relation(fields: [identityId], references: [id], onDelete: Cascade)

  @@index([identityId])
  @@index([alertsEnabled])
  @@map("saved_search")
}
```

### model JobRun

```prisma
model JobRun {
  id         String        @id @default(uuid())
  createdAt  DateTime      @default(now()) @map("created_at")
  jobKey     String        @map("job_key")
  startedAt  DateTime      @map("started_at")
  finishedAt DateTime      @map("finished_at")
  outcome    JobRunOutcome
  /// Short count/status text. Never error messages — Prisma failures can carry
  /// connection strings, and a stack can carry PII.
  summary    String?

  @@index([jobKey, startedAt])
  @@map("job_run")
}
```

### model ProjectOrganizationRole

```prisma
model ProjectOrganizationRole {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  projectId      String    @map("project_id")
  organizationId String    @map("organization_id")
  roleKey        String    @map("role_key")
  effectiveFrom  DateTime? @map("effective_from")
  effectiveTo    DateTime? @map("effective_to")
  isPrimary      Boolean   @default(false) @map("is_primary")
  notes          String?
  provenance     String?   @default("verified")

  project      Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([projectId, organizationId, roleKey])
  @@index([projectId, roleKey])
  @@index([organizationId])
  @@map("project_organization_role")
}
```

### model SleepingSpace

```prisma
model SleepingSpace {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  unitId    String  @map("unit_id")
  spaceType String  @default("bedroom") @map("space_type")
  name      String?
  sortOrder Int     @default(0) @map("sort_order")

  unit Unit  @relation(fields: [unitId], references: [id], onDelete: Cascade)
  beds Bed[]

  @@index([unitId, sortOrder])
  @@map("sleeping_space")
}
```

### model Bed

```prisma
model Bed {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  sleepingSpaceId String @map("sleeping_space_id")
  bedType         String @map("bed_type")
  count           Int    @default(1)

  sleepingSpace SleepingSpace @relation(fields: [sleepingSpaceId], references: [id], onDelete: Cascade)

  @@index([sleepingSpaceId])
  @@map("bed")
}
```

### model CommercialOffering

```prisma
model CommercialOffering {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  projectId    String? @map("project_id")
  unitId       String? @map("unit_id")
  offeringType String  @map("offering_type")
  status       String  @default("active")

  pricingTerms     Json @default("{}") @map("pricing_terms") @db.JsonB
  rulesAndPolicies Json @default("{}") @map("rules_and_policies") @db.JsonB
  ownershipTenure  Json @default("{}") @map("ownership_tenure") @db.JsonB

  project         Project?         @relation(fields: [projectId], references: [id], onDelete: Cascade)
  unit            Unit?            @relation(fields: [unitId], references: [id], onDelete: Cascade)
  channelMappings ChannelMapping[]
  propertyDeals PropertyDeal[]

  @@unique([unitId, offeringType], map: "commercial_offering_unit_type_unique")
  @@index([unitId, offeringType])
  @@index([projectId, offeringType])
  @@map("commercial_offering")
}
```

### model ChannelMapping

```prisma
model ChannelMapping {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  offeringId        String    @map("offering_id")
  channel           String
  externalListingId String?   @map("external_listing_id")
  syncState         String    @default("synced") @map("sync_state")
  externalStatus    String?   @map("external_status")
  lastSyncAt        DateTime? @map("last_sync_at")
  channelOverrides  Json      @default("{}") @map("channel_overrides") @db.JsonB
  syncErrors        Json      @default("[]") @map("sync_errors") @db.JsonB

  offering CommercialOffering @relation(fields: [offeringId], references: [id], onDelete: Cascade)

  @@unique([offeringId, channel])
  @@map("channel_mapping")
}
```

### model RegulatoryCredential

```prisma
model RegulatoryCredential {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  requirementKey      String @map("requirement_key")
  jurisdictionCountry String @default("TH") @map("jurisdiction_country")
  credentialType      String @map("credential_type")
  scopeLevel          String @map("scope_level")

  organizationId String? @map("organization_id")
  projectId      String? @map("project_id")
  unitId         String? @map("unit_id")

  registrationNumber String?   @map("registration_number")
  issuingAuthority   String?   @map("issuing_authority")
  legalHolderName    String?   @map("legal_holder_name")
  issueDate          DateTime? @map("issue_date")
  effectiveDate      DateTime? @map("effective_date")
  expiryDate         DateTime? @map("expiry_date")
  status             String    @default("active")
  exemptionBasis     String?   @map("exemption_basis")

  evidenceMediaId      String?   @map("evidence_media_id")
  verificationStatus   String    @default("verified") @map("verification_status")
  verifiedByIdentityId String?   @map("verified_by_identity_id")
  verifiedAt           DateTime? @map("verified_at")
  notes                String?

  organization  Organization? @relation(fields: [organizationId], references: [id], onDelete: SetNull)
  project       Project?      @relation(fields: [projectId], references: [id], onDelete: SetNull)
  unit          Unit?         @relation(fields: [unitId], references: [id], onDelete: SetNull)
  evidenceMedia MediaAsset?   @relation(name: "regulatoryDoc", fields: [evidenceMediaId], references: [id], onDelete: SetNull)
  verifiedBy    Identity?     @relation(name: "credentialVerifier", fields: [verifiedByIdentityId], references: [id], onDelete: SetNull)

  @@index([organizationId, status])
  @@index([projectId, status])
  @@index([unitId, status])
  @@index([credentialType, status])
  @@map("regulatory_credential")
}
```

### model ProjectStructureNode

```prisma
model ProjectStructureNode {
  id          String   @id @default(uuid())
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  projectId   String   @map("project_id")
  parentId    String?  @map("parent_id")
  kind        String
  code        String
  name        String
  floorNumber Int?     @map("floor_number")
  sortOrder   Int      @default(0) @map("sort_order")
  metadata    Json     @default("{}") @db.JsonB

  project     Project                @relation(fields: [projectId], references: [id], onDelete: Cascade)
  parent      ProjectStructureNode?  @relation("structureHierarchy", fields: [parentId], references: [id], onDelete: Restrict)
  children    ProjectStructureNode[] @relation("structureHierarchy")
  units       Unit[]

  @@unique([projectId, code])
  @@index([projectId, parentId, sortOrder])
  @@map("project_structure_node")
}
```

### model InventoryCategory

```prisma
model InventoryCategory {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  projectId             String  @map("project_id")
  categoryKey           String  @map("category_key")
  name                  String
  bedrooms              Int
  bathrooms             Int
  maxGuests             Int     @map("max_guests")
  baseNightlyThb        Int     @map("base_nightly_thb")
  minNights             Int     @default(1) @map("min_nights")
  cancellationPolicyKey String? @map("cancellation_policy_key")
  status                String  @default("live")

  project   Project    @relation(fields: [projectId], references: [id], onDelete: Cascade)
  units     Unit[]
  ratePlans RatePlan[]
  galleryMedia InventoryCategoryMedia[]
  coverMediaId String? @map("cover_media_id")
  coverMedia MediaAsset? @relation("categoryCover", fields: [coverMediaId], references: [id], onDelete: SetNull)

  @@unique([projectId, categoryKey])
  @@map("inventory_category")
}
```

### model RatePlan

```prisma
model RatePlan {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  projectId  String? @map("project_id")
  categoryId String? @map("category_id")
  unitId     String? @map("unit_id")

  code                  String
  name                  String
  isMaster              Boolean  @default(true) @map("is_master")
  parentRatePlanId      String?  @map("parent_rate_plan_id")
  adjustmentType        String?  @map("adjustment_type")
  adjustmentValue       Decimal? @map("adjustment_value") @db.Decimal(10, 2)
  cancellationPolicyKey String?  @map("cancellation_policy_key")
  minNights             Int?     @map("min_nights")
  status                String   @default("active")

  project          Project?           @relation(fields: [projectId], references: [id], onDelete: Cascade)
  category         InventoryCategory? @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  unit             Unit?              @relation(fields: [unitId], references: [id], onDelete: Cascade)
  parentRatePlan   RatePlan?          @relation(name: "derivedRatePlan", fields: [parentRatePlanId], references: [id], onDelete: SetNull)
  derivedRatePlans RatePlan[]         @relation(name: "derivedRatePlan")

  @@unique([projectId, code])
  @@index([categoryId])
  @@index([unitId])
  @@map("rate_plan")
}
```

### model ServiceQuoteRequest

```prisma
model ServiceQuoteRequest {
  id         String   @id @default(dbgenerated("(gen_random_uuid())::text"))
  created_at DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updated_at DateTime @default(now()) @map("updated_at") @db.Timestamptz(6)

  service_id          String    @map("service_id")
  project_id          String?   @map("project_id")
  orderer_identity_id String    @map("orderer_identity_id")
  service_context     Json      @default("{}") @map("service_context") @db.JsonB
  quantity_dimensions Json      @default("{}") @map("quantity_dimensions") @db.JsonB
  status              String    @default("open")
  expires_at          DateTime? @map("expires_at") @db.Timestamptz(6)

  service  Service               @relation(fields: [service_id], references: [id], onDelete: Cascade, onUpdate: NoAction)
  project  Project?              @relation(fields: [project_id], references: [id], onUpdate: NoAction)
  orderer  Identity              @relation(name: "serviceQuoteRequestOrderer", fields: [orderer_identity_id], references: [id], onDelete: Cascade, onUpdate: NoAction)
  versions ServiceQuoteVersion[]

  @@index([orderer_identity_id, created_at], map: "service_quote_request_orderer_created_idx")
  @@index([service_id, status], map: "service_quote_request_service_status_idx")
  @@map("service_quote_request")
}
```

### model ServiceQuoteVersion

```prisma
model ServiceQuoteVersion {
  id         String   @id @default(dbgenerated("(gen_random_uuid())::text"))
  created_at DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  request_id      String    @map("request_id")
  version         Int
  provider_id     String    @map("provider_id")
  price_breakdown Json      @default("{}") @map("price_breakdown") @db.JsonB
  total_thb       Int       @map("total_thb")
  terms_snapshot  Json      @default("{}") @map("terms_snapshot") @db.JsonB
  expires_at      DateTime  @map("expires_at") @db.Timestamptz(6)
  accepted_at     DateTime? @map("accepted_at") @db.Timestamptz(6)

  request  ServiceQuoteRequest @relation(fields: [request_id], references: [id], onDelete: Cascade, onUpdate: NoAction)
  provider Provider            @relation(fields: [provider_id], references: [id], onUpdate: NoAction)
  orders   ServiceOrder[]

  @@unique([request_id, version], map: "service_quote_version_request_version_key")
  @@map("service_quote_version")
}
```

### model BookingReschedule

```prisma
model BookingReschedule {
  id         String   @id @default(dbgenerated("(gen_random_uuid())::text"))
  created_at DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updated_at DateTime @default(now()) @map("updated_at") @db.Timestamptz(6)

  booking_id               String @map("booking_id")
  requested_by_identity_id String @map("requested_by_identity_id")

  old_start_date DateTime @map("old_start_date") @db.Date
  old_end_date   DateTime @map("old_end_date") @db.Date
  new_start_date DateTime @map("new_start_date") @db.Date
  new_end_date   DateTime @map("new_end_date") @db.Date

  previous_total_thb Int  @map("previous_total_thb")
  new_total_thb      Int  @map("new_total_thb")
  price_delta_thb    Int  @map("price_delta_thb")
  pricing_snapshot   Json @default("{}") @map("pricing_snapshot") @db.JsonB

  status          String    @default("pending_funding")
  hold_expires_at DateTime  @map("hold_expires_at") @db.Timestamptz(6)
  payment_id      String?   @map("payment_id")
  committed_at    DateTime? @map("committed_at") @db.Timestamptz(6)
  released_at     DateTime? @map("released_at") @db.Timestamptz(6)

  booking     Booking  @relation(fields: [booking_id], references: [id], onDelete: Cascade, onUpdate: NoAction)
  payment     Payment? @relation(fields: [payment_id], references: [id], onUpdate: NoAction)
  requestedBy Identity @relation(name: "bookingRescheduleRequestedBy", fields: [requested_by_identity_id], references: [id], onUpdate: NoAction)

  @@index([booking_id, created_at], map: "booking_reschedule_booking_idx")
  @@index([status, hold_expires_at], map: "booking_reschedule_hold_idx")
  @@map("booking_reschedule")
}
```

### model ExternalSystem

```prisma
model ExternalSystem {
  id         String   @id @default(dbgenerated("(gen_random_uuid())::text"))
  created_at DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updated_at DateTime @default(now()) @map("updated_at") @db.Timestamptz(6)

  system_key   String @map("system_key")
  environment  String
  display_name String @map("display_name")
  status       String @default("active")
  config       Json   @default("{}") @db.JsonB

  mappings    ExternalMapping[]
  inbox       ExternalEventInbox[]
  checkpoints ExternalAggregateCheckpoint[]

  @@unique([system_key, environment], map: "external_system_key_environment_key")
  @@map("external_system")
}
```

### model ExternalMapping

```prisma
model ExternalMapping {
  id         String   @id @default(dbgenerated("(gen_random_uuid())::text"))
  created_at DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updated_at DateTime @default(now()) @map("updated_at") @db.Timestamptz(6)

  external_system_id String    @map("external_system_id")
  entity_type        String    @map("entity_type")
  internal_id        String    @map("internal_id")
  external_id        String    @map("external_id")
  external_version   BigInt?   @map("external_version")
  last_seen_at       DateTime? @map("last_seen_at") @db.Timestamptz(6)
  metadata           Json      @default("{}") @db.JsonB

  externalSystem ExternalSystem @relation(fields: [external_system_id], references: [id], onDelete: Cascade, onUpdate: NoAction)

  @@unique([external_system_id, entity_type, external_id], map: "external_mapping_external_key")
  @@unique([external_system_id, entity_type, internal_id], map: "external_mapping_internal_key")
  @@index([entity_type, internal_id], map: "external_mapping_internal_idx")
  @@map("external_mapping")
}
```

### model ExternalEventInbox

```prisma
model ExternalEventInbox {
  id          String   @id @default(dbgenerated("(gen_random_uuid())::text"))
  received_at DateTime @default(now()) @map("received_at") @db.Timestamptz(6)

  external_system_id    String    @map("external_system_id")
  event_id              String    @map("event_id")
  aggregate_type        String    @map("aggregate_type")
  aggregate_external_id String    @map("aggregate_external_id")
  event_type            String    @map("event_type")
  event_version         BigInt?   @map("event_version")
  occurred_at           DateTime  @map("occurred_at") @db.Timestamptz(6)
  payload               Json      @db.JsonB
  payload_hash          String    @map("payload_hash")
  status                String    @default("received")
  processed_at          DateTime? @map("processed_at") @db.Timestamptz(6)
  error_code            String?   @map("error_code")

  externalSystem ExternalSystem @relation(fields: [external_system_id], references: [id], onDelete: Cascade, onUpdate: NoAction)

  @@unique([external_system_id, event_id], map: "external_event_inbox_dedup_key")
  @@index([status, received_at], map: "external_event_inbox_work_idx")
  @@map("external_event_inbox")
}
```

### model ExternalAggregateCheckpoint

```prisma
model ExternalAggregateCheckpoint {
  external_system_id    String  @map("external_system_id")
  aggregate_type        String  @map("aggregate_type")
  aggregate_external_id String  @map("aggregate_external_id")
  last_event_id         String  @map("last_event_id")
  last_event_version    BigInt? @map("last_event_version")

  last_occurred_at DateTime @map("last_occurred_at") @db.Timestamptz(6)
  updated_at       DateTime @default(now()) @map("updated_at") @db.Timestamptz(6)

  externalSystem ExternalSystem @relation(fields: [external_system_id], references: [id], onDelete: Cascade, onUpdate: NoAction)

  @@id([external_system_id, aggregate_type, aggregate_external_id])
  @@map("external_aggregate_checkpoint")
}
```

### model PropertyOnboardingTemplate

```prisma
model PropertyOnboardingTemplate {
  id         String   @id @default(dbgenerated("(gen_random_uuid())::text"))
  created_at DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updated_at DateTime @default(now()) @map("updated_at") @db.Timestamptz(6)

  template_key  String  @map("template_key")
  version       Int
  name          String
  property_type String  @map("property_type")
  configuration Json    @default("{}") @db.JsonB
  checklist     Json    @default("[]") @db.JsonB
  active        Boolean @default(true)

  drafts ProjectOnboardingDraft[]

  @@unique([template_key, version], map: "property_onboarding_template_key_version_key")
  @@map("property_onboarding_template")
}
```

### model ProjectOnboardingDraft

```prisma
model ProjectOnboardingDraft {
  project_id String   @id @map("project_id")
  created_at DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updated_at DateTime @default(now()) @map("updated_at") @db.Timestamptz(6)

  template_id             String? @map("template_id")
  stage_data              Json    @default("{}") @map("stage_data") @db.JsonB
  inherited_configuration Json    @default("{}") @map("inherited_configuration") @db.JsonB
  last_stage              String? @map("last_stage")
  updated_by_identity_id  String? @map("updated_by_identity_id")

  autosaved_at DateTime @default(now()) @map("autosaved_at") @db.Timestamptz(6)

  project   Project                     @relation(fields: [project_id], references: [id], onDelete: Cascade, onUpdate: NoAction)
  template  PropertyOnboardingTemplate? @relation(fields: [template_id], references: [id], onUpdate: NoAction)
  updatedBy Identity?                   @relation(name: "projectOnboardingDraftUpdatedBy", fields: [updated_by_identity_id], references: [id], onUpdate: NoAction)

  @@map("project_onboarding_draft")
}
```

### model UnifiedDomainEvent

```prisma
model UnifiedDomainEvent {
  id            String    @id @default(dbgenerated("(gen_random_uuid())::text"))
  created_at    DateTime  @default(now()) @db.Timestamptz(6)
  project_id    String?
  unit_id       String?
  booking_id    String?
  entity_type   String
  entity_id     String
  event_type    String
  payload       Json      @default("{}") @db.JsonB
  delivered_at  DateTime? @db.Timestamptz(6)
  attempt_count Int       @default(0)

  @@index([project_id, created_at, id], map: "unified_domain_event_project_cursor_idx")
  @@index([booking_id, created_at], map: "unified_domain_event_booking_cursor_idx")
  @@index([delivered_at, created_at], map: "unified_domain_event_pending_idx")
  @@map("unified_domain_event")
}
```

### model ProjectStaffPermission

```prisma
model ProjectStaffPermission {
  projectId    String   @map("project_id")
  identityId   String   @map("identity_id")
  departments  String[] @default([])
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @default(now()) @updatedAt @map("updated_at")
  project Project @relation(fields:[projectId], references:[id], onDelete:Cascade, onUpdate:NoAction)
  identity Identity @relation(fields:[identityId], references:[id], onDelete:Cascade, onUpdate:NoAction)

  @@id([projectId, identityId])
  @@index([identityId], map:"project_staff_permission_identity_idx")
  @@map("project_staff_permission")
}
```

### model UnitAccessInstruction

```prisma
model UnitAccessInstruction {
  unitId       String   @id @map("unit_id")
  ciphertext   String
  updatedById  String   @map("updated_by_identity_id")
  updatedAt    DateTime @default(now()) @updatedAt @map("updated_at")
  unit Unit @relation(fields:[unitId], references:[id], onDelete:Cascade, onUpdate:NoAction)
  updatedBy Identity @relation(fields:[updatedById], references:[id], onDelete:NoAction, onUpdate:NoAction)
  @@map("unit_access_instruction")
}
```

### model OperatingSpace

```prisma
model OperatingSpace {
  salesOffers SalesOffer[]
  reservationGroups ReservationGroup[]
  operationalTasks OperationalTask[]
  preventiveMaintenancePlans PreventiveMaintenancePlan[]
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  key            String @unique
  name           String
  organizationId String @map("organization_id")
  timezone       String @default("Asia/Bangkok")
  status         String @default("active")

  organization Organization          @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  units        OperatingSpaceUnit[]
  members      OperatingSpaceMember[]
  teams        OperatingTeam[]

  @@index([organizationId, status])
  @@map("operating_space")
}
```

### model OperatingSpaceUnit

```prisma
model OperatingSpaceUnit {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  operatingSpaceId String   @map("operating_space_id")
  unitId           String   @map("unit_id")
  active           Boolean  @default(true)
  startsOn         DateTime @default(now()) @map("starts_on")
  endsOn           DateTime? @map("ends_on")

  operatingSpace OperatingSpace @relation(fields: [operatingSpaceId], references: [id], onDelete: Cascade)
  unit           Unit           @relation(fields: [unitId], references: [id], onDelete: Cascade)

  @@unique([operatingSpaceId, unitId])
  @@index([unitId, active])
  @@map("operating_space_unit")
}
```

### model OperatingSpaceMember

```prisma
model OperatingSpaceMember {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  operatingSpaceId String   @map("operating_space_id")
  identityId       String   @map("identity_id")
  capabilities     String[] @default([])
  active           Boolean  @default(true)

  operatingSpace OperatingSpace @relation(fields: [operatingSpaceId], references: [id], onDelete: Cascade)
  identity       Identity       @relation(fields: [identityId], references: [id], onDelete: Cascade)

  @@unique([operatingSpaceId, identityId])
  @@index([identityId, active])
  @@map("operating_space_member")
}
```

### model OperatingTeam

```prisma
model OperatingTeam {
  operationalTasks OperationalTask[]
  preventiveMaintenancePlans PreventiveMaintenancePlan[]
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  operatingSpaceId String @map("operating_space_id")
  name             String
  teamType         String @map("team_type")
  active           Boolean @default(true)

  operatingSpace OperatingSpace       @relation(fields: [operatingSpaceId], references: [id], onDelete: Cascade)
  members        OperatingTeamMember[]

  @@unique([operatingSpaceId, name])
  @@index([operatingSpaceId, teamType, active])
  @@map("operating_team")
}
```

### model OperatingTeamMember

```prisma
model OperatingTeamMember {
  id        String   @id @default(uuid())
  createdAt DateTime @default(now()) @map("created_at")

  operatingTeamId String @map("operating_team_id")
  identityId      String @map("identity_id")
  active          Boolean @default(true)

  operatingTeam OperatingTeam @relation(fields: [operatingTeamId], references: [id], onDelete: Cascade)
  identity      Identity      @relation(fields: [identityId], references: [id], onDelete: Cascade)

  @@unique([operatingTeamId, identityId])
  @@index([identityId, active])
  @@map("operating_team_member")
}
```

### model ServiceOrderDispatch

```prisma
model ServiceOrderDispatch {
  id             String    @id @default(uuid())
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")
  serviceOrderId String    @unique @map("service_order_id")
  stage          String    @default("assigned")
  staffName      String?   @map("staff_name")
  staffPhone     String?   @map("staff_phone")
  etaAt          DateTime? @map("eta_at")
  lastLat        Decimal?  @map("last_lat") @db.Decimal(9, 6)
  lastLng        Decimal?  @map("last_lng") @db.Decimal(9, 6)
  lastPositionAt DateTime? @map("last_position_at")

  serviceOrder ServiceOrder @relation(fields: [serviceOrderId], references: [id], onDelete: Cascade)

  @@map("service_order_dispatch")
}
```

### model SecretVaultEntry

```prisma
model SecretVaultEntry {
  id                  String   @id @default(uuid())
  createdAt           DateTime @default(now()) @map("created_at")
  updatedAt           DateTime @updatedAt @map("updated_at")
  name                String   @unique @db.VarChar(100)
  valueEncrypted      String?  @map("value_encrypted")
  last4               String?  @db.VarChar(4)
  notes               String?  @db.VarChar(500)
  updatedByIdentityId String?  @map("updated_by_identity_id")

  @@map("secret_vault_entry")
}
```

### model RateLimitBucket

```prisma
model RateLimitBucket {
  key               String   @id @db.VarChar(200)
  attempts          Int
  resetAt           DateTime @map("reset_at")
  backoffMultiplier Int      @default(1) @map("backoff_multiplier")

  @@index([resetAt])
  @@map("rate_limit_bucket")
}
```

### model SalesTariffValidation

```prisma
model SalesTariffValidation {
  id String @id @default(uuid())
  unitId String @map("unit_id")
  fingerprint String
  ruleVersion String @map("rule_version")
  evidenceRef String @map("evidence_ref")
  reviewedByIdentityId String @map("reviewed_by_identity_id")
  validFrom DateTime @map("valid_from") @db.Date
  validThrough DateTime @map("valid_through") @db.Date
  expiresAt DateTime @map("expires_at")
  revokedAt DateTime? @map("revoked_at")
  currency String
  createdAt DateTime @default(now()) @map("created_at")
  unit Unit @relation(fields: [unitId], references: [id], onDelete: Restrict)
  reviewer Identity @relation(fields: [reviewedByIdentityId], references: [id], onDelete: Restrict)
  options SalesOfferOption[]
  @@index([unitId, fingerprint])
  @@index([reviewedByIdentityId])
  @@map("sales_tariff_validation")
}
```

### model SalesOffer

```prisma
model SalesOffer {
  id String @id @default(uuid())
  seriesId String @map("series_id")
  version Int
  operatingSpaceId String @map("operating_space_id")
  createdByIdentityId String @map("created_by_identity_id")
  createdAt DateTime @default(now()) @map("created_at")
  expiresAt DateTime @map("expires_at")
  locale String
  clientNote String @map("client_note")
  salespersonName String @map("salesperson_name")
  options SalesOfferOption[]
  shares SalesOfferShare[]
  space OperatingSpace @relation(fields: [operatingSpaceId], references: [id], onDelete: Restrict)
  salesperson Identity @relation(fields: [createdByIdentityId], references: [id], onDelete: Restrict)
  @@unique([seriesId, version])
  @@index([operatingSpaceId, createdAt])
  @@index([createdByIdentityId])
  @@map("sales_offer")
}
```

### model SalesOfferOption

```prisma
model SalesOfferOption {
  id String @id @default(uuid())
  offerId String @map("offer_id")
  position Int
  unitId String @map("unit_id")
  validationId String? @map("validation_id")
  fingerprint String
  snapshot Json @db.JsonB
  offer SalesOffer @relation(fields: [offerId], references: [id], onDelete: Restrict)
  unit Unit @relation(fields: [unitId], references: [id], onDelete: Restrict)
  validation SalesTariffValidation? @relation(fields: [validationId], references: [id], onDelete: Restrict)
  @@unique([offerId, position])
  @@index([unitId])
  @@index([validationId])
  @@map("sales_offer_option")
}
```

### model SalesOfferShare

```prisma
model SalesOfferShare {
  id String @id @default(uuid())
  offerId String @map("offer_id")
  tokenHash String @unique @map("token_hash")
  createdByIdentityId String @map("created_by_identity_id")
  createdAt DateTime @default(now()) @map("created_at")
  expiresAt DateTime @map("expires_at")
  revokedAt DateTime? @map("revoked_at")
  offer SalesOffer @relation(fields: [offerId], references: [id], onDelete: Restrict)
  creator Identity @relation(fields: [createdByIdentityId], references: [id], onDelete: Restrict)
  @@index([offerId])
  @@index([createdByIdentityId])
  @@map("sales_offer_share")
}
```

## Все миграции

Наличие файла не доказывает production application. Не править исторические SQL; apply/reconcile отдельно.

- [prisma/migrations/0_init/migration.sql](<../../prisma/migrations/0_init/migration.sql>)
- [prisma/migrations/20260716000000_align_init_baseline/migration.sql](<../../prisma/migrations/20260716000000_align_init_baseline/migration.sql>)
- [prisma/migrations/20260719000001_order_cancelled_notification/migration.sql](<../../prisma/migrations/20260719000001_order_cancelled_notification/migration.sql>)
- [prisma/migrations/20260719000002_provider_applicant_identity/migration.sql](<../../prisma/migrations/20260719000002_provider_applicant_identity/migration.sql>)
- [prisma/migrations/20260719000003_metric_daily_owner_stay_nights/migration.sql](<../../prisma/migrations/20260719000003_metric_daily_owner_stay_nights/migration.sql>)
- [prisma/migrations/20260719000004_service_order_expiry/migration.sql](<../../prisma/migrations/20260719000004_service_order_expiry/migration.sql>)
- [prisma/migrations/20260727000005_guest_pii_encryption/migration.sql](<../../prisma/migrations/20260727000005_guest_pii_encryption/migration.sql>)
- [prisma/migrations/20260727000006_one_active_engagement_per_unit/migration.sql](<../../prisma/migrations/20260727000006_one_active_engagement_per_unit/migration.sql>)
- [prisma/migrations/20260727000007_indexes_and_deletion_status/migration.sql](<../../prisma/migrations/20260727000007_indexes_and_deletion_status/migration.sql>)
- [prisma/migrations/20260728000008_unit_category_key/migration.sql](<../../prisma/migrations/20260728000008_unit_category_key/migration.sql>)
- [prisma/migrations/20260813000009_crm_foundation/migration.sql](<../../prisma/migrations/20260813000009_crm_foundation/migration.sql>)
- [prisma/migrations/20260813000010_owner_reporting_and_transparency/migration.sql](<../../prisma/migrations/20260813000010_owner_reporting_and_transparency/migration.sql>)
- [prisma/migrations/20260815000011_operational_crm_contracts_and_lifecycle/migration.sql](<../../prisma/migrations/20260815000011_operational_crm_contracts_and_lifecycle/migration.sql>)
- [prisma/migrations/20260816000012_service_approval_audit/migration.sql](<../../prisma/migrations/20260816000012_service_approval_audit/migration.sql>)
- [prisma/migrations/20260816000013_T032_deposits_preauth_and_damage_claims/migration.sql](<../../prisma/migrations/20260816000013_T032_deposits_preauth_and_damage_claims/migration.sql>)
- [prisma/migrations/20260818000014_booking_no_overlap_exclusion/migration.sql](<../../prisma/migrations/20260818000014_booking_no_overlap_exclusion/migration.sql>)
- [prisma/migrations/20260818000015_ownership_period/migration.sql](<../../prisma/migrations/20260818000015_ownership_period/migration.sql>)
- [prisma/migrations/20260818000016_immutable_financial_records/migration.sql](<../../prisma/migrations/20260818000016_immutable_financial_records/migration.sql>)
- [prisma/migrations/20260818000017_booking_party_composition/migration.sql](<../../prisma/migrations/20260818000017_booking_party_composition/migration.sql>)
- [prisma/migrations/20260818000018_guest_reviews/migration.sql](<../../prisma/migrations/20260818000018_guest_reviews/migration.sql>)
- [prisma/migrations/20260818000019_saved_units_and_searches/migration.sql](<../../prisma/migrations/20260818000019_saved_units_and_searches/migration.sql>)
- [prisma/migrations/20260818000020_area/migration.sql](<../../prisma/migrations/20260818000020_area/migration.sql>)
- [prisma/migrations/20260824000021_rls_every_table/migration.sql](<../../prisma/migrations/20260824000021_rls_every_table/migration.sql>)
- [prisma/migrations/20260824000022_bank_transfer_payments/migration.sql](<../../prisma/migrations/20260824000022_bank_transfer_payments/migration.sql>)
- [prisma/migrations/20260825044246_disputes/migration.sql](<../../prisma/migrations/20260825044246_disputes/migration.sql>)
- [prisma/migrations/20260825050000_dispute_rls/migration.sql](<../../prisma/migrations/20260825050000_dispute_rls/migration.sql>)
- [prisma/migrations/20260904000023_thread_context_statement/migration.sql](<../../prisma/migrations/20260904000023_thread_context_statement/migration.sql>)
- [prisma/migrations/20260904000024_service_order_fulfilled_at/migration.sql](<../../prisma/migrations/20260904000024_service_order_fulfilled_at/migration.sql>)
- [prisma/migrations/20260904060200_role_assignment_scope_constraints/migration.sql](<../../prisma/migrations/20260904060200_role_assignment_scope_constraints/migration.sql>)
- [prisma/migrations/20260904062200_relax_role_assignment_unit_scope_check/migration.sql](<../../prisma/migrations/20260904062200_relax_role_assignment_unit_scope_check/migration.sql>)
- [prisma/migrations/20260904130000_job_run_scheduler_health/migration.sql](<../../prisma/migrations/20260904130000_job_run_scheduler_health/migration.sql>)
- [prisma/migrations/20260905000025_drop_project_default_currency/migration.sql](<../../prisma/migrations/20260905000025_drop_project_default_currency/migration.sql>)
- [prisma/migrations/20260906000026_crm_opportunity_value_in_satang/migration.sql](<../../prisma/migrations/20260906000026_crm_opportunity_value_in_satang/migration.sql>)
- [prisma/migrations/20260907000000_canonical_property_data_system/migration.sql](<../../prisma/migrations/20260907000000_canonical_property_data_system/migration.sql>)
- [prisma/migrations/20260907001000_unit_project_coherence/migration.sql](<../../prisma/migrations/20260907001000_unit_project_coherence/migration.sql>)
- [prisma/migrations/20260907120000_fix_project_org_role_index_name/migration.sql](<../../prisma/migrations/20260907120000_fix_project_org_role_index_name/migration.sql>)
- [prisma/migrations/20260908000000_service_order_close_window/migration.sql](<../../prisma/migrations/20260908000000_service_order_close_window/migration.sql>)
- [prisma/migrations/20260908000100_service_order_closed_event/migration.sql](<../../prisma/migrations/20260908000100_service_order_closed_event/migration.sql>)
- [prisma/migrations/20260909062500_dispute_subject_concurrency_guard/migration.sql](<../../prisma/migrations/20260909062500_dispute_subject_concurrency_guard/migration.sql>)
- [prisma/migrations/20260909160000_canonical_commerce_federation_onboarding/migration.sql](<../../prisma/migrations/20260909160000_canonical_commerce_federation_onboarding/migration.sql>)
- [prisma/migrations/20260909161000_reschedule_hold_cleanup/migration.sql](<../../prisma/migrations/20260909161000_reschedule_hold_cleanup/migration.sql>)
- [prisma/migrations/20260909162000_seed_onboarding_templates/migration.sql](<../../prisma/migrations/20260909162000_seed_onboarding_templates/migration.sql>)
- [prisma/migrations/20260912000000_secure_canonical_v3_operational_tables/migration.sql](<../../prisma/migrations/20260912000000_secure_canonical_v3_operational_tables/migration.sql>)
- [prisma/migrations/20260912010000_payout_ledger_integrity/migration.sql](<../../prisma/migrations/20260912010000_payout_ledger_integrity/migration.sql>)
- [prisma/migrations/20260913100000_canonical_inventory_category_links/migration.sql](<../../prisma/migrations/20260913100000_canonical_inventory_category_links/migration.sql>)
- [prisma/migrations/20260913210000_canonical_inventory_bootstrap/migration.sql](<../../prisma/migrations/20260913210000_canonical_inventory_bootstrap/migration.sql>)
- [prisma/migrations/20260923043000_pin_inventory_trigger_search_path/migration.sql](<../../prisma/migrations/20260923043000_pin_inventory_trigger_search_path/migration.sql>)
- [prisma/migrations/20260924180000_refund_written_off_status/migration.sql](<../../prisma/migrations/20260924180000_refund_written_off_status/migration.sql>)
- [prisma/migrations/20260928090000_unified_domain_event_outbox/migration.sql](<../../prisma/migrations/20260928090000_unified_domain_event_outbox/migration.sql>)
- [prisma/migrations/20260928100000_layantara_private_snapshot/migration.sql](<../../prisma/migrations/20260928100000_layantara_private_snapshot/migration.sql>)
- [prisma/migrations/20260928183000_layantara_booking_cutover_guard/migration.sql](<../../prisma/migrations/20260928183000_layantara_booking_cutover_guard/migration.sql>)
- [prisma/migrations/20260928194500_layantara_catalog_content_and_rate_matrix/migration.sql](<../../prisma/migrations/20260928194500_layantara_catalog_content_and_rate_matrix/migration.sql>)
- [prisma/migrations/20260928201000_layantara_origin_photo_galleries/migration.sql](<../../prisma/migrations/20260928201000_layantara_origin_photo_galleries/migration.sql>)
- [prisma/migrations/20260928202000_project_staff_department_permissions/migration.sql](<../../prisma/migrations/20260928202000_project_staff_department_permissions/migration.sql>)
- [prisma/migrations/20260928203500_unit_commercial_offering_uniqueness/migration.sql](<../../prisma/migrations/20260928203500_unit_commercial_offering_uniqueness/migration.sql>)
- [prisma/migrations/20260928204500_private_unit_access_instructions/migration.sql](<../../prisma/migrations/20260928204500_private_unit_access_instructions/migration.sql>)
- [prisma/migrations/20260928210000_phuket_property_areas/migration.sql](<../../prisma/migrations/20260928210000_phuket_property_areas/migration.sql>)
- [prisma/migrations/20260928211000_layantara_draft_rental_offers/migration.sql](<../../prisma/migrations/20260928211000_layantara_draft_rental_offers/migration.sql>)
- [prisma/migrations/20260928212000_canonical_offering_type_alignment/migration.sql](<../../prisma/migrations/20260928212000_canonical_offering_type_alignment/migration.sql>)
- [prisma/migrations/20260928213000_layantara_staging_protection/migration.sql](<../../prisma/migrations/20260928213000_layantara_staging_protection/migration.sql>)
- [prisma/migrations/20260929090000_inventory_category_gallery/migration.sql](<../../prisma/migrations/20260929090000_inventory_category_gallery/migration.sql>)
- [prisma/migrations/20260929100000_project_structure_nodes/migration.sql](<../../prisma/migrations/20260929100000_project_structure_nodes/migration.sql>)
- [prisma/migrations/20260929110000_property_deal_agreements/migration.sql](<../../prisma/migrations/20260929110000_property_deal_agreements/migration.sql>)
- [prisma/migrations/20260930090000_project_amenity_experience/migration.sql](<../../prisma/migrations/20260930090000_project_amenity_experience/migration.sql>)
- [prisma/migrations/20260930120000_pin_trigger_function_search_path/migration.sql](<../../prisma/migrations/20260930120000_pin_trigger_function_search_path/migration.sql>)
- [prisma/migrations/20261002193000_pms_operational_tasks/migration.sql](<../../prisma/migrations/20261002193000_pms_operational_tasks/migration.sql>)
- [prisma/migrations/20261003070000_operating_spaces_foundation/migration.sql](<../../prisma/migrations/20261003070000_operating_spaces_foundation/migration.sql>)
- [prisma/migrations/20261003075000_pms_operational_task_enums/migration.sql](<../../prisma/migrations/20261003075000_pms_operational_task_enums/migration.sql>)
- [prisma/migrations/20261003080000_pms_operational_task_expansion/migration.sql](<../../prisma/migrations/20261003080000_pms_operational_task_expansion/migration.sql>)
- [prisma/migrations/20261003090000_reservation_groups/migration.sql](<../../prisma/migrations/20261003090000_reservation_groups/migration.sql>)
- [prisma/migrations/20261005120000_backfill_stay_offerings/migration.sql](<../../prisma/migrations/20261005120000_backfill_stay_offerings/migration.sql>)
- [prisma/migrations/20261005130000_project_portal_nearby_places/migration.sql](<../../prisma/migrations/20261005130000_project_portal_nearby_places/migration.sql>)
- [prisma/migrations/20261005134500_homepage_placements/migration.sql](<../../prisma/migrations/20261005134500_homepage_placements/migration.sql>)
- [prisma/migrations/20261005150000_homepage_funnel_events/migration.sql](<../../prisma/migrations/20261005150000_homepage_funnel_events/migration.sql>)
- [prisma/migrations/20261005170000_stitch_additive_gaps/migration.sql](<../../prisma/migrations/20261005170000_stitch_additive_gaps/migration.sql>)
- [prisma/migrations/20261006070000_layantara_public_content_normalization/migration.sql](<../../prisma/migrations/20261006070000_layantara_public_content_normalization/migration.sql>)
- [prisma/migrations/20261006090000_booking_channel_expedia_trip_com/migration.sql](<../../prisma/migrations/20261006090000_booking_channel_expedia_trip_com/migration.sql>)
- [prisma/migrations/20261008170000_booking_payment_method/migration.sql](<../../prisma/migrations/20261008170000_booking_payment_method/migration.sql>)
- [prisma/migrations/20261008173000_booking_creation_intent/migration.sql](<../../prisma/migrations/20261008173000_booking_creation_intent/migration.sql>)
- [prisma/migrations/20261008190000_payment_reconciliation/migration.sql](<../../prisma/migrations/20261008190000_payment_reconciliation/migration.sql>)
- [prisma/migrations/20261008193000_recoverable_checkout/migration.sql](<../../prisma/migrations/20261008193000_recoverable_checkout/migration.sql>)
- [prisma/migrations/20261010070000_manual_cost_integrity/migration.sql](<../../prisma/migrations/20261010070000_manual_cost_integrity/migration.sql>)
- [prisma/migrations/20261010102000_private_expense_receipts/migration.sql](<../../prisma/migrations/20261010102000_private_expense_receipts/migration.sql>)
- [prisma/migrations/20261010103000_statement_snapshot_lines/migration.sql](<../../prisma/migrations/20261010103000_statement_snapshot_lines/migration.sql>)
- [prisma/migrations/20261010104000_pin_finance_trigger_search_path/migration.sql](<../../prisma/migrations/20261010104000_pin_finance_trigger_search_path/migration.sql>)
- [prisma/migrations/20261012120000_secret_vault/migration.sql](<../../prisma/migrations/20261012120000_secret_vault/migration.sql>)
- [prisma/migrations/20261013100000_session_revocation/migration.sql](<../../prisma/migrations/20261013100000_session_revocation/migration.sql>)
- [prisma/migrations/20261013101000_rate_limit_bucket/migration.sql](<../../prisma/migrations/20261013101000_rate_limit_bucket/migration.sql>)
- [prisma/migrations/20261015010000_booking_receivable_review/migration.sql](<../../prisma/migrations/20261015010000_booking_receivable_review/migration.sql>)
- [prisma/migrations/20261015064143_content_contributor_role/migration.sql](<../../prisma/migrations/20261015064143_content_contributor_role/migration.sql>)
- [prisma/migrations/20261015070000_standalone_service_support/migration.sql](<../../prisma/migrations/20261015070000_standalone_service_support/migration.sql>)
- [prisma/migrations/20261015074000_unit_marketing_title_pointer/migration.sql](<../../prisma/migrations/20261015074000_unit_marketing_title_pointer/migration.sql>)
- [prisma/migrations/20261015080331_pricing_editor_role/migration.sql](<../../prisma/migrations/20261015080331_pricing_editor_role/migration.sql>)
- [prisma/migrations/20261015120347_property_capability_delegation/migration.sql](<../../prisma/migrations/20261015120347_property_capability_delegation/migration.sql>)
- [prisma/migrations/20261021010000_booking_refund_dispatch_authorization/migration.sql](<../../prisma/migrations/20261021010000_booking_refund_dispatch_authorization/migration.sql>)
- [prisma/migrations/20261021140000_sales_offer_desk/migration.sql](<../../prisma/migrations/20261021140000_sales_offer_desk/migration.sql>)

<a id="environment"></a>

## Переменные окружения: только имена и consumers

Значения, .env и credentials не читаются и не включаются. Список найден статически в app/scripts/workflows и .env.example; computed keys и внешние platform settings требуют ручной сверки. Наличие имени не означает обязательность или корректную config. VERCEL_* — также platform-provided metadata.

| Имя | Consumers |
|---|---|
| `ADMIN_FIRST_NAME` | [scripts/create-admin.mjs](<../../scripts/create-admin.mjs>) |
| `ADMIN_LAST_NAME` | [scripts/create-admin.mjs](<../../scripts/create-admin.mjs>) |
| `ADMIN_PASSWORD` | [scripts/create-admin.mjs](<../../scripts/create-admin.mjs>) |
| `ALERT_WEBHOOK_URL` | [src/lib/observability.ts](<../../src/lib/observability.ts>), [.env.example](<../../.env.example>) |
| `APP_BASE_URL` | [.github/workflows/scheduler.yml](<../../.github/workflows/scheduler.yml>) |
| `BACKUP_DATABASE_URL` | [scripts/backup-public-schema.mjs](<../../scripts/backup-public-schema.mjs>), [.github/workflows/backup.yml](<../../.github/workflows/backup.yml>), [.github/workflows/production-migration.yml](<../../.github/workflows/production-migration.yml>) |
| `BACKUP_PASSPHRASE` | [.github/workflows/backup.yml](<../../.github/workflows/backup.yml>), [.github/workflows/production-migration.yml](<../../.github/workflows/production-migration.yml>) |
| `BACKUP_S3_BUCKET` | [.github/workflows/backup.yml](<../../.github/workflows/backup.yml>) |
| `BACKUP_S3_KEY_ID` | [.github/workflows/backup.yml](<../../.github/workflows/backup.yml>) |
| `BACKUP_S3_REGION` | [.github/workflows/backup.yml](<../../.github/workflows/backup.yml>) |
| `BACKUP_S3_SECRET` | [.github/workflows/backup.yml](<../../.github/workflows/backup.yml>) |
| `BACKUP_VERIFIED_SHA` | [scripts/production-migrate.mjs](<../../scripts/production-migrate.mjs>) |
| `BLOB_READ_WRITE_TOKEN` | [src/modules/crm/private-deal-evidence.ts](<../../src/modules/crm/private-deal-evidence.ts>), [src/modules/media/direct-upload.service.ts](<../../src/modules/media/direct-upload.service.ts>), [src/modules/media/storage-config.ts](<../../src/modules/media/storage-config.ts>), [scripts/import-managed-yandex-media.ts](<../../scripts/import-managed-yandex-media.ts>), [scripts/layantara-rehost-photos.ts](<../../scripts/layantara-rehost-photos.ts>), [.env.example](<../../.env.example>) |
| `BLOB_STORE_ID` | [src/modules/media/direct-upload.service.ts](<../../src/modules/media/direct-upload.service.ts>), [src/modules/media/storage-config.ts](<../../src/modules/media/storage-config.ts>), [scripts/import-managed-yandex-media.ts](<../../scripts/import-managed-yandex-media.ts>), [.env.example](<../../.env.example>) |
| `BROWSER_HEAD_SHA` | [scripts/e2e/complex-amenities.mjs](<../../scripts/e2e/complex-amenities.mjs>), [scripts/e2e/content-contributor.mjs](<../../scripts/e2e/content-contributor.mjs>), [scripts/e2e/employee-creation.mjs](<../../scripts/e2e/employee-creation.mjs>), [scripts/e2e/employee-workspaces.mjs](<../../scripts/e2e/employee-workspaces.mjs>), [scripts/e2e/founder-publication-booking.mjs](<../../scripts/e2e/founder-publication-booking.mjs>), [scripts/e2e/guest-ux-completion.mjs](<../../scripts/e2e/guest-ux-completion.mjs>), [scripts/e2e/next-migration-smoke.mjs](<../../scripts/e2e/next-migration-smoke.mjs>), [scripts/e2e/project-amenity-content.mjs](<../../scripts/e2e/project-amenity-content.mjs>), [scripts/e2e/property-card-editing.mjs](<../../scripts/e2e/property-card-editing.mjs>), [scripts/e2e/property-submission-description.mjs](<../../scripts/e2e/property-submission-description.mjs>), [scripts/e2e/sales-offer.mjs](<../../scripts/e2e/sales-offer.mjs>), [scripts/e2e/search-map.mjs](<../../scripts/e2e/search-map.mjs>), [scripts/e2e/service-fulfilment.mjs](<../../scripts/e2e/service-fulfilment.mjs>), [scripts/e2e/workspace-navigation.mjs](<../../scripts/e2e/workspace-navigation.mjs>) |
| `CHROMIUM_EXECUTABLE_PATH` | [scripts/e2e/property-card-editing.mjs](<../../scripts/e2e/property-card-editing.mjs>) |
| `CHROMIUM_PATH` | [scripts/e2e/sales-offer.mjs](<../../scripts/e2e/sales-offer.mjs>) |
| `CI` | [scripts/content-review-gate-policy.mjs](<../../scripts/content-review-gate-policy.mjs>) |
| `CONTENT_REVIEW_GATE_ENABLED` | [scripts/content-review-gate-policy.mjs](<../../scripts/content-review-gate-policy.mjs>), [.env.example](<../../.env.example>) |
| `CRON_SECRET` | [src/jobs/auth.ts](<../../src/jobs/auth.ts>), [.github/workflows/scheduler.yml](<../../.github/workflows/scheduler.yml>), [.env.example](<../../.env.example>) |
| `DATABASE_CONNECTION_LIMIT` | [src/lib/resolveDatabaseUrl.ts](<../../src/lib/resolveDatabaseUrl.ts>) |
| `DATABASE_POOLER_HOST` | [src/lib/resolveDatabaseUrl.ts](<../../src/lib/resolveDatabaseUrl.ts>), [scripts/production-migration-policy.mjs](<../../scripts/production-migration-policy.mjs>), [.github/workflows/production-migration.yml](<../../.github/workflows/production-migration.yml>) |
| `DATABASE_URL` | [src/app/api/auth/login/route.ts](<../../src/app/api/auth/login/route.ts>), [src/app/api/auth/register/route.ts](<../../src/app/api/auth/register/route.ts>), [src/app/api/auth/reset-password/route.ts](<../../src/app/api/auth/reset-password/route.ts>), [src/lib/prisma.ts](<../../src/lib/prisma.ts>), [scripts/content-review-gate-policy.mjs](<../../scripts/content-review-gate-policy.mjs>), [scripts/create-admin.mjs](<../../scripts/create-admin.mjs>), [scripts/db-verify.mjs](<../../scripts/db-verify.mjs>), [scripts/e2e/isolation.cjs](<../../scripts/e2e/isolation.cjs>), [scripts/production-migrate.mjs](<../../scripts/production-migrate.mjs>), [scripts/production-migration-preflight.mjs](<../../scripts/production-migration-preflight.mjs>), [scripts/provision-database.mjs](<../../scripts/provision-database.mjs>), [scripts/rehearse-isolated-recovery.ts](<../../scripts/rehearse-isolated-recovery.ts>), [scripts/repair-failed-migrations.mjs](<../../scripts/repair-failed-migrations.mjs>), [scripts/test-db-connection.mjs](<../../scripts/test-db-connection.mjs>), [.github/workflows/production-migration.yml](<../../.github/workflows/production-migration.yml>), [.env.example](<../../.env.example>) |
| `DATABASE_URL_TEST` | [src/test/util.ts](<../../src/test/util.ts>), [scripts/content-review-gate-policy.mjs](<../../scripts/content-review-gate-policy.mjs>), [scripts/e2e/isolation.cjs](<../../scripts/e2e/isolation.cjs>), [scripts/rehearse-isolated-recovery.ts](<../../scripts/rehearse-isolated-recovery.ts>), [.env.example](<../../.env.example>) |
| `EMAIL_FROM` | [src/modules/auth/email.ts](<../../src/modules/auth/email.ts>), [src/modules/comms/email.seam.ts](<../../src/modules/comms/email.seam.ts>), [.env.example](<../../.env.example>) |
| `ENCRYPTION_KEY` | [src/lib/encryption.ts](<../../src/lib/encryption.ts>), [src/lib/launch-readiness.ts](<../../src/lib/launch-readiness.ts>), [src/modules/crm/private-deal-evidence.ts](<../../src/modules/crm/private-deal-evidence.ts>), [scripts/e2e/isolation.cjs](<../../scripts/e2e/isolation.cjs>), [.env.example](<../../.env.example>) |
| `GITHUB_OUTPUT` | [.github/workflows/production-migration.yml](<../../.github/workflows/production-migration.yml>) |
| `GITHUB_REF` | [scripts/production-migrate.mjs](<../../scripts/production-migrate.mjs>), [scripts/production-migration-preflight.mjs](<../../scripts/production-migration-preflight.mjs>) |
| `GITHUB_SHA` | [scripts/e2e/founder-publication-booking.mjs](<../../scripts/e2e/founder-publication-booking.mjs>), [scripts/production-migrate.mjs](<../../scripts/production-migrate.mjs>), [scripts/production-migration-preflight.mjs](<../../scripts/production-migration-preflight.mjs>) |
| `GITHUB_STEP_SUMMARY` | [scripts/backup-public-schema.mjs](<../../scripts/backup-public-schema.mjs>) |
| `GOOGLE_CLIENT_SECRET` | [src/app/api/auth/callback/google/route.ts](<../../src/app/api/auth/callback/google/route.ts>), [.env.example](<../../.env.example>) |
| `ICAL_FEED_SECRET` | [src/modules/integrations/ical-token.ts](<../../src/modules/integrations/ical-token.ts>), [.env.example](<../../.env.example>) |
| `LAYANTARA_MEDIA_WRITE` | [scripts/layantara-rehost-photos.ts](<../../scripts/layantara-rehost-photos.ts>) |
| `LAYANTARA_PROTECTION_INTAKE_ENABLED` | [src/app/api/integrations/layantara/events/route.ts](<../../src/app/api/integrations/layantara/events/route.ts>), [.env.example](<../../.env.example>) |
| `LAYANTARA_WEBHOOK_SECRET` | [src/app/api/integrations/layantara/events/route.ts](<../../src/app/api/integrations/layantara/events/route.ts>), [.env.example](<../../.env.example>) |
| `LOG_SILENT` | [src/lib/observability.ts](<../../src/lib/observability.ts>), [.env.example](<../../.env.example>) |
| `MEDIA_IMPORT_TOKEN` | [src/app/api/cron/import-managed-yandex-media/route.ts](<../../src/app/api/cron/import-managed-yandex-media/route.ts>) |
| `MIGRATION_DATABASE_HOST` | [scripts/production-migration-policy.mjs](<../../scripts/production-migration-policy.mjs>) |
| `MYUNO_BROWSER_ACCEPTANCE` | [scripts/content-review-gate-policy.mjs](<../../scripts/content-review-gate-policy.mjs>), [scripts/e2e/isolation.cjs](<../../scripts/e2e/isolation.cjs>) |
| `MYUNO_RECOVERY_REHEARSAL` | [scripts/rehearse-isolated-recovery.ts](<../../scripts/rehearse-isolated-recovery.ts>) |
| `NEXT_PUBLIC_APP_URL` | [src/lib/launch-readiness.ts](<../../src/lib/launch-readiness.ts>), [.env.example](<../../.env.example>) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | [src/app/api/auth/callback/google/route.ts](<../../src/app/api/auth/callback/google/route.ts>), [src/app/login/google-login-button.tsx](<../../src/app/login/google-login-button.tsx>), [src/app/login/login-form.tsx](<../../src/app/login/login-form.tsx>), [.env.example](<../../.env.example>) |
| `NEXT_PUBLIC_MYUNO_DESTINATION` | [src/modules/destinations/index.ts](<../../src/modules/destinations/index.ts>) |
| `NEXT_PUBLIC_VERCEL_BLOB_API_URL` | [src/modules/media/direct-upload.service.ts](<../../src/modules/media/direct-upload.service.ts>) |
| `NEXTAUTH_SECRET` | [src/lib/launch-readiness.ts](<../../src/lib/launch-readiness.ts>), [src/modules/auth/session.ts](<../../src/modules/auth/session.ts>), [src/modules/booking/category-quote.ts](<../../src/modules/booking/category-quote.ts>), [src/modules/integrations/ical-token.ts](<../../src/modules/integrations/ical-token.ts>), [src/modules/media/direct-upload.service.ts](<../../src/modules/media/direct-upload.service.ts>), [scripts/e2e/isolation.cjs](<../../scripts/e2e/isolation.cjs>), [scripts/e2e/sales-offer.mjs](<../../scripts/e2e/sales-offer.mjs>), [.env.example](<../../.env.example>) |
| `NEXTAUTH_URL` | [src/app/api/admin/people/invite/route.ts](<../../src/app/api/admin/people/invite/route.ts>), [src/app/api/auth/callback/google/route.ts](<../../src/app/api/auth/callback/google/route.ts>), [src/app/api/auth/claim/generate-link/route.ts](<../../src/app/api/auth/claim/generate-link/route.ts>), [src/app/api/auth/guest-access/route.ts](<../../src/app/api/auth/guest-access/route.ts>), [src/app/libs/bookingCancelled.ts](<../../src/app/libs/bookingCancelled.ts>), [src/app/libs/bookingConfirmed.ts](<../../src/app/libs/bookingConfirmed.ts>), [src/lib/seo.ts](<../../src/lib/seo.ts>), [src/modules/auth/auth.ts](<../../src/modules/auth/auth.ts>), [src/modules/booking/booking.service.ts](<../../src/modules/booking/booking.service.ts>), [src/modules/booking/lifecycle.jobs.ts](<../../src/modules/booking/lifecycle.jobs.ts>), [src/modules/booking/notify-modified.ts](<../../src/modules/booking/notify-modified.ts>), [src/modules/booking/notify-request-reminder.ts](<../../src/modules/booking/notify-request-reminder.ts>), [src/modules/booking/notify-requested.ts](<../../src/modules/booking/notify-requested.ts>), [src/modules/finance/finance.service.ts](<../../src/modules/finance/finance.service.ts>), [src/modules/projects/notify-owner-stay.ts](<../../src/modules/projects/notify-owner-stay.ts>), [src/modules/services/notify-order-reminder.ts](<../../src/modules/services/notify-order-reminder.ts>), [scripts/e2e/isolation.cjs](<../../scripts/e2e/isolation.cjs>), [.env.example](<../../.env.example>) |
| `NODE_ENV` | [src/app/api/auth/login/route.ts](<../../src/app/api/auth/login/route.ts>), [src/app/api/auth/register/route.ts](<../../src/app/api/auth/register/route.ts>), [src/app/api/auth/reset-password/route.ts](<../../src/app/api/auth/reset-password/route.ts>), [src/app/global-error.tsx](<../../src/app/global-error.tsx>), [src/lib/launch-readiness.ts](<../../src/lib/launch-readiness.ts>), [src/lib/prisma.ts](<../../src/lib/prisma.ts>), [src/middleware.ts](<../../src/middleware.ts>), [src/modules/auth/session.ts](<../../src/modules/auth/session.ts>), [src/modules/booking/category-quote.ts](<../../src/modules/booking/category-quote.ts>), [src/modules/content/content.hook.ts](<../../src/modules/content/content.hook.ts>), [src/modules/content/content.service.ts](<../../src/modules/content/content.service.ts>), [src/modules/finance/finance.service.ts](<../../src/modules/finance/finance.service.ts>), [src/modules/finance/providers/index.ts](<../../src/modules/finance/providers/index.ts>), [src/modules/integrations/ical-token.ts](<../../src/modules/integrations/ical-token.ts>), [src/modules/media/direct-upload.service.ts](<../../src/modules/media/direct-upload.service.ts>), [src/modules/media/media.service.ts](<../../src/modules/media/media.service.ts>), [scripts/content-review-gate-policy.mjs](<../../scripts/content-review-gate-policy.mjs>), [scripts/import-managed-yandex-media.ts](<../../scripts/import-managed-yandex-media.ts>) |
| `OMISE_PUBLIC_KEY` | [src/modules/finance/providers/index.ts](<../../src/modules/finance/providers/index.ts>), [.env.example](<../../.env.example>) |
| `OMISE_SECRET_KEY` | [src/lib/launch-readiness.ts](<../../src/lib/launch-readiness.ts>), [src/modules/finance/providers/index.ts](<../../src/modules/finance/providers/index.ts>), [scripts/rehearse-isolated-recovery.ts](<../../scripts/rehearse-isolated-recovery.ts>), [.env.example](<../../.env.example>) |
| `OMISE_WEBHOOK_SECRET` | [src/modules/finance/providers/index.ts](<../../src/modules/finance/providers/index.ts>), [.env.example](<../../.env.example>) |
| `PAYMENT_PROVIDER` | [src/app/api/webhooks/opn/route.ts](<../../src/app/api/webhooks/opn/route.ts>), [src/lib/launch-readiness.ts](<../../src/lib/launch-readiness.ts>), [src/modules/finance/finance.service.ts](<../../src/modules/finance/finance.service.ts>), [src/modules/finance/providers/index.ts](<../../src/modules/finance/providers/index.ts>), [scripts/rehearse-isolated-recovery.ts](<../../scripts/rehearse-isolated-recovery.ts>), [.env.example](<../../.env.example>) |
| `PG_DUMP_BIN` | [scripts/backup-public-schema.mjs](<../../scripts/backup-public-schema.mjs>) |
| `PG_RESTORE_BIN` | [scripts/backup-public-schema.mjs](<../../scripts/backup-public-schema.mjs>) |
| `PGDATABASE` | [scripts/backup-public-schema.mjs](<../../scripts/backup-public-schema.mjs>) |
| `PROPERTY_EDITING_SERVER_MODE` | [scripts/e2e/property-card-editing.mjs](<../../scripts/e2e/property-card-editing.mjs>) |
| `PSQL_BIN` | [scripts/backup-public-schema.mjs](<../../scripts/backup-public-schema.mjs>) |
| `READONLY_DATABASE_URL` | [scripts/production-migration-preflight.mjs](<../../scripts/production-migration-preflight.mjs>) |
| `RECOVERY_HEAD_SHA` | [scripts/rehearse-isolated-recovery.ts](<../../scripts/rehearse-isolated-recovery.ts>) |
| `RESEND_API_KEY` | [src/app/api/admin/people/invite/route.ts](<../../src/app/api/admin/people/invite/route.ts>), [src/modules/auth/auth.ts](<../../src/modules/auth/auth.ts>), [src/modules/auth/email.ts](<../../src/modules/auth/email.ts>), [src/modules/comms/email.seam.ts](<../../src/modules/comms/email.seam.ts>), [.env.example](<../../.env.example>) |
| `SCHEDULER_MODE` | [src/jobs/registry.ts](<../../src/jobs/registry.ts>), [src/lib/launch-readiness.ts](<../../src/lib/launch-readiness.ts>), [.env.example](<../../.env.example>) |
| `SCRATCH_DATABASE_URL` | [scripts/backup-public-schema.mjs](<../../scripts/backup-public-schema.mjs>) |
| `SESSION_SECRET` | [src/lib/launch-readiness.ts](<../../src/lib/launch-readiness.ts>), [src/modules/auth/session.ts](<../../src/modules/auth/session.ts>), [src/modules/booking/category-quote.ts](<../../src/modules/booking/category-quote.ts>), [src/modules/integrations/ical-token.ts](<../../src/modules/integrations/ical-token.ts>), [src/modules/media/direct-upload.service.ts](<../../src/modules/media/direct-upload.service.ts>), [scripts/e2e/sales-offer.mjs](<../../scripts/e2e/sales-offer.mjs>), [.env.example](<../../.env.example>) |
| `SUPABASE_PROJECT_REF` | [src/lib/resolveDatabaseUrl.ts](<../../src/lib/resolveDatabaseUrl.ts>) |
| `UNIFIED_BOOKING_INTAKE_ENABLED` | [src/app/api/integrations/layantara/events/route.ts](<../../src/app/api/integrations/layantara/events/route.ts>), [.env.example](<../../.env.example>) |
| `UNIFIED_CHANNEL_ENVIRONMENT` | [src/app/api/integrations/layantara/events/route.ts](<../../src/app/api/integrations/layantara/events/route.ts>), [.env.example](<../../.env.example>) |
| `VERCEL` | [src/modules/media/direct-upload.service.ts](<../../src/modules/media/direct-upload.service.ts>) |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | [.github/workflows/scheduler.yml](<../../.github/workflows/scheduler.yml>) |
| `VERCEL_BLOB_API_URL` | [src/modules/media/direct-upload.service.ts](<../../src/modules/media/direct-upload.service.ts>) |
| `VERCEL_ENV` | [src/modules/media/direct-upload.service.ts](<../../src/modules/media/direct-upload.service.ts>), [scripts/content-review-gate-policy.mjs](<../../scripts/content-review-gate-policy.mjs>) |
| `VERCEL_OIDC_TOKEN` | [src/modules/media/storage-config.ts](<../../src/modules/media/storage-config.ts>), [scripts/import-managed-yandex-media.ts](<../../scripts/import-managed-yandex-media.ts>) |
| `VERCEL_PROJECT_ID` | [src/modules/media/direct-upload.service.ts](<../../src/modules/media/direct-upload.service.ts>) |
| `VERCEL_TARGET_ENV` | [src/modules/media/direct-upload.service.ts](<../../src/modules/media/direct-upload.service.ts>), [scripts/content-review-gate-policy.mjs](<../../scripts/content-review-gate-policy.mjs>) |
| `VERCEL_URL` | [src/modules/media/direct-upload.service.ts](<../../src/modules/media/direct-upload.service.ts>) |

## Все тестовые файлы

Это список файлов, не результат запуска. Дополнительные node:test suites лежат в scripts и вызываются CI.

- [src/app/(admin)/app/admin/access/workspace-access-client.test.tsx](<../../src/app/(admin)/app/admin/access/workspace-access-client.test.tsx>)
- [src/app/(admin)/app/admin/admin-nav-is-reachable.test.ts](<../../src/app/(admin)/app/admin/admin-nav-is-reachable.test.ts>)
- [src/app/(admin)/app/admin/content/content-client.id.test.tsx](<../../src/app/(admin)/app/admin/content/content-client.id.test.tsx>)
- [src/app/(admin)/app/admin/content/page.key.test.tsx](<../../src/app/(admin)/app/admin/content/page.key.test.tsx>)
- [src/app/(admin)/app/admin/crm/crm-tokens.test.ts](<../../src/app/(admin)/app/admin/crm/crm-tokens.test.ts>)
- [src/app/(admin)/app/admin/crm/pipeline-client.test.tsx](<../../src/app/(admin)/app/admin/crm/pipeline-client.test.tsx>)
- [src/app/(admin)/app/admin/launch-readiness/page.test.tsx](<../../src/app/(admin)/app/admin/launch-readiness/page.test.tsx>)
- [src/app/(admin)/app/admin/people/content-contributor-copy.test.ts](<../../src/app/(admin)/app/admin/people/content-contributor-copy.test.ts>)
- [src/app/(admin)/app/admin/people/content-contributor-role.test.tsx](<../../src/app/(admin)/app/admin/people/content-contributor-role.test.tsx>)
- [src/app/(admin)/app/admin/people/people-client.search.test.tsx](<../../src/app/(admin)/app/admin/people/people-client.search.test.tsx>)
- [src/app/(admin)/app/admin/people/pricing-editor-role.test.tsx](<../../src/app/(admin)/app/admin/people/pricing-editor-role.test.tsx>)
- [src/app/(admin)/app/admin/people/property-authority.test.tsx](<../../src/app/(admin)/app/admin/people/property-authority.test.tsx>)
- [src/app/(admin)/app/admin/projects/[id]/experience/project-experience-client.test.tsx](<../../src/app/(admin)/app/admin/projects/[id]/experience/project-experience-client.test.tsx>)
- [src/app/(admin)/app/admin/properties/[id]/onboarding/gallery-navigation.test.tsx](<../../src/app/(admin)/app/admin/properties/[id]/onboarding/gallery-navigation.test.tsx>)
- [src/app/(admin)/app/admin/properties/[id]/onboarding/property-onboarding-client.test.tsx](<../../src/app/(admin)/app/admin/properties/[id]/onboarding/property-onboarding-client.test.tsx>)
- [src/app/(admin)/app/admin/property-content-proposals/review-client.test.tsx](<../../src/app/(admin)/app/admin/property-content-proposals/review-client.test.tsx>)
- [src/app/(admin)/app/admin/property-submissions/convert-client.test.tsx](<../../src/app/(admin)/app/admin/property-submissions/convert-client.test.tsx>)
- [src/app/(admin)/app/admin/units/[id]/booking-mode-client.test.tsx](<../../src/app/(admin)/app/admin/units/[id]/booking-mode-client.test.tsx>)
- [src/app/(admin)/app/admin/units/[id]/onboarding-client.test.tsx](<../../src/app/(admin)/app/admin/units/[id]/onboarding-client.test.tsx>)
- [src/app/(admin)/app/admin/units/[id]/tariff-editor-client.test.tsx](<../../src/app/(admin)/app/admin/units/[id]/tariff-editor-client.test.tsx>)
- [src/app/(admin)/app/admin/units/[id]/tariff-preview-client.test.tsx](<../../src/app/(admin)/app/admin/units/[id]/tariff-preview-client.test.tsx>)
- [src/app/(admin)/app/admin/units/create-unit-form.test.tsx](<../../src/app/(admin)/app/admin/units/create-unit-form.test.tsx>)
- [src/app/(admin)/app/admin/units/page.access.test.tsx](<../../src/app/(admin)/app/admin/units/page.access.test.tsx>)
- [src/app/(admin)/app/admin/units/units-client.publish.test.tsx](<../../src/app/(admin)/app/admin/units/units-client.publish.test.tsx>)
- [src/app/(public)/connected-homepage.test.ts](<../../src/app/(public)/connected-homepage.test.ts>)
- [src/app/(public)/help/emergency/page.test.tsx](<../../src/app/(public)/help/emergency/page.test.tsx>)
- [src/app/(public)/landing-tokens.test.ts](<../../src/app/(public)/landing-tokens.test.ts>)
- [src/app/(public)/projects/[slug]/amenities/[amenitySlug]/book/page.test.tsx](<../../src/app/(public)/projects/[slug]/amenities/[amenitySlug]/book/page.test.tsx>)
- [src/app/(public)/projects/project-plurals.test.tsx](<../../src/app/(public)/projects/project-plurals.test.tsx>)
- [src/app/(public)/projects/satangToThb.test.ts](<../../src/app/(public)/projects/satangToThb.test.ts>)
- [src/app/(public)/server-client-boundary.test.ts](<../../src/app/(public)/server-client-boundary.test.ts>)
- [src/app/actions/session-identity.test.ts](<../../src/app/actions/session-identity.test.ts>)
- [src/app/api/admin/categories/[id]/media/route.integration.test.ts](<../../src/app/api/admin/categories/[id]/media/route.integration.test.ts>)
- [src/app/api/admin/compliance-checklists/checklists.integration.test.ts](<../../src/app/api/admin/compliance-checklists/checklists.integration.test.ts>)
- [src/app/api/admin/contracts/contracts.integration.test.ts](<../../src/app/api/admin/contracts/contracts.integration.test.ts>)
- [src/app/api/admin/crm/profiles/__tests__/transition.integration.test.ts](<../../src/app/api/admin/crm/profiles/__tests__/transition.integration.test.ts>)
- [src/app/api/admin/deposits.integration.test.ts](<../../src/app/api/admin/deposits.integration.test.ts>)
- [src/app/api/admin/incidents/incidents.integration.test.ts](<../../src/app/api/admin/incidents/incidents.integration.test.ts>)
- [src/app/api/admin/layantara/reservations-import/route.test.ts](<../../src/app/api/admin/layantara/reservations-import/route.test.ts>)
- [src/app/api/admin/operating-spaces/route.integration.test.ts](<../../src/app/api/admin/operating-spaces/route.integration.test.ts>)
- [src/app/api/admin/operational-kpis/operational-kpis.integration.test.ts](<../../src/app/api/admin/operational-kpis/operational-kpis.integration.test.ts>)
- [src/app/api/admin/organizations/organizations.integration.test.ts](<../../src/app/api/admin/organizations/organizations.integration.test.ts>)
- [src/app/api/admin/payouts/payouts.integration.test.ts](<../../src/app/api/admin/payouts/payouts.integration.test.ts>)
- [src/app/api/admin/people/invite/route.test.ts](<../../src/app/api/admin/people/invite/route.test.ts>)
- [src/app/api/admin/projects/[id]/amenities/[amenityId]/route.test.ts](<../../src/app/api/admin/projects/[id]/amenities/[amenityId]/route.test.ts>)
- [src/app/api/admin/projects/[id]/catalog/catalog-booking-journey.integration.test.ts](<../../src/app/api/admin/projects/[id]/catalog/catalog-booking-journey.integration.test.ts>)
- [src/app/api/admin/prospecting/prospecting.integration.test.ts](<../../src/app/api/admin/prospecting/prospecting.integration.test.ts>)
- [src/app/api/admin/reports/attribution/attribution.integration.test.ts](<../../src/app/api/admin/reports/attribution/attribution.integration.test.ts>)
- [src/app/api/admin/roles/units/route.test.ts](<../../src/app/api/admin/roles/units/route.test.ts>)
- [src/app/api/admin/secrets/route.integration.test.ts](<../../src/app/api/admin/secrets/route.integration.test.ts>)
- [src/app/api/admin/service-orders/service-orders.integration.test.ts](<../../src/app/api/admin/service-orders/service-orders.integration.test.ts>)
- [src/app/api/admin/services/services.integration.test.ts](<../../src/app/api/admin/services/services.integration.test.ts>)
- [src/app/api/admin/statements/__tests__/generate.integration.test.ts](<../../src/app/api/admin/statements/__tests__/generate.integration.test.ts>)
- [src/app/api/admin/units/[id]/tariff-preview/route.test.ts](<../../src/app/api/admin/units/[id]/tariff-preview/route.test.ts>)
- [src/app/api/admin/units/[id]/tariff/route.test.ts](<../../src/app/api/admin/units/[id]/tariff/route.test.ts>)
- [src/app/api/admin/units/__tests__/status.integration.test.ts](<../../src/app/api/admin/units/__tests__/status.integration.test.ts>)
- [src/app/api/admin/units/creation-boundary.test.ts](<../../src/app/api/admin/units/creation-boundary.test.ts>)
- [src/app/api/admin/units/onboarding.integration.test.ts](<../../src/app/api/admin/units/onboarding.integration.test.ts>)
- [src/app/api/admin/units/portfolio-scope.integration.test.ts](<../../src/app/api/admin/units/portfolio-scope.integration.test.ts>)
- [src/app/api/analytics/public/route.integration.test.ts](<../../src/app/api/analytics/public/route.integration.test.ts>)
- [src/app/api/auth/callback/google/route.integration.test.ts](<../../src/app/api/auth/callback/google/route.integration.test.ts>)
- [src/app/api/auth/callback/google/route.race.test.ts](<../../src/app/api/auth/callback/google/route.race.test.ts>)
- [src/app/api/auth/callback/google/route.test.ts](<../../src/app/api/auth/callback/google/route.test.ts>)
- [src/app/api/auth/guest-access/route.integration.test.ts](<../../src/app/api/auth/guest-access/route.integration.test.ts>)
- [src/app/api/auth/login/route.integration.test.ts](<../../src/app/api/auth/login/route.integration.test.ts>)
- [src/app/api/bookings/[id]/bookings-id.integration.test.ts](<../../src/app/api/bookings/[id]/bookings-id.integration.test.ts>)
- [src/app/api/bookings/[id]/cancel/cancel.integration.test.ts](<../../src/app/api/bookings/[id]/cancel/cancel.integration.test.ts>)
- [src/app/api/bookings/[id]/cancel/payment-race.integration.test.ts](<../../src/app/api/bookings/[id]/cancel/payment-race.integration.test.ts>)
- [src/app/api/bookings/[id]/cancel/recovery.integration.test.ts](<../../src/app/api/bookings/[id]/cancel/recovery.integration.test.ts>)
- [src/app/api/bookings/[id]/checkin/checkin-gate.integration.test.ts](<../../src/app/api/bookings/[id]/checkin/checkin-gate.integration.test.ts>)
- [src/app/api/bookings/[id]/confirm-unpaid/confirm-unpaid.integration.test.ts](<../../src/app/api/bookings/[id]/confirm-unpaid/confirm-unpaid.integration.test.ts>)
- [src/app/api/bookings/[id]/guests/authorization.test.ts](<../../src/app/api/bookings/[id]/guests/authorization.test.ts>)
- [src/app/api/bookings/[id]/modify/modify.integration.test.ts](<../../src/app/api/bookings/[id]/modify/modify.integration.test.ts>)
- [src/app/api/bookings/[id]/ops-authorization.integration.test.ts](<../../src/app/api/bookings/[id]/ops-authorization.integration.test.ts>)
- [src/app/api/bookings/[id]/record-cash-payment/record-cash-payment.integration.test.ts](<../../src/app/api/bookings/[id]/record-cash-payment/record-cash-payment.integration.test.ts>)
- [src/app/api/bookings/[id]/record-transfer/authorization.test.ts](<../../src/app/api/bookings/[id]/record-transfer/authorization.test.ts>)
- [src/app/api/bookings/[id]/transfer-instructions/route.integration.test.ts](<../../src/app/api/bookings/[id]/transfer-instructions/route.integration.test.ts>)
- [src/app/api/bookings/[id]/verify-passports/route.integration.test.ts](<../../src/app/api/bookings/[id]/verify-passports/route.integration.test.ts>)
- [src/app/api/bookings/acceptance.integration.test.ts](<../../src/app/api/bookings/acceptance.integration.test.ts>)
- [src/app/api/bookings/acceptance.test.ts](<../../src/app/api/bookings/acceptance.test.ts>)
- [src/app/api/bookings/category-allocation.integration.test.ts](<../../src/app/api/bookings/category-allocation.integration.test.ts>)
- [src/app/api/bookings/checkout-policy.integration.test.ts](<../../src/app/api/bookings/checkout-policy.integration.test.ts>)
- [src/app/api/bookings/checkout-recovery.integration.test.ts](<../../src/app/api/bookings/checkout-recovery.integration.test.ts>)
- [src/app/api/bookings/condition-transition.integration.test.ts](<../../src/app/api/bookings/condition-transition.integration.test.ts>)
- [src/app/api/bookings/idempotency.integration.test.ts](<../../src/app/api/bookings/idempotency.integration.test.ts>)
- [src/app/api/bookings/me/bookings-me.integration.test.ts](<../../src/app/api/bookings/me/bookings-me.integration.test.ts>)
- [src/app/api/bookings/payment-methods.integration.test.ts](<../../src/app/api/bookings/payment-methods.integration.test.ts>)
- [src/app/api/bookings/project-derivation.integration.test.ts](<../../src/app/api/bookings/project-derivation.integration.test.ts>)
- [src/app/api/bookings/rate-limit.integration.test.ts](<../../src/app/api/bookings/rate-limit.integration.test.ts>)
- [src/app/api/bookings/tm30-guest-race.integration.test.ts](<../../src/app/api/bookings/tm30-guest-race.integration.test.ts>)
- [src/app/api/checkout/[sessionId]/checkout-session.integration.test.ts](<../../src/app/api/checkout/[sessionId]/checkout-session.integration.test.ts>)
- [src/app/api/health/route.integration.test.ts](<../../src/app/api/health/route.integration.test.ts>)
- [src/app/api/leads/inquiry-loop.integration.test.ts](<../../src/app/api/leads/inquiry-loop.integration.test.ts>)
- [src/app/api/leads/leads-rate-limit.integration.test.ts](<../../src/app/api/leads/leads-rate-limit.integration.test.ts>)
- [src/app/api/ledger/record-cost/record-cost.integration.test.ts](<../../src/app/api/ledger/record-cost/record-cost.integration.test.ts>)
- [src/app/api/mc/fee-report/fee-report.integration.test.ts](<../../src/app/api/mc/fee-report/fee-report.integration.test.ts>)
- [src/app/api/media/upload/route.test.ts](<../../src/app/api/media/upload/route.test.ts>)
- [src/app/api/ops/reservation-groups/route.integration.test.ts](<../../src/app/api/ops/reservation-groups/route.integration.test.ts>)
- [src/app/api/ops/team/route.integration.test.ts](<../../src/app/api/ops/team/route.integration.test.ts>)
- [src/app/api/owner/statements/[statementId]/question/route.integration.test.ts](<../../src/app/api/owner/statements/[statementId]/question/route.integration.test.ts>)
- [src/app/api/owner/statements/[statementId]/sign-off/__tests__/sign-off.integration.test.ts](<../../src/app/api/owner/statements/[statementId]/sign-off/__tests__/sign-off.integration.test.ts>)
- [src/app/api/owner/statements/route.test.ts](<../../src/app/api/owner/statements/route.test.ts>)
- [src/app/api/pricing/breakdown/annual-lease.integration.test.ts](<../../src/app/api/pricing/breakdown/annual-lease.integration.test.ts>)
- [src/app/api/pricing/breakdown/pricing-breakdown.integration.test.ts](<../../src/app/api/pricing/breakdown/pricing-breakdown.integration.test.ts>)
- [src/app/api/pricing/category-quote/selection.test.ts](<../../src/app/api/pricing/category-quote/selection.test.ts>)
- [src/app/api/property-access/route.test.ts](<../../src/app/api/property-access/route.test.ts>)
- [src/app/api/property-booking-mode/[unitId]/route.test.ts](<../../src/app/api/property-booking-mode/[unitId]/route.test.ts>)
- [src/app/api/property-content-proposals/content-proposals-route.test.ts](<../../src/app/api/property-content-proposals/content-proposals-route.test.ts>)
- [src/app/api/property-submissions/property-submissions.integration.test.ts](<../../src/app/api/property-submissions/property-submissions.integration.test.ts>)
- [src/app/api/property-submissions/submission-description-route.test.ts](<../../src/app/api/property-submissions/submission-description-route.test.ts>)
- [src/app/api/provider/portal.integration.test.ts](<../../src/app/api/provider/portal.integration.test.ts>)
- [src/app/api/refunds/[id]/settle/route.integration.test.ts](<../../src/app/api/refunds/[id]/settle/route.integration.test.ts>)
- [src/app/api/saved/units/route.test.ts](<../../src/app/api/saved/units/route.test.ts>)
- [src/app/api/search/units/empty-db.integration.test.ts](<../../src/app/api/search/units/empty-db.integration.test.ts>)
- [src/app/api/search/units/price-filter.integration.test.ts](<../../src/app/api/search/units/price-filter.integration.test.ts>)
- [src/app/api/search/units/route.integration.test.ts](<../../src/app/api/search/units/route.integration.test.ts>)
- [src/app/api/search/units/sort.integration.test.ts](<../../src/app/api/search/units/sort.integration.test.ts>)
- [src/app/api/search/units/unquotable-units.integration.test.ts](<../../src/app/api/search/units/unquotable-units.integration.test.ts>)
- [src/app/api/service-orders/[id]/cancel/mc-authorization.integration.test.ts](<../../src/app/api/service-orders/[id]/cancel/mc-authorization.integration.test.ts>)
- [src/app/api/service-orders/[id]/lifecycle.integration.test.ts](<../../src/app/api/service-orders/[id]/lifecycle.integration.test.ts>)
- [src/app/api/service-orders/[id]/rate/rate.integration.test.ts](<../../src/app/api/service-orders/[id]/rate/rate.integration.test.ts>)
- [src/app/api/service-orders/[id]/record-cash-payment/mc-authorization.integration.test.ts](<../../src/app/api/service-orders/[id]/record-cash-payment/mc-authorization.integration.test.ts>)
- [src/app/api/service-orders/content-contributor-boundary.test.ts](<../../src/app/api/service-orders/content-contributor-boundary.test.ts>)
- [src/app/api/service-orders/multi-project-context.integration.test.ts](<../../src/app/api/service-orders/multi-project-context.integration.test.ts>)
- [src/app/api/services/route.integration.test.ts](<../../src/app/api/services/route.integration.test.ts>)
- [src/app/api/spine/spine.integration.test.ts](<../../src/app/api/spine/spine.integration.test.ts>)
- [src/app/api/threads/[threadId]/stream/statement-access.test.ts](<../../src/app/api/threads/[threadId]/stream/statement-access.test.ts>)
- [src/app/api/threads/booking-thread-scope.test.ts](<../../src/app/api/threads/booking-thread-scope.test.ts>)
- [src/app/api/threads/threads-intent.integration.test.ts](<../../src/app/api/threads/threads-intent.integration.test.ts>)
- [src/app/api/tickets/[id]/mc-scope.integration.test.ts](<../../src/app/api/tickets/[id]/mc-scope.integration.test.ts>)
- [src/app/api/tickets/[id]/route.integration.test.ts](<../../src/app/api/tickets/[id]/route.integration.test.ts>)
- [src/app/api/tickets/content-contributor-boundary.test.ts](<../../src/app/api/tickets/content-contributor-boundary.test.ts>)
- [src/app/api/tickets/standalone-scope.integration.test.ts](<../../src/app/api/tickets/standalone-scope.integration.test.ts>)
- [src/app/api/tm30/[id]/scoping.integration.test.ts](<../../src/app/api/tm30/[id]/scoping.integration.test.ts>)
- [src/app/api/tm30/queue/route.integration.test.ts](<../../src/app/api/tm30/queue/route.integration.test.ts>)
- [src/app/api/units/[unitId]/ical/export/ical-export.integration.test.ts](<../../src/app/api/units/[unitId]/ical/export/ical-export.integration.test.ts>)
- [src/app/api/units/[unitId]/media-readiness.integration.test.ts](<../../src/app/api/units/[unitId]/media-readiness.integration.test.ts>)
- [src/app/api/units/[unitId]/unit-detail.integration.test.ts](<../../src/app/api/units/[unitId]/unit-detail.integration.test.ts>)
- [src/app/app/employee-creation-entry.test.tsx](<../../src/app/app/employee-creation-entry.test.tsx>)
- [src/app/auth/claim/claim-client.test.tsx](<../../src/app/auth/claim/claim-client.test.tsx>)
- [src/app/book/review/page.booking-display.test.tsx](<../../src/app/book/review/page.booking-display.test.tsx>)
- [src/app/book/review/review-client.test.tsx](<../../src/app/book/review/review-client.test.tsx>)
- [src/app/bookings/[bookingId]/home-space/stay-home-tokens.test.ts](<../../src/app/bookings/[bookingId]/home-space/stay-home-tokens.test.ts>)
- [src/app/buying/buying-tokens.test.ts](<../../src/app/buying/buying-tokens.test.ts>)
- [src/app/checkout/[sessionId]/reconciliation.test.tsx](<../../src/app/checkout/[sessionId]/reconciliation.test.tsx>)
- [src/app/component-islands.test.ts](<../../src/app/component-islands.test.ts>)
- [src/app/content-keys-seeded.test.ts](<../../src/app/content-keys-seeded.test.ts>)
- [src/app/homes/stitch-long-term-surface.test.ts](<../../src/app/homes/stitch-long-term-surface.test.ts>)
- [src/app/jsx-pattern-escape.test.ts](<../../src/app/jsx-pattern-escape.test.ts>)
- [src/app/layout-fonts.test.ts](<../../src/app/layout-fonts.test.ts>)
- [src/app/libs/bookingAccess.test.ts](<../../src/app/libs/bookingAccess.test.ts>)
- [src/app/libs/bookingConfirmed.integration.test.ts](<../../src/app/libs/bookingConfirmed.integration.test.ts>)
- [src/app/libs/bookingGuestDataAccess.test.ts](<../../src/app/libs/bookingGuestDataAccess.test.ts>)
- [src/app/libs/bookingOperationsAccess.test.ts](<../../src/app/libs/bookingOperationsAccess.test.ts>)
- [src/app/libs/projectScope.integration.test.ts](<../../src/app/libs/projectScope.integration.test.ts>)
- [src/app/libs/projectScope.null-project.test.ts](<../../src/app/libs/projectScope.null-project.test.ts>)
- [src/app/libs/projectScope.test.ts](<../../src/app/libs/projectScope.test.ts>)
- [src/app/libs/rateLimit.failure.test.ts](<../../src/app/libs/rateLimit.failure.test.ts>)
- [src/app/libs/rateLimit.integration.test.ts](<../../src/app/libs/rateLimit.integration.test.ts>)
- [src/app/libs/supplierListingAccess.test.ts](<../../src/app/libs/supplierListingAccess.test.ts>)
- [src/app/login/booking-return.test.tsx](<../../src/app/login/booking-return.test.tsx>)
- [src/app/login/guest-return-pages.test.tsx](<../../src/app/login/guest-return-pages.test.tsx>)
- [src/app/messages/[threadId]/thread-client.test.tsx](<../../src/app/messages/[threadId]/thread-client.test.tsx>)
- [src/app/money-display-boundary.test.ts](<../../src/app/money-display-boundary.test.ts>)
- [src/app/ops/calendar/board/page.boundary.test.tsx](<../../src/app/ops/calendar/board/page.boundary.test.tsx>)
- [src/app/ops/calendar/board/page.integration.test.tsx](<../../src/app/ops/calendar/board/page.integration.test.tsx>)
- [src/app/ops/costs/record-cost-client.date.test.tsx](<../../src/app/ops/costs/record-cost-client.date.test.tsx>)
- [src/app/ops/costs/record-cost-client.test.tsx](<../../src/app/ops/costs/record-cost-client.test.tsx>)
- [src/app/ops/ops-tokens.test.ts](<../../src/app/ops/ops-tokens.test.ts>)
- [src/app/ops/page.date.test.tsx](<../../src/app/ops/page.date.test.tsx>)
- [src/app/ops/spaces/access-boundary.integration.test.tsx](<../../src/app/ops/spaces/access-boundary.integration.test.tsx>)
- [src/app/ops/stays/page.navigation.test.tsx](<../../src/app/ops/stays/page.navigation.test.tsx>)
- [src/app/ops/tasks/page.navigation.test.tsx](<../../src/app/ops/tasks/page.navigation.test.tsx>)
- [src/app/owner/owner-tokens.test.ts](<../../src/app/owner/owner-tokens.test.ts>)
- [src/app/owner/portfolio-scope.test.ts](<../../src/app/owner/portfolio-scope.test.ts>)
- [src/app/owner/statements/[statementId]/__tests__/page.integration.test.ts](<../../src/app/owner/statements/[statementId]/__tests__/page.integration.test.ts>)
- [src/app/owner/statements/[statementId]/client.receipt.test.tsx](<../../src/app/owner/statements/[statementId]/client.receipt.test.tsx>)
- [src/app/owner/statements/[statementId]/client.test.tsx](<../../src/app/owner/statements/[statementId]/client.test.tsx>)
- [src/app/pms-touch-targets.test.ts](<../../src/app/pms-touch-targets.test.ts>)
- [src/app/premium-design-parity.test.ts](<../../src/app/premium-design-parity.test.ts>)
- [src/app/project-space-media-capability.test.ts](<../../src/app/project-space-media-capability.test.ts>)
- [src/app/property-stitch-composition.test.ts](<../../src/app/property-stitch-composition.test.ts>)
- [src/app/property/access/access-client.test.tsx](<../../src/app/property/access/access-client.test.tsx>)
- [src/app/property/content/amenity-ui.test.tsx](<../../src/app/property/content/amenity-ui.test.tsx>)
- [src/app/property/content/content-client.test.tsx](<../../src/app/property/content/content-client.test.tsx>)
- [src/app/property/content/content-copy.test.tsx](<../../src/app/property/content/content-copy.test.tsx>)
- [src/app/property/create/creation-client.test.tsx](<../../src/app/property/create/creation-client.test.tsx>)
- [src/app/property/employee-creation-navigation.test.tsx](<../../src/app/property/employee-creation-navigation.test.tsx>)
- [src/app/property/listings/page.test.tsx](<../../src/app/property/listings/page.test.tsx>)
- [src/app/property/onboard/wizard.blockers.test.tsx](<../../src/app/property/onboard/wizard.blockers.test.tsx>)
- [src/app/property/onboard/wizard.locale.test.tsx](<../../src/app/property/onboard/wizard.locale.test.tsx>)
- [src/app/property/property-locale-wiring.test.ts](<../../src/app/property/property-locale-wiring.test.ts>)
- [src/app/property/workspace-nav.test.tsx](<../../src/app/property/workspace-nav.test.tsx>)
- [src/app/provider/provider-orders-client.test.tsx](<../../src/app/provider/provider-orders-client.test.tsx>)
- [src/app/provider/services/services-client.test.tsx](<../../src/app/provider/services/services-client.test.tsx>)
- [src/app/reachability.test.ts](<../../src/app/reachability.test.ts>)
- [src/app/remaining-boards-tokens.test.ts](<../../src/app/remaining-boards-tokens.test.ts>)
- [src/app/search/page.layout.test.tsx](<../../src/app/search/page.layout.test.tsx>)
- [src/app/search/search-results.category.test.tsx](<../../src/app/search/search-results.category.test.tsx>)
- [src/app/services/[id]/order-preview.test.ts](<../../src/app/services/[id]/order-preview.test.ts>)
- [src/app/services/[id]/order-wizard.context.test.tsx](<../../src/app/services/[id]/order-wizard.context.test.tsx>)
- [src/app/services/[id]/price-label.test.ts](<../../src/app/services/[id]/price-label.test.ts>)
- [src/app/services/[id]/service-context.test.ts](<../../src/app/services/[id]/service-context.test.ts>)
- [src/app/services/orders/[orderId]/order-money.test.ts](<../../src/app/services/orders/[orderId]/order-money.test.ts>)
- [src/app/services/orders/[orderId]/order-timeline.test.ts](<../../src/app/services/orders/[orderId]/order-timeline.test.ts>)
- [src/app/services/services-client.money.test.ts](<../../src/app/services/services-client.money.test.ts>)
- [src/app/services/services-client.recovery.test.tsx](<../../src/app/services/services-client.recovery.test.tsx>)
- [src/app/specified-surfaces.test.ts](<../../src/app/specified-surfaces.test.ts>)
- [src/app/stitch-surface-coverage.test.ts](<../../src/app/stitch-surface-coverage.test.ts>)
- [src/app/tickets/new/new-ticket-client.test.tsx](<../../src/app/tickets/new/new-ticket-client.test.tsx>)
- [src/app/trips/[id]/booking-client.unpaid.test.tsx](<../../src/app/trips/[id]/booking-client.unpaid.test.tsx>)
- [src/app/trips/[id]/payment-recovery.test.tsx](<../../src/app/trips/[id]/payment-recovery.test.tsx>)
- [src/app/trips/trips-list.pagination.test.tsx](<../../src/app/trips/trips-list.pagination.test.tsx>)
- [src/app/units/[id]/page.booking-display.test.tsx](<../../src/app/units/[id]/page.booking-display.test.tsx>)
- [src/app/units/[id]/page.plurals.test.tsx](<../../src/app/units/[id]/page.plurals.test.tsx>)
- [src/app/units/[id]/unit-client.booking-mode.test.tsx](<../../src/app/units/[id]/unit-client.booking-mode.test.tsx>)
- [src/app/units/public-sleeping-boundary.test.ts](<../../src/app/units/public-sleeping-boundary.test.ts>)
- [src/components/BookingSteps.test.tsx](<../../src/components/BookingSteps.test.tsx>)
- [src/components/Button.test.tsx](<../../src/components/Button.test.tsx>)
- [src/components/Chip.test.tsx](<../../src/components/Chip.test.tsx>)
- [src/components/DiscoverySearch.test.tsx](<../../src/components/DiscoverySearch.test.tsx>)
- [src/components/FeedbackLink.test.tsx](<../../src/components/FeedbackLink.test.tsx>)
- [src/components/FieldAccessibility.test.tsx](<../../src/components/FieldAccessibility.test.tsx>)
- [src/components/Input.test.tsx](<../../src/components/Input.test.tsx>)
- [src/components/LeadForm.test.tsx](<../../src/components/LeadForm.test.tsx>)
- [src/components/MoneyAmount.test.tsx](<../../src/components/MoneyAmount.test.tsx>)
- [src/components/Navbar.test.tsx](<../../src/components/Navbar.test.tsx>)
- [src/components/NotificationBell.test.tsx](<../../src/components/NotificationBell.test.tsx>)
- [src/components/OwnerEvidenceDraftEditor.test.tsx](<../../src/components/OwnerEvidenceDraftEditor.test.tsx>)
- [src/components/Placeholder.test.tsx](<../../src/components/Placeholder.test.tsx>)
- [src/components/RoleContextBanner.test.tsx](<../../src/components/RoleContextBanner.test.tsx>)
- [src/components/SearchBar.test.tsx](<../../src/components/SearchBar.test.tsx>)
- [src/components/ServiceCategoryIcon.test.tsx](<../../src/components/ServiceCategoryIcon.test.tsx>)
- [src/components/UnitPhotoMosaic.test.tsx](<../../src/components/UnitPhotoMosaic.test.tsx>)
- [src/components/WorkspaceNavigation.test.tsx](<../../src/components/WorkspaceNavigation.test.tsx>)
- [src/components/footer-labels.test.ts](<../../src/components/footer-labels.test.ts>)
- [src/components/home/EcosystemEntry.test.tsx](<../../src/components/home/EcosystemEntry.test.tsx>)
- [src/components/home/HomeOffersRail.plurals.test.tsx](<../../src/components/home/HomeOffersRail.plurals.test.tsx>)
- [src/components/instay/ActiveOrdersList.test.tsx](<../../src/components/instay/ActiveOrdersList.test.tsx>)
- [src/components/instay/ServicesRail.test.tsx](<../../src/components/instay/ServicesRail.test.tsx>)
- [src/components/navigation-prefetch.test.ts](<../../src/components/navigation-prefetch.test.ts>)
- [src/components/ops/ManualReservationForm.test.tsx](<../../src/components/ops/ManualReservationForm.test.tsx>)
- [src/components/ops/OperationalTaskCreateForm.test.tsx](<../../src/components/ops/OperationalTaskCreateForm.test.tsx>)
- [src/components/ops/OperationalTaskQueueClient.timezone.test.tsx](<../../src/components/ops/OperationalTaskQueueClient.timezone.test.tsx>)
- [src/components/ops/ReservationGroupForm.test.tsx](<../../src/components/ops/ReservationGroupForm.test.tsx>)
- [src/components/ops/StayActions.unpaid.test.tsx](<../../src/components/ops/StayActions.unpaid.test.tsx>)
- [src/components/ops/UnifiedStayCalendar.test.tsx](<../../src/components/ops/UnifiedStayCalendar.test.tsx>)
- [src/components/primitives.test.tsx](<../../src/components/primitives.test.tsx>)
- [src/components/projects/AmenityHoursEditor.test.tsx](<../../src/components/projects/AmenityHoursEditor.test.tsx>)
- [src/components/projects/UnitProjectAmenities.test.tsx](<../../src/components/projects/UnitProjectAmenities.test.tsx>)
- [src/components/property/SaveHomeButton.test.tsx](<../../src/components/property/SaveHomeButton.test.tsx>)
- [src/components/property/ScopedGalleryEditor.test.tsx](<../../src/components/property/ScopedGalleryEditor.test.tsx>)
- [src/components/property/ShareStayOffer.test.tsx](<../../src/components/property/ShareStayOffer.test.tsx>)
- [src/components/property/SimilarAvailableHomes.test.tsx](<../../src/components/property/SimilarAvailableHomes.test.tsx>)
- [src/components/property/property-editing.test.tsx](<../../src/components/property/property-editing.test.tsx>)
- [src/components/search/SearchResultsMap.lifecycle.test.tsx](<../../src/components/search/SearchResultsMap.lifecycle.test.tsx>)
- [src/components/stitch/ApplicationFrame.test.tsx](<../../src/components/stitch/ApplicationFrame.test.tsx>)
- [src/components/stitch/McWorkspaceShell.test.tsx](<../../src/components/stitch/McWorkspaceShell.test.tsx>)
- [src/components/stitch/StitchShells.test.tsx](<../../src/components/stitch/StitchShells.test.tsx>)
- [src/components/units/AvailabilityPricingPanel.test.tsx](<../../src/components/units/AvailabilityPricingPanel.test.tsx>)
- [src/components/units/PublicSleepingSummary.test.tsx](<../../src/components/units/PublicSleepingSummary.test.tsx>)
- [src/components/units/UnitPublicationPanel.test.tsx](<../../src/components/units/UnitPublicationPanel.test.tsx>)
- [src/components/viz/viz.test.tsx](<../../src/components/viz/viz.test.tsx>)
- [src/jobs/health.test.ts](<../../src/jobs/health.test.ts>)
- [src/jobs/record.integration.test.ts](<../../src/jobs/record.integration.test.ts>)
- [src/lib/csv.test.ts](<../../src/lib/csv.test.ts>)
- [src/lib/date.test.ts](<../../src/lib/date.test.ts>)
- [src/lib/design-token-scale.test.ts](<../../src/lib/design-token-scale.test.ts>)
- [src/lib/design-tokens.test.ts](<../../src/lib/design-tokens.test.ts>)
- [src/lib/example.test.ts](<../../src/lib/example.test.ts>)
- [src/lib/format-date.test.ts](<../../src/lib/format-date.test.ts>)
- [src/lib/format.test.ts](<../../src/lib/format.test.ts>)
- [src/lib/guest-journey.test.ts](<../../src/lib/guest-journey.test.ts>)
- [src/lib/launch-readiness.data.test.ts](<../../src/lib/launch-readiness.data.test.ts>)
- [src/lib/launch-readiness.test.ts](<../../src/lib/launch-readiness.test.ts>)
- [src/lib/local-date-time.test.ts](<../../src/lib/local-date-time.test.ts>)
- [src/lib/money.test.ts](<../../src/lib/money.test.ts>)
- [src/lib/observability.test.ts](<../../src/lib/observability.test.ts>)
- [src/lib/place-search.test.ts](<../../src/lib/place-search.test.ts>)
- [src/lib/plus-code.test.ts](<../../src/lib/plus-code.test.ts>)
- [src/lib/pms-navigation.test.ts](<../../src/lib/pms-navigation.test.ts>)
- [src/lib/property-area.test.ts](<../../src/lib/property-area.test.ts>)
- [src/lib/property-count.test.ts](<../../src/lib/property-count.test.ts>)
- [src/lib/property-editor-return.test.ts](<../../src/lib/property-editor-return.test.ts>)
- [src/lib/resolveDatabaseUrl.test.ts](<../../src/lib/resolveDatabaseUrl.test.ts>)
- [src/lib/safe-next-path.test.ts](<../../src/lib/safe-next-path.test.ts>)
- [src/lib/seo.test.ts](<../../src/lib/seo.test.ts>)
- [src/lib/session-access.test.ts](<../../src/lib/session-access.test.ts>)
- [src/lib/session-generation.integration.test.ts](<../../src/lib/session-generation.integration.test.ts>)
- [src/lib/session.revocation.integration.test.ts](<../../src/lib/session.revocation.integration.test.ts>)
- [src/lib/spacing-scale.test.ts](<../../src/lib/spacing-scale.test.ts>)
- [src/lib/status.test.ts](<../../src/lib/status.test.ts>)
- [src/lib/stitch-surface.test.ts](<../../src/lib/stitch-surface.test.ts>)
- [src/lib/workspace-navigation-server.test.ts](<../../src/lib/workspace-navigation-server.test.ts>)
- [src/lib/workspace-navigation.test.ts](<../../src/lib/workspace-navigation.test.ts>)
- [src/middleware.direct-upload.test.ts](<../../src/middleware.direct-upload.test.ts>)
- [src/middleware.test.ts](<../../src/middleware.test.ts>)
- [src/modules/analytics/analytics.integration.test.ts](<../../src/modules/analytics/analytics.integration.test.ts>)
- [src/modules/analytics/buyer-interest.integration.test.ts](<../../src/modules/analytics/buyer-interest.integration.test.ts>)
- [src/modules/analytics/event-keys.test.ts](<../../src/modules/analytics/event-keys.test.ts>)
- [src/modules/analytics/reports.service.integration.test.ts](<../../src/modules/analytics/reports.service.integration.test.ts>)
- [src/modules/analytics/rollup-money.test.ts](<../../src/modules/analytics/rollup-money.test.ts>)
- [src/modules/analytics/signals.integration.test.ts](<../../src/modules/analytics/signals.integration.test.ts>)
- [src/modules/audit/audit-query.integration.test.ts](<../../src/modules/audit/audit-query.integration.test.ts>)
- [src/modules/audit/audit-write-failure.integration.test.ts](<../../src/modules/audit/audit-write-failure.integration.test.ts>)
- [src/modules/audit/audit.integration.test.ts](<../../src/modules/audit/audit.integration.test.ts>)
- [src/modules/auth/auth.integration.test.ts](<../../src/modules/auth/auth.integration.test.ts>)
- [src/modules/auth/session-races.integration.test.ts](<../../src/modules/auth/session-races.integration.test.ts>)
- [src/modules/auth/session.test.ts](<../../src/modules/auth/session.test.ts>)
- [src/modules/booking/accepted-booking-mode.integration.test.ts](<../../src/modules/booking/accepted-booking-mode.integration.test.ts>)
- [src/modules/booking/approval-selection.test.ts](<../../src/modules/booking/approval-selection.test.ts>)
- [src/modules/booking/blocked-dates.integration.test.ts](<../../src/modules/booking/blocked-dates.integration.test.ts>)
- [src/modules/booking/booking-acceptance.test.ts](<../../src/modules/booking/booking-acceptance.test.ts>)
- [src/modules/booking/booking.service.integration.test.ts](<../../src/modules/booking/booking.service.integration.test.ts>)
- [src/modules/booking/calendar-projection.test.ts](<../../src/modules/booking/calendar-projection.test.ts>)
- [src/modules/booking/cancellation-config.integration.test.ts](<../../src/modules/booking/cancellation-config.integration.test.ts>)
- [src/modules/booking/cancellation.test.ts](<../../src/modules/booking/cancellation.test.ts>)
- [src/modules/booking/category-quote.test.ts](<../../src/modules/booking/category-quote.test.ts>)
- [src/modules/booking/check-in-gate.test.ts](<../../src/modules/booking/check-in-gate.test.ts>)
- [src/modules/booking/confirm-unpaid.integration.test.ts](<../../src/modules/booking/confirm-unpaid.integration.test.ts>)
- [src/modules/booking/date-change.integration.test.ts](<../../src/modules/booking/date-change.integration.test.ts>)
- [src/modules/booking/double-booking.concurrency.integration.test.ts](<../../src/modules/booking/double-booking.concurrency.integration.test.ts>)
- [src/modules/booking/expiry-winning-transition.integration.test.ts](<../../src/modules/booking/expiry-winning-transition.integration.test.ts>)
- [src/modules/booking/extension-safety.integration.test.ts](<../../src/modules/booking/extension-safety.integration.test.ts>)
- [src/modules/booking/guest-date-boundaries.integration.test.ts](<../../src/modules/booking/guest-date-boundaries.integration.test.ts>)
- [src/modules/booking/guest-journey-context.test.ts](<../../src/modules/booking/guest-journey-context.test.ts>)
- [src/modules/booking/guest-review.integration.test.ts](<../../src/modules/booking/guest-review.integration.test.ts>)
- [src/modules/booking/home-space.integration.test.ts](<../../src/modules/booking/home-space.integration.test.ts>)
- [src/modules/booking/lifecycle.jobs.integration.test.ts](<../../src/modules/booking/lifecycle.jobs.integration.test.ts>)
- [src/modules/booking/manual-payment-occupancy.integration.test.ts](<../../src/modules/booking/manual-payment-occupancy.integration.test.ts>)
- [src/modules/booking/notify-modified.integration.test.ts](<../../src/modules/booking/notify-modified.integration.test.ts>)
- [src/modules/booking/notify-request-reminder.integration.test.ts](<../../src/modules/booking/notify-request-reminder.integration.test.ts>)
- [src/modules/booking/notify-requested.integration.test.ts](<../../src/modules/booking/notify-requested.integration.test.ts>)
- [src/modules/booking/outstanding-balance.test.ts](<../../src/modules/booking/outstanding-balance.test.ts>)
- [src/modules/booking/party-composition.integration.test.ts](<../../src/modules/booking/party-composition.integration.test.ts>)
- [src/modules/booking/pms-readiness.test.ts](<../../src/modules/booking/pms-readiness.test.ts>)
- [src/modules/booking/pms-transition-races.integration.test.ts](<../../src/modules/booking/pms-transition-races.integration.test.ts>)
- [src/modules/booking/request-inbox-enrichment.integration.test.ts](<../../src/modules/booking/request-inbox-enrichment.integration.test.ts>)
- [src/modules/booking/reservation-desk.test.ts](<../../src/modules/booking/reservation-desk.test.ts>)
- [src/modules/booking/revenue-tariff-engine.test.ts](<../../src/modules/booking/revenue-tariff-engine.test.ts>)
- [src/modules/booking/season-cancellation.integration.test.ts](<../../src/modules/booking/season-cancellation.integration.test.ts>)
- [src/modules/booking/source-party.integration.test.ts](<../../src/modules/booking/source-party.integration.test.ts>)
- [src/modules/booking/state-machine-is-wired.test.ts](<../../src/modules/booking/state-machine-is-wired.test.ts>)
- [src/modules/booking/stay-review.integration.test.ts](<../../src/modules/booking/stay-review.integration.test.ts>)
- [src/modules/booking/timing-config.test.ts](<../../src/modules/booking/timing-config.test.ts>)
- [src/modules/booking/work-projection.test.ts](<../../src/modules/booking/work-projection.test.ts>)
- [src/modules/browse/amenity-filters.test.ts](<../../src/modules/browse/amenity-filters.test.ts>)
- [src/modules/browse/bounds.test.ts](<../../src/modules/browse/bounds.test.ts>)
- [src/modules/browse/saved.integration.test.ts](<../../src/modules/browse/saved.integration.test.ts>)
- [src/modules/browse/sort.test.ts](<../../src/modules/browse/sort.test.ts>)
- [src/modules/comms/announcement-reach.integration.test.ts](<../../src/modules/comms/announcement-reach.integration.test.ts>)
- [src/modules/comms/announcement.service.integration.test.ts](<../../src/modules/comms/announcement.service.integration.test.ts>)
- [src/modules/comms/delivery-truth.integration.test.ts](<../../src/modules/comms/delivery-truth.integration.test.ts>)
- [src/modules/comms/dispute.service.integration.test.ts](<../../src/modules/comms/dispute.service.integration.test.ts>)
- [src/modules/comms/email.seam.test.ts](<../../src/modules/comms/email.seam.test.ts>)
- [src/modules/comms/inquiry-nonactive-participant.integration.test.ts](<../../src/modules/comms/inquiry-nonactive-participant.integration.test.ts>)
- [src/modules/comms/inquiry-thread-access.integration.test.ts](<../../src/modules/comms/inquiry-thread-access.integration.test.ts>)
- [src/modules/comms/inquiry-thread-access.test.ts](<../../src/modules/comms/inquiry-thread-access.test.ts>)
- [src/modules/comms/lead.service.integration.test.ts](<../../src/modules/comms/lead.service.integration.test.ts>)
- [src/modules/comms/messenger-delivery.integration.test.ts](<../../src/modules/comms/messenger-delivery.integration.test.ts>)
- [src/modules/comms/notification-delivery.integration.test.ts](<../../src/modules/comms/notification-delivery.integration.test.ts>)
- [src/modules/comms/statement-thread-access.test.ts](<../../src/modules/comms/statement-thread-access.test.ts>)
- [src/modules/comms/thread.service.integration.test.ts](<../../src/modules/comms/thread.service.integration.test.ts>)
- [src/modules/comms/ticket.service.integration.test.ts](<../../src/modules/comms/ticket.service.integration.test.ts>)
- [src/modules/compliance/commercial-eligibility.engine.test.ts](<../../src/modules/compliance/commercial-eligibility.engine.test.ts>)
- [src/modules/compliance/regulatory-credential.integration.test.ts](<../../src/modules/compliance/regulatory-credential.integration.test.ts>)
- [src/modules/compliance/sale-authority.integration.test.ts](<../../src/modules/compliance/sale-authority.integration.test.ts>)
- [src/modules/config/booking-windows.test.ts](<../../src/modules/config/booking-windows.test.ts>)
- [src/modules/config/catalog.integration.test.ts](<../../src/modules/config/catalog.integration.test.ts>)
- [src/modules/config/config-barrel-imports.test.ts](<../../src/modules/config/config-barrel-imports.test.ts>)
- [src/modules/config/config.test.ts](<../../src/modules/config/config.test.ts>)
- [src/modules/config/edit.service.integration.test.ts](<../../src/modules/config/edit.service.integration.test.ts>)
- [src/modules/config/secret-vault.service.integration.test.ts](<../../src/modules/config/secret-vault.service.integration.test.ts>)
- [src/modules/content/content.test.ts](<../../src/modules/content/content.test.ts>)
- [src/modules/content/edit.service.integration.test.ts](<../../src/modules/content/edit.service.integration.test.ts>)
- [src/modules/content/homepage-v4.seed.test.ts](<../../src/modules/content/homepage-v4.seed.test.ts>)
- [src/modules/content/key-coverage.test.ts](<../../src/modules/content/key-coverage.test.ts>)
- [src/modules/content/locale-draft-fallback.test.ts](<../../src/modules/content/locale-draft-fallback.test.ts>)
- [src/modules/content/pms-trilingual.test.ts](<../../src/modules/content/pms-trilingual.test.ts>)
- [src/modules/content/property-category-ui-locale.test.tsx](<../../src/modules/content/property-category-ui-locale.test.tsx>)
- [src/modules/content/property-ui-locale.test.ts](<../../src/modules/content/property-ui-locale.test.ts>)
- [src/modules/content/workspace-navigation.seed.test.ts](<../../src/modules/content/workspace-navigation.seed.test.ts>)
- [src/modules/core/access-enforcement.test.ts](<../../src/modules/core/access-enforcement.test.ts>)
- [src/modules/core/account.integration.test.ts](<../../src/modules/core/account.integration.test.ts>)
- [src/modules/core/authority.alias.test.ts](<../../src/modules/core/authority.alias.test.ts>)
- [src/modules/core/availability-overrides.integration.test.ts](<../../src/modules/core/availability-overrides.integration.test.ts>)
- [src/modules/core/availability.service.test.ts](<../../src/modules/core/availability.service.test.ts>)
- [src/modules/core/booking-occupancy.test.ts](<../../src/modules/core/booking-occupancy.test.ts>)
- [src/modules/core/canonical-calendar-rate.test.ts](<../../src/modules/core/canonical-calendar-rate.test.ts>)
- [src/modules/core/canonical-pricing.integration.test.ts](<../../src/modules/core/canonical-pricing.integration.test.ts>)
- [src/modules/core/claim-concurrency.integration.test.ts](<../../src/modules/core/claim-concurrency.integration.test.ts>)
- [src/modules/core/claim-purpose.integration.test.ts](<../../src/modules/core/claim-purpose.integration.test.ts>)
- [src/modules/core/claim-safety.test.ts](<../../src/modules/core/claim-safety.test.ts>)
- [src/modules/core/commercial-booking-terms.test.ts](<../../src/modules/core/commercial-booking-terms.test.ts>)
- [src/modules/core/compliance.integration.test.ts](<../../src/modules/core/compliance.integration.test.ts>)
- [src/modules/core/content-contributor-legacy.test.ts](<../../src/modules/core/content-contributor-legacy.test.ts>)
- [src/modules/core/content-contributor-role.integration.test.ts](<../../src/modules/core/content-contributor-role.integration.test.ts>)
- [src/modules/core/content-contributor-role.test.ts](<../../src/modules/core/content-contributor-role.test.ts>)
- [src/modules/core/engagement.integration.test.ts](<../../src/modules/core/engagement.integration.test.ts>)
- [src/modules/core/invite.integration.test.ts](<../../src/modules/core/invite.integration.test.ts>)
- [src/modules/core/landing.test.ts](<../../src/modules/core/landing.test.ts>)
- [src/modules/core/layantara.seed.integration.test.ts](<../../src/modules/core/layantara.seed.integration.test.ts>)
- [src/modules/core/manual-block-retries.integration.test.ts](<../../src/modules/core/manual-block-retries.integration.test.ts>)
- [src/modules/core/manual-block-retries.test.ts](<../../src/modules/core/manual-block-retries.test.ts>)
- [src/modules/core/mc-member-unit-scope.integration.test.ts](<../../src/modules/core/mc-member-unit-scope.integration.test.ts>)
- [src/modules/core/people.service.integration.test.ts](<../../src/modules/core/people.service.integration.test.ts>)
- [src/modules/core/permissions-action-coverage.test.ts](<../../src/modules/core/permissions-action-coverage.test.ts>)
- [src/modules/core/permissions-active-identity.test.ts](<../../src/modules/core/permissions-active-identity.test.ts>)
- [src/modules/core/permissions-transaction.integration.test.ts](<../../src/modules/core/permissions-transaction.integration.test.ts>)
- [src/modules/core/permissions.matrix.test.ts](<../../src/modules/core/permissions.matrix.test.ts>)
- [src/modules/core/pricing-access.test.ts](<../../src/modules/core/pricing-access.test.ts>)
- [src/modules/core/pricing-editor-legacy.test.ts](<../../src/modules/core/pricing-editor-legacy.test.ts>)
- [src/modules/core/pricing-editor-role.test.ts](<../../src/modules/core/pricing-editor-role.test.ts>)
- [src/modules/core/pricing-editor.integration.test.ts](<../../src/modules/core/pricing-editor.integration.test.ts>)
- [src/modules/core/pricing-editor.test.ts](<../../src/modules/core/pricing-editor.test.ts>)
- [src/modules/core/property-capability-access.test.ts](<../../src/modules/core/property-capability-access.test.ts>)
- [src/modules/core/property-capability-directory.test.ts](<../../src/modules/core/property-capability-directory.test.ts>)
- [src/modules/core/property-capability-grants.test.ts](<../../src/modules/core/property-capability-grants.test.ts>)
- [src/modules/core/property-capability-policy.test.ts](<../../src/modules/core/property-capability-policy.test.ts>)
- [src/modules/core/property-capability.integration.test.ts](<../../src/modules/core/property-capability.integration.test.ts>)
- [src/modules/core/retention.integration.test.ts](<../../src/modules/core/retention.integration.test.ts>)
- [src/modules/core/rls.integration.test.ts](<../../src/modules/core/rls.integration.test.ts>)
- [src/modules/core/seasonal-tariff.test.ts](<../../src/modules/core/seasonal-tariff.test.ts>)
- [src/modules/core/tariff-calendar.test.ts](<../../src/modules/core/tariff-calendar.test.ts>)
- [src/modules/core/tariff-editor.integration.test.ts](<../../src/modules/core/tariff-editor.integration.test.ts>)
- [src/modules/core/tariff-editor.test.ts](<../../src/modules/core/tariff-editor.test.ts>)
- [src/modules/core/walkthrough.seed.integration.test.ts](<../../src/modules/core/walkthrough.seed.integration.test.ts>)
- [src/modules/crm/anonymous-lead-consent.integration.test.ts](<../../src/modules/crm/anonymous-lead-consent.integration.test.ts>)
- [src/modules/crm/consent-order.integration.test.ts](<../../src/modules/crm/consent-order.integration.test.ts>)
- [src/modules/crm/consent.integration.test.ts](<../../src/modules/crm/consent.integration.test.ts>)
- [src/modules/crm/domain.test.ts](<../../src/modules/crm/domain.test.ts>)
- [src/modules/crm/private-deal-evidence.test.ts](<../../src/modules/crm/private-deal-evidence.test.ts>)
- [src/modules/crm/property-deal.service.integration.test.ts](<../../src/modules/crm/property-deal.service.integration.test.ts>)
- [src/modules/crm/public-lead.integration.test.ts](<../../src/modules/crm/public-lead.integration.test.ts>)
- [src/modules/destinations/index.test.ts](<../../src/modules/destinations/index.test.ts>)
- [src/modules/finance/bank-transfer-authorization.integration.test.ts](<../../src/modules/finance/bank-transfer-authorization.integration.test.ts>)
- [src/modules/finance/bank-transfer.integration.test.ts](<../../src/modules/finance/bank-transfer.integration.test.ts>)
- [src/modules/finance/create-checkout-opn.integration.test.ts](<../../src/modules/finance/create-checkout-opn.integration.test.ts>)
- [src/modules/finance/deposit-claims.integration.test.ts](<../../src/modules/finance/deposit-claims.integration.test.ts>)
- [src/modules/finance/deposits.integration.test.ts](<../../src/modules/finance/deposits.integration.test.ts>)
- [src/modules/finance/expense-receipt-file.test.ts](<../../src/modules/finance/expense-receipt-file.test.ts>)
- [src/modules/finance/fee-model-boundary.integration.test.ts](<../../src/modules/finance/fee-model-boundary.integration.test.ts>)
- [src/modules/finance/finance.service.integration.test.ts](<../../src/modules/finance/finance.service.integration.test.ts>)
- [src/modules/finance/immutability.integration.test.ts](<../../src/modules/finance/immutability.integration.test.ts>)
- [src/modules/finance/late-payment-availability.integration.test.ts](<../../src/modules/finance/late-payment-availability.integration.test.ts>)
- [src/modules/finance/ledger.integration.test.ts](<../../src/modules/finance/ledger.integration.test.ts>)
- [src/modules/finance/manual-cost-input.test.ts](<../../src/modules/finance/manual-cost-input.test.ts>)
- [src/modules/finance/manual-cost-statement.integration.test.ts](<../../src/modules/finance/manual-cost-statement.integration.test.ts>)
- [src/modules/finance/payout.integration.test.ts](<../../src/modules/finance/payout.integration.test.ts>)
- [src/modules/finance/provider-payout-safety.integration.test.ts](<../../src/modules/finance/provider-payout-safety.integration.test.ts>)
- [src/modules/finance/provider-webhook.integration.test.ts](<../../src/modules/finance/provider-webhook.integration.test.ts>)
- [src/modules/finance/providers/opn.test.ts](<../../src/modules/finance/providers/opn.test.ts>)
- [src/modules/finance/providers/provider-seam.test.ts](<../../src/modules/finance/providers/provider-seam.test.ts>)
- [src/modules/finance/receivable-review.integration.test.ts](<../../src/modules/finance/receivable-review.integration.test.ts>)
- [src/modules/finance/refund-recovery.test.ts](<../../src/modules/finance/refund-recovery.test.ts>)
- [src/modules/finance/refund-resolution.integration.test.ts](<../../src/modules/finance/refund-resolution.integration.test.ts>)
- [src/modules/finance/requested-service-refund.test.ts](<../../src/modules/finance/requested-service-refund.test.ts>)
- [src/modules/finance/statement-expense.test.ts](<../../src/modules/finance/statement-expense.test.ts>)
- [src/modules/finance/statement-snapshot.integration.test.ts](<../../src/modules/finance/statement-snapshot.integration.test.ts>)
- [src/modules/finance/statement-snapshot.test.ts](<../../src/modules/finance/statement-snapshot.test.ts>)
- [src/modules/home/home-read-model.test.ts](<../../src/modules/home/home-read-model.test.ts>)
- [src/modules/home/homepage-placement.test.ts](<../../src/modules/home/homepage-placement.test.ts>)
- [src/modules/home/public-homepage.failsoft.test.ts](<../../src/modules/home/public-homepage.failsoft.test.ts>)
- [src/modules/integrations/channel-health.test.ts](<../../src/modules/integrations/channel-health.test.ts>)
- [src/modules/integrations/ical-import.integration.test.ts](<../../src/modules/integrations/ical-import.integration.test.ts>)
- [src/modules/integrations/ical-occupancy.integration.test.ts](<../../src/modules/integrations/ical-occupancy.integration.test.ts>)
- [src/modules/integrations/ical-parse.test.ts](<../../src/modules/integrations/ical-parse.test.ts>)
- [src/modules/integrations/ical-sync.integration.test.ts](<../../src/modules/integrations/ical-sync.integration.test.ts>)
- [src/modules/integrations/layantara/adapter.test.ts](<../../src/modules/integrations/layantara/adapter.test.ts>)
- [src/modules/integrations/layantara/channel-contract.test.ts](<../../src/modules/integrations/layantara/channel-contract.test.ts>)
- [src/modules/integrations/layantara/channel-service.integration.test.ts](<../../src/modules/integrations/layantara/channel-service.integration.test.ts>)
- [src/modules/integrations/layantara/protection.service.test.ts](<../../src/modules/integrations/layantara/protection.service.test.ts>)
- [src/modules/integrations/layantara/reviewed-workbook.test.ts](<../../src/modules/integrations/layantara/reviewed-workbook.test.ts>)
- [src/modules/integrations/layantara/unified-outbox.integration.test.ts](<../../src/modules/integrations/layantara/unified-outbox.integration.test.ts>)
- [src/modules/integrations/layantara/workbook-import.integration.test.ts](<../../src/modules/integrations/layantara/workbook-import.integration.test.ts>)
- [src/modules/integrations/layantara/workbook-import.test.ts](<../../src/modules/integrations/layantara/workbook-import.test.ts>)
- [src/modules/integrations/unit-ical-conflicts.integration.test.ts](<../../src/modules/integrations/unit-ical-conflicts.integration.test.ts>)
- [src/modules/media/client-upload.test.ts](<../../src/modules/media/client-upload.test.ts>)
- [src/modules/media/direct-upload.policy.test.ts](<../../src/modules/media/direct-upload.policy.test.ts>)
- [src/modules/media/direct-upload.service.test.ts](<../../src/modules/media/direct-upload.service.test.ts>)
- [src/modules/media/gallery-policy.test.ts](<../../src/modules/media/gallery-policy.test.ts>)
- [src/modules/media/public-readiness.test.ts](<../../src/modules/media/public-readiness.test.ts>)
- [src/modules/onboarding/activation-media.integration.test.ts](<../../src/modules/onboarding/activation-media.integration.test.ts>)
- [src/modules/onboarding/canonical-onboarding.test.ts](<../../src/modules/onboarding/canonical-onboarding.test.ts>)
- [src/modules/onboarding/canonical-unit-resolution.test.ts](<../../src/modules/onboarding/canonical-unit-resolution.test.ts>)
- [src/modules/onboarding/content-proposal.amenities.test.ts](<../../src/modules/onboarding/content-proposal.amenities.test.ts>)
- [src/modules/onboarding/content-proposal.integration.test.ts](<../../src/modules/onboarding/content-proposal.integration.test.ts>)
- [src/modules/onboarding/content-proposal.schema.test.ts](<../../src/modules/onboarding/content-proposal.schema.test.ts>)
- [src/modules/onboarding/content-proposal.service.test.ts](<../../src/modules/onboarding/content-proposal.service.test.ts>)
- [src/modules/onboarding/employee-creation.crm.test.ts](<../../src/modules/onboarding/employee-creation.crm.test.ts>)
- [src/modules/onboarding/employee-creation.integration.test.ts](<../../src/modules/onboarding/employee-creation.integration.test.ts>)
- [src/modules/onboarding/employee-creation.routes.test.ts](<../../src/modules/onboarding/employee-creation.routes.test.ts>)
- [src/modules/onboarding/employee-creation.service.test.ts](<../../src/modules/onboarding/employee-creation.service.test.ts>)
- [src/modules/onboarding/submission-unit-access.integration.test.ts](<../../src/modules/onboarding/submission-unit-access.integration.test.ts>)
- [src/modules/onboarding/submission-unit-access.test.ts](<../../src/modules/onboarding/submission-unit-access.test.ts>)
- [src/modules/ops/check-in-checklist.test.ts](<../../src/modules/ops/check-in-checklist.test.ts>)
- [src/modules/ops/guest-pii.integration.test.ts](<../../src/modules/ops/guest-pii.integration.test.ts>)
- [src/modules/ops/operating-creation-boundary.test.ts](<../../src/modules/ops/operating-creation-boundary.test.ts>)
- [src/modules/ops/operating-creation-governance.test.ts](<../../src/modules/ops/operating-creation-governance.test.ts>)
- [src/modules/ops/operating-space-access.integration.test.ts](<../../src/modules/ops/operating-space-access.integration.test.ts>)
- [src/modules/ops/operating-space-governance.integration.test.ts](<../../src/modules/ops/operating-space-governance.integration.test.ts>)
- [src/modules/ops/operating-space-overview-performance.test.ts](<../../src/modules/ops/operating-space-overview-performance.test.ts>)
- [src/modules/ops/operating-space.schema.test.ts](<../../src/modules/ops/operating-space.schema.test.ts>)
- [src/modules/ops/operational-task-concurrency.integration.test.ts](<../../src/modules/ops/operational-task-concurrency.integration.test.ts>)
- [src/modules/ops/operational-task.schema.test.ts](<../../src/modules/ops/operational-task.schema.test.ts>)
- [src/modules/ops/operational-task.service.test.ts](<../../src/modules/ops/operational-task.service.test.ts>)
- [src/modules/ops/ops-board-calendar.integration.test.ts](<../../src/modules/ops/ops-board-calendar.integration.test.ts>)
- [src/modules/ops/ops-board.service.integration.test.ts](<../../src/modules/ops/ops-board.service.integration.test.ts>)
- [src/modules/ops/pms-automation-rules.test.ts](<../../src/modules/ops/pms-automation-rules.test.ts>)
- [src/modules/ops/pms-operations-expansion.test.ts](<../../src/modules/ops/pms-operations-expansion.test.ts>)
- [src/modules/ops/reservation-guests.integration.test.ts](<../../src/modules/ops/reservation-guests.integration.test.ts>)
- [src/modules/ops/tm30-address.test.ts](<../../src/modules/ops/tm30-address.test.ts>)
- [src/modules/ops/tm30-filing.service.integration.test.ts](<../../src/modules/ops/tm30-filing.service.integration.test.ts>)
- [src/modules/ops/tm30-queue.integration.test.ts](<../../src/modules/ops/tm30-queue.integration.test.ts>)
- [src/modules/ops/verification.service.integration.test.ts](<../../src/modules/ops/verification.service.integration.test.ts>)
- [src/modules/projects/amenity-usage.test.ts](<../../src/modules/projects/amenity-usage.test.ts>)
- [src/modules/projects/area.integration.test.ts](<../../src/modules/projects/area.integration.test.ts>)
- [src/modules/projects/canonical-property-data.test.ts](<../../src/modules/projects/canonical-property-data.test.ts>)
- [src/modules/projects/commercial-discovery.test.ts](<../../src/modules/projects/commercial-discovery.test.ts>)
- [src/modules/projects/engagement-scope.integration.test.ts](<../../src/modules/projects/engagement-scope.integration.test.ts>)
- [src/modules/projects/long-term-lease.test.ts](<../../src/modules/projects/long-term-lease.test.ts>)
- [src/modules/projects/mc.integration.test.ts](<../../src/modules/projects/mc.integration.test.ts>)
- [src/modules/projects/owner-evidence.integration.test.ts](<../../src/modules/projects/owner-evidence.integration.test.ts>)
- [src/modules/projects/owner-evidence.test.ts](<../../src/modules/projects/owner-evidence.test.ts>)
- [src/modules/projects/owner-landing.test.ts](<../../src/modules/projects/owner-landing.test.ts>)
- [src/modules/projects/owner-period-allocation.test.ts](<../../src/modules/projects/owner-period-allocation.test.ts>)
- [src/modules/projects/owner-statement-visibility.test.ts](<../../src/modules/projects/owner-statement-visibility.test.ts>)
- [src/modules/projects/owner-stay-availability.integration.test.ts](<../../src/modules/projects/owner-stay-availability.integration.test.ts>)
- [src/modules/projects/owner.integration.test.ts](<../../src/modules/projects/owner.integration.test.ts>)
- [src/modules/projects/ownership.integration.test.ts](<../../src/modules/projects/ownership.integration.test.ts>)
- [src/modules/projects/passport.service.test.ts](<../../src/modules/projects/passport.service.test.ts>)
- [src/modules/projects/project-amenities.test.ts](<../../src/modules/projects/project-amenities.test.ts>)
- [src/modules/projects/project-amenity-content-contributor.test.ts](<../../src/modules/projects/project-amenity-content-contributor.test.ts>)
- [src/modules/projects/project-amenity-visibility.test.ts](<../../src/modules/projects/project-amenity-visibility.test.ts>)
- [src/modules/projects/project-editorial.test.ts](<../../src/modules/projects/project-editorial.test.ts>)
- [src/modules/projects/project-nearby.test.ts](<../../src/modules/projects/project-nearby.test.ts>)
- [src/modules/projects/projects.integration.test.ts](<../../src/modules/projects/projects.integration.test.ts>)
- [src/modules/projects/property-booking-mode.integration.test.ts](<../../src/modules/projects/property-booking-mode.integration.test.ts>)
- [src/modules/projects/property-booking-mode.test.ts](<../../src/modules/projects/property-booking-mode.test.ts>)
- [src/modules/projects/property-editing.integration.test.ts](<../../src/modules/projects/property-editing.integration.test.ts>)
- [src/modules/projects/property-readiness.offering.integration.test.ts](<../../src/modules/projects/property-readiness.offering.integration.test.ts>)
- [src/modules/projects/public-booking-signals.test.ts](<../../src/modules/projects/public-booking-signals.test.ts>)
- [src/modules/projects/public-discovery.test.ts](<../../src/modules/projects/public-discovery.test.ts>)
- [src/modules/projects/public-priced-routes.test.ts](<../../src/modules/projects/public-priced-routes.test.ts>)
- [src/modules/projects/public-responsibility.test.ts](<../../src/modules/projects/public-responsibility.test.ts>)
- [src/modules/projects/public-sleeping.test.ts](<../../src/modules/projects/public-sleeping.test.ts>)
- [src/modules/projects/public-unit.integration.test.ts](<../../src/modules/projects/public-unit.integration.test.ts>)
- [src/modules/projects/public.integration.test.ts](<../../src/modules/projects/public.integration.test.ts>)
- [src/modules/projects/residence.integration.test.ts](<../../src/modules/projects/residence.integration.test.ts>)
- [src/modules/projects/sleeping-space-write.integration.test.ts](<../../src/modules/projects/sleeping-space-write.integration.test.ts>)
- [src/modules/projects/sleeping-space-write.test.ts](<../../src/modules/projects/sleeping-space-write.test.ts>)
- [src/modules/projects/stay-offering-backfill.integration.test.ts](<../../src/modules/projects/stay-offering-backfill.integration.test.ts>)
- [src/modules/projects/structure-kinds.test.ts](<../../src/modules/projects/structure-kinds.test.ts>)
- [src/modules/projects/title-pointer-consumers.test.tsx](<../../src/modules/projects/title-pointer-consumers.test.tsx>)
- [src/modules/projects/unit-marketing-title.test.ts](<../../src/modules/projects/unit-marketing-title.test.ts>)
- [src/modules/projects/unit-project-coherence.integration.test.ts](<../../src/modules/projects/unit-project-coherence.integration.test.ts>)
- [src/modules/projects/unit-publication-readiness.test.ts](<../../src/modules/projects/unit-publication-readiness.test.ts>)
- [src/modules/projects/units.integration.test.ts](<../../src/modules/projects/units.integration.test.ts>)
- [src/modules/sales-offers/http.integration.test.ts](<../../src/modules/sales-offers/http.integration.test.ts>)
- [src/modules/sales-offers/offer.integration.test.ts](<../../src/modules/sales-offers/offer.integration.test.ts>)
- [src/modules/services/notify-order-reminder.integration.test.ts](<../../src/modules/services/notify-order-reminder.integration.test.ts>)
- [src/modules/services/project-service-offer.test.ts](<../../src/modules/services/project-service-offer.test.ts>)
- [src/modules/services/provider.service.integration.test.ts](<../../src/modules/services/provider.service.integration.test.ts>)
- [src/modules/services/service-order-closure.integration.test.ts](<../../src/modules/services/service-order-closure.integration.test.ts>)
- [src/modules/services/service-order-closure.test.ts](<../../src/modules/services/service-order-closure.test.ts>)
- [src/modules/services/service-order-customer-view.integration.test.ts](<../../src/modules/services/service-order-customer-view.integration.test.ts>)
- [src/modules/services/service-order-public-terms.test.ts](<../../src/modules/services/service-order-public-terms.test.ts>)
- [src/modules/services/service-order.service.integration.test.ts](<../../src/modules/services/service-order.service.integration.test.ts>)
- [src/modules/services/service.service.integration.test.ts](<../../src/modules/services/service.service.integration.test.ts>)
- [src/modules/services/service.service.test.ts](<../../src/modules/services/service.service.test.ts>)
- [src/modules/services/standalone-context.test.ts](<../../src/modules/services/standalone-context.test.ts>)
- [src/modules/services/standalone-service.integration.test.ts](<../../src/modules/services/standalone-service.integration.test.ts>)
- [src/modules/workflows/cancelled-booking-statement.integration.test.ts](<../../src/modules/workflows/cancelled-booking-statement.integration.test.ts>)
- [src/modules/workflows/expense-to-owner-report.integration.test.ts](<../../src/modules/workflows/expense-to-owner-report.integration.test.ts>)
- [src/modules/workflows/property-to-financial-close.integration.test.ts](<../../src/modules/workflows/property-to-financial-close.integration.test.ts>)

## Workflows и build sources

- [.github/workflows/backup.yml](<../../.github/workflows/backup.yml>)
- [.github/workflows/browser-acceptance.yml](<../../.github/workflows/browser-acceptance.yml>)
- [.github/workflows/ci.yml](<../../.github/workflows/ci.yml>)
- [.github/workflows/production-migration.yml](<../../.github/workflows/production-migration.yml>)
- [.github/workflows/recovery-scheduler.yml](<../../.github/workflows/recovery-scheduler.yml>)
- [.github/workflows/scheduler.yml](<../../.github/workflows/scheduler.yml>)
- [package.json](<../../package.json>)
- [package-lock.json](<../../package-lock.json>)
- [vercel.json](<../../vercel.json>)
- [next.config.js](<../../next.config.js>)
- [tsconfig.production.json](<../../tsconfig.production.json>)
- [vitest.config.ts](<../../vitest.config.ts>)
- [.env.example](<../../.env.example>)
