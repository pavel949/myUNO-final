# Property block — deep audit

**Date:** 2026-09-15
**Scope:** everything between "a physical home exists" and "a person can book it, or buy it"
**Method:** static read of `prisma/schema.prisma`, `src/modules/{projects,browse,booking,core,media,integrations,compliance}`, every `/api/**` route touching a project or a unit, every admin/ops/MC/owner/public screen that renders one, plus the migration chain. `npm run lint` green; `tsc --noEmit` clean on production code (93 errors, all in test files — see §4.16). Repository CI is red and has been for 100 consecutive runs (§4.16). No database was available, so every claim below is traced to a file and line rather than to a running system.

---

## 0a. Status — what this PR fixed

This document began as a read-only audit. P0 has since been implemented on the same branch. Read the findings below as the diagnosis; this section is the current state.

| Item | State |
|---|---|
| **P0-0 · Restore CI** | **Not fixable from a branch.** GitHub Actions billing — <https://github.com/settings/billing>. See §4.16. |
| **P0-1 · Inventory CRUD (F-1)** | **Fixed.** `src/modules/projects/inventory.service.ts` + admin API + a form on the project page. A unit created today can reach live. |
| **P0-2 · iCal frequency (F-11)** | **No code change needed** — the finding was wrong and is corrected in §4.12. The 5-minute scheduler exists; it is dead for the same billing reason as P0-0. |
| **P0-3 · Retire the second pricing engine (F-6)** | **Fixed.** `GET /api/units/[unitId]` now quotes through `computePriceBreakdown` and answers availability from bookings as well as blocks. |
| **F-5 (listing editor)** | Partly: categories are editable; unit listing fields are still not. P1. |

**Measured effect on the test suite**, run locally against a Postgres built from the real migration chain:

| | Failing files | Failing tests |
|---|---|---|
| `main` at `f0e416b` | **48** | **273** |
| This branch | **12** | **43** |

The 273 failures on `main` are the sharpest evidence for F-23 in this document: they are not new, nothing introduced them today, and nobody knew, because CI has not run since 7 September. Among them was the repository's own `units.integration.test.ts > allows going live after permitted use is confirmed` — the test that asserts the exact capability F-1 says is broken. It has been failing since the canonical bootstrap migration landed.

The single largest repair was not application code but `src/test/util.ts`: its `createUnit` factory wrote units straight through Prisma, so every `createUnit({ status: 'live' })` in the suite hit the `unit_inventory_category_coherence` trigger. Thirty-six test files came back green once the factory created the category a live unit requires.

---

## 0. Резюме для основателя

Блок недвижимости — самая амбициозная и одновременно самая незаконченная часть системы. Три вывода:

**1. Новый объект нельзя вывести в продажу вообще.** Чтобы юнит стал `live`, ему нужна строка `InventoryCategory`. В приложении **нет ни одного места**, которое создаёт `InventoryCategory` — ни сервиса, ни API, ни экрана. Эти строки один раз создала SQL-миграция для уже существовавших юнитов. Значит: любой юнит, созданный сегодня через админку, навсегда останется черновиком. Это не «недоработка UI», это разрыв цепочки. Приоритет №1.

**2. Схема базы данных сильно опережает приложение.** В таблице `unit` лежит 16 полей (площади, виды, особенности, доступность, безопасность, меблировка, правила для животных), в таблице `project` — 25 полей (тип объекта: отель/резорт/кондо, застройщик, этажность, инфраструктура, фазы, дата сдачи). **Ни одно из них** нельзя заполнить через приложение. Форма создания юнита даёт 9 полей. Форма проекта — 6. Пять моделей (`SleepingSpace`, `Bed`, `CommercialOffering`, `ChannelMapping`, `RegulatoryCredential`) не читаются и не пишутся нигде в коде. Система «умеет» отели и резорты на бумаге и не умеет их на практике.

**3. Календаря нет.** Ни в одном виде: ни в карточке объекта для гостя, ни в админке, ни у операций, ни у УК. Везде — два поля `<input type="date">` и список текстовых строк. Дизайн-система (doc 06) описывает компонент `Calendar` с сеткой месяца и занятыми датами; план сборки (T-015) требует его в DoD. Он не построен. Для OTA это не косметика — это основной инструмент продаж и основной инструмент ревенью-менеджмента.

**Побочный эффект того же биллинга, который я недооценил:** настоящий планировщик задач — это `.github/workflows/scheduler.yml`, он должен дёргать фоновые задачи **каждые 5 минут** (Vercel Hobby чаще раза в сутки не умеет, поэтому записи в `vercel.json` — только подстраховка). Он тоже на GitHub Actions, то есть тоже мёртв с 7 сентября. Значит больше недели на живой системе: календари OTA устаревали на сутки, просроченные брони держали юниты сутки, а **эскалация TM30 — суточный юридический SLA — работала с суточным тиком.** Чинится тем же действием с биллингом, кодом — нет.

**И над всем этим:** CI не проходил **ни разу за последние 100 запусков** — с 10 сентября, на всех ветках, включая тривиальные merge-коммиты. 96 из 100 падают быстрее чем за 10 секунд, то есть до выполнения первого шага — раннер джобе просто не выдаётся. Это отказ на уровне аккаунта, а не ошибка в коде, и чинится он не коммитом: нужно добавить способ оплаты или поднять лимит расходов GitHub Actions на <https://github.com/settings/billing>. Значит правило «каждая задача заканчивается зелёными тестами, сборкой и линтом» из CLAUDE.md пять дней и около сотни мержей не проверялось ничем. Это надо чинить раньше всего остального.

**P0 из этого аудита уже исправлен в этой же ветке** (см. §0a): категории инвентаря теперь создаются и редактируются из админки, так что юнит снова может выйти в продажу; второй ценовой движок убран. Побочный результат — тестов на `main` падало **273**, на этой ветке осталось 43, и ни одного нового я не сломал.

Что сделано хорошо и трогать не надо: **движок бронирования**. Advisory lock на юнит + exclusion constraint в Postgres — двойное бронирование структурно невозможно. Отмены, изменения дат, возвраты, холды — всё продумано и покрыто тестами. Безопасность (RLS на всех таблицах с тестом-сторожем, подписанные iCal-токены, server-side проверки прав) — на уровне.

Сторона продажи объектов («Zillow») **не существует** — ни цены продажи, ни титула, ни freehold/leasehold, ни иностранной квоты, ни площадки. Это осознанно: Q41 в `open_questions.md` объясняет, почему это нельзя выдумывать. Решение — за вами и юристами.

---

## 1. What the property block is supposed to be

Three products share one asset graph:

| Product | Benchmark | State |
|---|---|---|
| Short-stay marketplace | Airbnb / Booking.com | Booking engine strong; listing, calendar, distribution weak |
| Property sales storefront | Zillow / FazWaz | Not built; blocked on a founder/legal decision (Q41) |
| PMS for the operator | Mews / Guesty | Ops boards exist; the calendar that a PMS *is* does not |

The spine `project → unit → identity → roles` is correct and enforced in schema. Nothing below asks to change it.

---

## 2. Verdict

> **The schema is a good 2027 product. The application layer is a 2025 prototype that can only be populated by seed scripts.**

Every serious defect in this audit is one shape: *a table exists, a migration created it, a doc describes it, and no code writes to it.* Fixing the property block is mostly not schema work. It is write-path work.

---

## 3. Severity-ranked findings

| # | Finding | Severity | Evidence |
|---|---|---|---|
| F-1 | No unit created today can ever go live — `InventoryCategory` has no write path | **Blocker** — *fixed, §0a* | §4.2 |
| F-2 | 16 `Unit` + 25 `Project` columns unreachable from any service, API or screen | **Blocker** | §4.3 |
| F-3 | No calendar anywhere — guest, admin, ops, MC | **Blocker** | §4.7 |
| F-4 | 5 models fully dead: `SleepingSpace`, `Bed`, `CommercialOffering`, `ChannelMapping`, `RegulatoryCredential` | **Critical** | §4.4 |
| F-5 | No listing editor — a unit cannot be edited after creation from any screen | **Critical** | §4.3 |
| F-6 | `/api/units/[id]?startDate=` returns a quote with no seasons, no fees, no discounts, and availability that ignores bookings | **Critical** — *fixed, §0a* | §4.8 |
| F-7 | Dated search prices every candidate unit with per-night DB round-trips, unpaginated | **Critical** | §4.9 |
| F-8 | 3 unit types (`villa`/`condo`/`townhouse`) as a Prisma enum; `catalog.unit_types` config cannot extend it | **Critical** | §4.5 |
| F-9 | Sale side does not exist — no price, title, tenure, quota, or listing | **Critical** (business) | §4.13 |
| F-10 | 12 amenities, no beds, no views filterable; PDP shows neither beds, floor, views, rules, nor reviews | **High** | §4.5, §4.10 |
| F-11 | OTA sync is iCal-only (no rates, content or reservations); the 5-minute scheduler that drives it has been dead since 7 Sep | **High** | §4.12 |
| F-12 | `Project.areaId` has no writer — area browse is unreachable for new projects | **High** | §4.1 |
| F-13 | Commercial eligibility engine exists, is correct, and is called by nothing | **High** | §4.15 |
| F-14 | Audit docs in `docs/audits/` assert delivered capability that does not exist | **High** (governance) | §4.16 |
| F-15 | `taxonomies.ts` holds trilingual user-facing labels in TypeScript, outside the content layer | **Medium** | §4.5 |
| F-16 | No map, despite the search API supporting viewport bounds | **Medium** | §4.9 |
| F-17 | Media: no reorder, no delete, no alt text, no captions, no derivatives; `ProjectMedia`/`ServiceMedia`/`TicketMedia` have no upload path | **Medium** | §4.6 |
| F-18 | `getUnitRatings` loads every booking of every result unit on every search | **Medium** | §4.9 |
| F-19 | No long-term tenancy model — "live" in *stay · live · own* has no contract, deposit, rent roll or utilities | **Medium** (business) | §4.14 |
| F-20 | 93 TypeScript errors in test files; CI never runs `tsc` | **Medium** | §4.16 |
| F-23 | **CI has failed on 100 consecutive runs since 2026-09-10**, on every branch, before executing a single step — no DoD has been enforced for five days | **Blocker** (process) | §4.16 |
| F-21 | No building/tower tier between project and unit | **Medium** | §4.1, Q40 |
| F-22 | Admin write routes spread unvalidated JSON bodies into services; no schema validation | **Low** | §4.3 |

---

## 4. Module-by-module

### 4.1 Data model — `Project`, `Unit`, `Area`

**Right.** The spine is real and enforced. `Unit.@@unique([projectId, name])`; `Project` cascades to `Unit`; `Area` self-references so hierarchy depth is data, not schema; `OwnershipPeriod` records who held a unit and when; `UnitEngagement` carries the mandate. Money is satang integers throughout. Comments in the schema are unusually good — they explain *why*, not *what*.

**Wrong.**

- **`Project.areaId` has no writer.** `createProject`/`updateProject` (`src/modules/projects/projects.ts:6-33`) do not accept it; no API route sets it. The only writes are `scripts/seed-*.ts` and `src/test/util.ts`. So `Area`, `listBrowsableAreas`, `areaSlug` on search, `getAreaPerformance` and `getPortfolioByArea` are all built, tested, and reachable only for seeded data. **(F-12)**
- **`areaLabelKey` still exists alongside `areaId`**, with `resolveAreaLabelKey` preferring the area. Two ways to say where a project is. The schema comment says it is droppable once every project has an area — no project can be given one, so it is not droppable.
- **No tier between project and unit** (Q40, already logged). A tower A/B/C condo has to smuggle the tower into the unit name. Nothing can be scoped to a building: no per-tower announcement, no per-building compliance record, no building manager role (`RoleScopeType` is `platform|project|unit`). This is correctly parked as a spine question.
- **`Unit` has no coordinates by design** (doc 08 §74) — a unit's location is its project's. Correct for a condo, wrong for a villa estate spread over 40 rai, and wrong for a sales listing where the plot *is* the asset.

### 4.2 Inventory & rate layer — the blocker

`InventoryCategory` is declared the canonical sellable class and `RatePlan` the canonical tariff. Three enforcement points agree:

1. `updateUnit` — `src/modules/projects/units.ts:255` — `A live unit must have a canonical inventory category`.
2. `computeCanonicalPriceBreakdown` — `src/modules/core/canonical-pricing.service.ts:89` — throws for a live unit with no category.
3. A Postgres trigger — `prisma/migrations/20260913210000_canonical_inventory_bootstrap/migration.sql:118` — `RAISE EXCEPTION 'Live unit % must have an InventoryCategory'`.

And then:

```
$ grep -rn "inventoryCategory.create|update|upsert|delete" src prisma scripts
(no matches)
$ grep -rn "ratePlan.create|update|upsert" src prisma scripts
(no matches)
```

**There is no create path for either model anywhere in the product.** Both tables were populated once, by the bootstrap migration, from units that already existed, with machine-generated keys (`villa_3br_2ba_6g_1500000`) and machine-generated names (`Villa 3BR`).

Consequence, precisely: `createUnit` refuses `live` by design; the operator must create a draft and promote it. Promotion runs `updateUnit`, which requires a category; `resolveCanonicalInventoryCategory` looks one up by `categoryKey` and finds nothing; the update throws. **Every unit created from today onward is permanently a draft.** The config editor can add a key to `catalog.unit_categories`, which satisfies `assertCatalogKeys` — and still no `InventoryCategory` row exists, so the gate still refuses.

This also means the hotel model is theoretically present and practically absent: `InventoryCategory` *is* the room type (`Superior 2BR`, `Pool Villa`), `Unit` is the physical room, `RatePlan` is BAR with derived plans. The design is right. Nobody can use it.

**Someone has already tried.** PR #103 ("Canonical unit onboarding: select InventoryCategory on create (v2)", merged 2026-09-14) added a category *selector* to the create form — it lets an operator pick an existing category, which is the symptom, not the cause; nothing in it creates a category. PR #104 ("Restore green admin units baseline", merged the same day) reverted both files back to the pre-#103 version, so at `HEAD` even the selector is gone. Both merges ran CI; both CI runs failed, like the ninety-eight around them (§4.16). The fix must create the row, not choose among rows that only a migration can produce.

**F-1. Nothing else in this audit matters until this is fixed.**

### 4.3 Property entry — what an operator can actually type

**Unit creation** (`src/app/(admin)/app/admin/units/create-unit-form.tsx`) offers **nine fields**: project, name, type, bedrooms, bathrooms, max guests, address supplement, base nightly, min nights.

Not offered, and not accepted by `createUnit` either: description, amenities, floor, size, category, cover photo, cancellation policy, instant-book, pets, and all sixteen extended physical columns (`privacyType`, `accommodationType`, `usableAreaSqm`, `grossAreaSqm`, `outdoorAreaSqm`, `plotAreaSqm`, `balconyAreaSqm`, `unitFeatures`, `accessibilityFacts`, `safetyFacts`, `furnishingStatus`, `views`, `petsAllowed`, `maxPets`, `petFeeThb`, `petRules`).

**Unit editing.** `PUT /api/admin/units/[id]` exists and calls `updateUnit`. Searching every `.tsx` under `src/app` for a caller returns **only** `units-client.tsx:60`, which sends `{ status }`. There is no listing editor on `/app/admin/units/[id]` — that page is the mobilization workspace (owner, engagement, compliance, checklist, canonical graph, availability panel) and contains no field for name, description, amenities or photos. **A listing cannot be edited after creation from any screen in the product. (F-5)**

**Project creation** offers slug, name, address, plus-code/lat/lng. Editing offers name, address, status. The twenty-five extended `Project` columns — `projectType`, `hospitalityClassification`, `brand`, `totalUnits`, `totalBuildings`, `floors`, `facilities`, `phases`, `completionDate`, `hospitalityConfig` and the rest — have no writer anywhere. `getProjectFacts360` reads them; nothing fills them. **(F-2)**

**Input validation.** `POST /api/admin/units` does `createUnit({ ...body, actorIdentityId })` on an unparsed JSON body. The service destructures explicitly so unknown keys are dropped silently, but types are not checked: `bedrooms: "many"` reaches Prisma and surfaces as a 400 with a Prisma message. No Zod schema on any property write route. **(F-22)**

### 4.4 Dead models

Zero references in `src/` — reads included:

| Model | Purpose | Status |
|---|---|---|
| `SleepingSpace` / `Bed` | Bed configuration per room — mandatory for Airbnb/Booking parity | Read by `getUnitFacts360` and the eligibility engine, both uncalled. No writer. |
| `CommercialOffering` | The intended home for stay / rent / **sale** terms, tenure, house rules | No reader, no writer. |
| `ChannelMapping` | External listing id + sync state per channel — the channel-manager seam | No reader, no writer. |
| `RegulatoryCredential` | Hotel licence / exemption at org, project or unit scope | Read by the uncalled eligibility engine. No writer. |
| `PropertyOnboardingTemplate` / `ProjectOnboardingDraft` | Templated onboarding wizard with autosave | No reader, no writer. Seeded by migration `20260909162000`. |
| `ProjectMedia` / `ServiceMedia` / `TicketMedia` | Galleries | `ProjectMedia` is read on the public project page; none has an upload path. |

`docs/open_questions.md` already logs the media half of this honestly. The five canonical-property models are newer and not yet logged. **(F-4)**

### 4.5 Taxonomy — types, amenities, beds, views

- **`UnitType` is a Prisma enum with three values**: `villa`, `condo`, `townhouse`. There is a `catalog.unit_types` config parameter with the same three keys, and `createUnit` takes `unitType: UnitType`. Adding `apartment`, `penthouse`, `hotel_room`, `bungalow`, `land`, `shophouse` or `commercial` through the admin config **does nothing** — the enum rejects it and the form hardcodes the three (`create-unit-form.tsx:21`). This is a direct contradiction of the constitution's "everything editable without code". `Unit.accommodationType String?` looks like the escape hatch and is unreachable (§4.3). **(F-8)**
- **12 amenities** (`src/modules/config/seed.ts:808`). Airbnb ships ~100 across categories with icons and groupings; Booking.com ~200. Twelve is a demo.
- **No bed types in use.** `BED_TYPES` exists in `taxonomies.ts` with 8 entries and three languages; the models that would hold them are dead. A guest cannot learn whether a 3-bedroom villa has three kings or six singles.
- **No views in use.** `VIEWS` taxonomy has 8 entries; `Unit.views String[]` is unreachable.
- **`taxonomies.ts` is a constitutional violation.** It carries user-facing EN/TH/RU strings — `'Стойка регистрации'`, `'วิวทะเล'` — as TypeScript literals with a `getLabel()` accessor, bypassing the content layer entirely. The `no-literal-ui-text` lint only inspects JSX, so a `.ts` dictionary slips through. Translators cannot reach these strings; the admin content editor cannot see them. **(F-15)**
- Note the same pattern in the PDP: `src/app/units/[id]/page.tsx:117-131` hardcodes the twelve amenity label keys and three policy keys in the page source. Adding a thirteenth amenity to the catalog requires editing a page.

### 4.6 Media

`storeMedia` (`src/modules/media/media.service.ts`) is a clean seam — Vercel Blob in production, data-URI fallback in dev, one file to swap for S3/R2. Good.

Around it, nothing:

- **No derivatives.** Original bytes are served to every surface. An 8 MB villa photo is an 8 MB villa photo on a phone over Thai 4G.
- **The dev fallback writes base64 into Postgres.** An 8 MB upload becomes ~11 MB in `media_asset.storage_key`. Fine as a dev convenience, a liability if `BLOB_READ_WRITE_TOKEN` is ever unset in a deployed environment.
- **No reorder, no delete.** `POST /api/admin/units/[id]/media` always writes `sort: 0`. There is no PATCH and no DELETE. Gallery order is arbitrary and permanent.
- **No alt text, no caption, no room tag.** `UnitMedia` is `(unitId, mediaId, sort)`. Accessibility and SEO both need alt text; every OTA needs per-photo room tagging.
- **No floor plans, no video, no virtual tour.** For the sales product, the floor plan is the second-most-looked-at asset after the price.
- **`ProjectMedia` has a read path and no upload path**, so the project gallery on `/projects/[slug]` can only ever show seeded images. **(F-17)**

### 4.7 The calendar — the founder's complaint, confirmed

There is no calendar in this product. Not a weak one; none.

- `src/components/` contains no `Calendar`, no `DateRangePicker`, no month grid. The nearest thing is `viz/MonthHeatStrip` — an analytics strip of one cell per day, binary occupied/vacant, used on the MC dashboard.
- Every date is chosen with a native `<input type="date">`: `SearchBar.tsx:74,88`, `AvailabilityPricingPanel.tsx` (four of them), the pricing-rule form. Native date inputs render in the *browser's* locale, not the platform's — a Russian guest with an English OS gets an English picker on a Russian page — are styled differently in every browser, are close to unusable on iOS Safari, and know nothing about availability or price.
- `/ops/calendar`, `/ops/calendar/[unitId]`, `/mc/calendar` and the admin unit page all render the same `AvailabilityPricingPanel`: a bulleted list of blocked ranges, a bulleted list of price overrides, and two forms. Bookings are not shown at all. **The operations "calendar" does not display a single reservation.**
- The guest PDP has no availability display. Its own content key says it: `listing.pick_dates: "Choose dates on the search page to see the price."` A guest cannot see which nights are free without going back and guessing.

This is not scope creep. Doc 06 §3.2 specifies `Calendar`/`DateRangePicker` — "month grid; unavailable dates struck in stone-2, selected range andaman, check-in/out endpoints filled; legend row; mobile full-screen sheet." Doc 06 S4 puts `Calendar` in the unit detail composition. The build plan's T-015 DoD names "unit detail (S4) with **calendar** + BookingWidget". Doc 06 line 89 records the deferral: "a live calendar stay[s] out until those products exist." The products now exist.

What is missing is bigger than one component:

1. **Guest availability calendar** on the PDP — month grid, unavailable nights struck, min-stay awareness, price per night in the cell, range selection.
2. **Operator tape chart** — units down the Y axis, dates across the X, bookings/blocks/owner-stays as bars, drag to extend, click to open. This is the single artifact that makes a PMS a PMS, and it is the screen an operations manager lives in all day.
3. **Rate calendar** — nights across, rate/min-stay/availability down, bulk edit by drag-select. Today a seasonal rate is a form with two date fields, entered one range at a time.

All three are absent, and all three are brand surfaces — which is exactly what "не генерик" means. **(F-3)**

### 4.8 Pricing — two engines, one of them wrong

**Engine A — `computeCanonicalPriceBreakdown`** (`src/modules/core/canonical-pricing.service.ts`), exported from `@/modules/core` under the legacy name `computePriceBreakdown`. Used by booking creation, `/api/pricing/breakdown`, and search. It resolves: `PricingRule` → category seasonal rate → base × season markup → base; then LOS discount (weekly/monthly), early-bird, flat-monthly path for ≥28 nights, cleaning fee, guest service fee, occupancy tax. It enforces max-guests, pet policy (correctly treating "unanswered" as "no"), and arrival-night min-stay. Timezone handling is careful and the comments explaining it are excellent. This engine is good.

**Engine B — `resolveEffectiveStayOffer`** (`src/modules/booking/revenue-tariff-engine.ts`), used by `GET /api/units/[unitId]` when `startDate`/`endDate` are supplied. It resolves: category base → unit `PricingRule` → `RatePlan` adjustment; then VAT. That is all. It has:

- **no seasons** — `getApplicableSeason` is never called, so a peak-season night is priced at low-season base;
- **no LOS discount, no early-bird**;
- **no cleaning fee, no guest service fee**;
- **`finance.vat_pct` where engine A uses `finance.occupancy_tax_pct`** — a different parameter;
- **no min-stay enforcement** — it returns `minNights` and quotes anyway;
- **availability that ignores bookings entirely.** `isAvailable` checks `targetUnit.blockedDates` and status flags. A fully booked villa returns `isAvailable: true`. At category level, `availableCapacity` counts physical units minus paused ones — reservations are not subtracted.

`/api/units/[unitId]` is a public, unauthenticated endpoint. Today the PDP calls it without dates, so the browser does not see the wrong number — but anything else that reads it (a mobile client, a partner, a channel adapter, the next screen someone builds) gets a materially wrong quote and a false availability answer. The route's own doc comment calls this "the canonical InventoryCategory → RatePlan → PricingRule quotation engine," which makes it likelier, not less likely, that the next developer trusts it. **(F-6)**

Also: search hardcodes `ratePlanCode: 'BAR'` in the response (`/api/search/units:337, 424`) regardless of which plan, if any, applied.

**Structural cost.** Two engines, one fee model, one tax parameter disagreement. Money policy must have exactly one implementation.

### 4.9 Search & discovery

**Correct.** Price filters, price sorts and card prices all resolve through the same calculator booking uses — deliberately, so `Unit.baseNightlyThb` cannot become a second source of truth. Min-stay rejections drop a unit from results instead of 500-ing. Map bounds are validated as all-four-or-none rather than silently ignored.

**Performance.** For any dated search the route does this:

```ts
const candidates = await prisma.unit.findMany({ where, include: listInclude }); // no take
const priced = await Promise.all(candidates.map(priceUnit));                    // per unit
```

and `priceUnit` → `computePriceBreakdown` → one `pricingRule.findFirst` **and** one `getApplicableSeason` (a config read) **per night**, plus a unit fetch and several config reads per unit. A 7-night search across 200 live units is on the order of **3,000 database round-trips in one request.** Pagination happens after pricing, so `limit` does not bound the work.

Two further scans run per dated search, both unscoped to the candidate set:

```ts
prisma.booking.findMany({ where: { dates } })      // every unit on the platform
prisma.blockedDate.findMany({ where: { dates } })  // every unit on the platform
```

whose results become `where.id = { notIn: [...] }` — an `IN` list that grows with the business.

And `getUnitRatings` loads **every booking row** for every result unit to map reviews back to units (`unit-rating.service.ts:33`). A villa with 800 stays contributes 800 rows to every search that returns it. **(F-7, F-18)**

None of this is wrong today at 39 seeded villas. All of it is wrong at 500 units, and it will present as "search got slow" long after the cause is cheap to fix. The right shape is a materialised nightly rate/availability table (`unit_id, date, rate_satang, available`) written on every rate/booking/block change and read with one indexed query — which is also exactly what the calendar screens of §4.7 need.

**Filters.** The API accepts project, category, dates, guests, price, unit type, bedrooms, area slug, map bounds, sort. The **UI offers three**: unit type (the same three hardcoded values), min price, max price (`search-results.tsx:280-341`). No bedrooms, no amenities, no instant-book, no rating, no area — and **no map**, though the API's viewport support is built and tested and `open-location-code` is already a dependency. Doc 08 §74 records the map as deliberately deferred to doc 06. **(F-16)**

### 4.10 The listing page (PDP)

`GET /api/units/[unitId]` returns: name, type, bedrooms, bathrooms, maxGuests, sizeSqm, amenityKeys, base price, minNights, instantBook, cancellation key, category, project name, images.

Against doc 06 S4 — "gallery; title row with rating and `VerifiedBadge`; meta chips; description; amenities grid; `Calendar` availability; reviews; house rules + policies block; host/ops contact row; map; sticky `BookingWidget`":

| S4 element | State |
|---|---|
| Gallery | Built (`UnitPhotoMosaic`), unordered, no alt text |
| Rating + reviews | **Absent** — not returned by the API, not rendered. Reviews exist and are shown on the *project* page only |
| Description | Absent from the API payload (`descriptionKey` is not returned) |
| Amenities grid | Built, twelve possible values, labels hardcoded in the page |
| Calendar | **Absent** |
| House rules + policies | Policy *name* only; no schedule, no rules, no pets, no check-in/out times |
| Host/ops contact | Absent |
| Map | Absent |
| Sticky BookingWidget | Built and good |
| Beds / floor / views / features | **Absent** — no field in the payload |

A guest deciding between two 3-bedroom villas can compare price, photos and twelve amenity chips. That is below the floor for this market. **(F-10)**

### 4.11 Booking — the part that is right

Do not touch this except to extend it.

- `claimDates` runs read-check-write inside one transaction under `pg_advisory_xact_lock(hashtext(unitId))`, with a `booking_no_overlap` exclusion constraint as the backstop. Double-booking is structurally impossible, and there is a concurrency integration test for it.
- Manual blocks and iCal imports take the same lock and refuse to silently overwrite a confirmed guest.
- Lapsed `pending_payment` holds are evaluated live (`holdExpiresAt > now()`) in every query, so a stalled cleanup job cannot strand inventory.
- Cancellation, modification, date change, extension safety, party composition, owner-stay and guest-review paths all exist with integration tests.
- `checkAvailability`'s doc comment is a model of the kind of honesty this codebase is full of: it explains that the function was wrong, that nothing called it, and why it was fixed anyway.

### 4.12 Distribution / OTA

`IntegrationKey` covers `ical_airbnb`, `ical_booking`, `ical_agoda`. Export is a signed-token per-unit feed that deliberately publishes only busy nights — no prices, no status, no operator notes. Import is idempotent on UID, detects conflicts against platform bookings, and raises a notification. `UnitIcalConflictBanner` surfaces conflicts on the calendar surfaces. This is competent work.

Its limits are structural:

- **iCal carries availability only.** Rates, restrictions, content, photos and reservations do not move. Every price change must be made twice; every listing edit must be made three times. That is where OTA operations actually bleed.
- **The poller is scheduled every 5 minutes, and has not run since 7 September.** An earlier draft of this audit said the poller runs once a day, reading `vercel.json` and stopping there. That was wrong, and the correction matters because it would have sent the founder to buy a Vercel plan that changes nothing. `.github/workflows/scheduler.yml` (T-047) is the real scheduler: it calls `/api/cron/run-frequent` on `*/5 * * * *` precisely because Vercel Hobby refuses sub-daily crons, and the two `vercel.json` entries are only a backstop for when Actions is unavailable.

  What is actually wrong is worse. That workflow runs on GitHub Actions, so it died with the billing outage in §4.16: **every recent Scheduler run concluded `failure` in 4–5 seconds**, and GitHub has additionally throttled the cadence to hours apart (00:53, 22:35, 22:20, 19:17, 14:02 on 14–15 September) rather than five minutes. Since 7 September the only thing still firing is the daily Vercel backstop.

  So for over a week, on the live system: OTA calendars have been up to 24 hours stale, expired payment holds have sat on inventory for up to 24 hours, retention and rollup jobs have run once a day at best — and **TM30 escalation, a 24-hour legal SLA with no slack to give, has been running on a 24-hour tick.** No code change fixes any of it; it is the same billing action as F-23. **(F-11, F-23)**
- `ChannelMapping` — the model built for real channel management — is dead (§4.4).

### 4.13 The sale side — absent

`/buying` is a list of saved units and a contact form. Its own file comment states the position plainly and correctly: there is no title identifier, no freehold/leasehold distinction, no lease term, no foreign-quota position anywhere in the schema, and for a Russian-speaking buyer in Thailand that is *the* question — so the page routes it to a human rather than render a claim nobody verified.

Nothing else exists. No asking price, no price history, no floor plan, no land plot, no CAM fees, no transfer-fee/withholding estimate, no comparables, no sale listing state machine, no offer/reservation-agreement flow, no viewing scheduler. `CommercialOffering.ownershipTenure` was designed for exactly this and is dead. `CrmOpportunityType` includes `purchase` and `sale`, so a deal can point at a unit with no way to record whether that unit is sellable to that buyer at all.

**This is correctly blocked, not neglected.** `open_questions.md` Q41 sets out why encoding a wrong ownership structure is materially worse than encoding none. What is needed is not engineering: it is the founder and counsel stating which structures Ignatev Estate uses and what ClearView will attest to. Until that exists, the Zillow half of the ambition cannot start. **(F-9)**

### 4.14 "Live" — long-term

`BookingType` is `guest_stay | owner_stay | external_ota | internal_block`. There is no tenancy. A long stay is a booking of ≥28 nights that picks up a monthly rate. There is no lease agreement, no security deposit ledger (deposits are pre-auth only, which is right for stays and wrong for a 12-month lease), no rent schedule, no utilities pass-through, no renewal or notice period, no rent roll, no arrears. The positioning promises *stay · live · own*; the system implements *stay*, gestures at *live*, and does not attempt *own*. **(F-19)**

### 4.15 Compliance & the go-live gate

`evaluateCommercialEligibility` (`src/modules/compliance/commercial-eligibility.engine.ts`) is real, readable, and reasonable: physical facts, sleeping layout for short-term, hotel licence **or** small-scale accommodation exemption, title verification for sale, per-channel required fields, with a completeness score and typed blocking reasons.

It is called by nothing. `grep` finds only its own module's `index.ts`. And because `SleepingSpace` and `RegulatoryCredential` have no write path, it would return `eligible: false` for **every unit in the database** if it were called.

Meanwhile the real gate is `Unit.permittedUseConfirmedAt` — a bare timestamp that `POST /api/admin/units/[id]/confirm-permitted-use` sets with no evidence required. `open_questions.md` Q43(a) already flags this: ClearView's mandate is proof-of-evidence, and a bare timestamp is the opposite. The engine that would close it exists and is unwired. **(F-13)**

### 4.16 Documentation vs. reality — a governance problem

`docs/audits/` contains eight documents describing the canonical property architecture. They are written in the past tense of delivered work:

- `PROPERTY_DATA_IMPLEMENTATION_VALIDATION.md` lists Scenarios A–H with "Target Result" columns — Scenario C: "`canPublishShortTerm` evaluates to `eligible: true` with 100% readiness"; Scenario F: sale listing with freehold tenure and foreign-quota facts "mapped cleanly to Thai sales portal"; Scenario G: one unit serving stay and sale — and a "Verification Protocol" section asserting "Automated vitest tests executed against domain services."
- The test that carries those names is `src/modules/projects/canonical-property-data.test.ts`. Its case **"Scenario D, E, F, G: Commercial Eligibility Engine evaluation mock logic"** does not call the eligibility engine. It asserts that `getLabel(BLOCKING_REASONS, 'REQUIRED_CREDENTIAL_MISSING', 'en')` contains the words "Required regulatory credential" — a dictionary returning its own contents. Scenarios D, E, F and G have **zero** coverage.
- "Scenario C: Property Facts Completeness" asserts `100` from a six-point heuristic in which `facilities.length > 0` and `totalUnits !== undefined` are each worth a point. The function measures nothing about channel readiness and is trivially satisfiable.
- `PROPERTY_DATA_CHANNEL_PARITY.md` is a field-mapping matrix across Airbnb/Booking/Agoda/Thai portals for fields that, per §4.3–4.4, cannot be populated and, per §4.12, have no adapter to be mapped through.

These documents are not lies — they are design intent in the voice of delivery, and a founder reading them would reasonably conclude that sale listings with tenure work. In a repository whose constitution says *no invention, stop and ask*, the documentation layer needs the same discipline the code has. Compare `docs/open_questions.md`, which is exemplary: it records what is dead, why it was not built, and what it would cost to be wrong. That is the standard. **(F-14)**

**Related:** `npx tsc --noEmit` produces **93 errors, every one of them in a test file** — stale factory options (`engagementType`), changed service signatures (`confirmBooking` now requires `paymentReceivedAt`), unused bindings. Production code is clean. The `ci.yml` workflow runs lint, migrations, `db:verify`, build and tests, but never `tsc`. Vitest transpiles via esbuild and does not typecheck, which is why the suite still runs.

**And the reason nothing noticed is worse than a missing `tsc` step: CI has not passed once in the last 100 runs.** Every run of `ci.yml` from 2026-09-10 to 2026-09-15 — across `main`, `develop` and every PR branch, including trivial merge commits — concluded `failure`. 96 of the 100 died in **under ten seconds** and none ran longer than 34; `npm ci` alone takes about a minute, and the failed jobs record no executed steps and serve no downloadable logs. The workflow file itself is well-formed. That signature is an account-level refusal, not a code failure: the job is never assigned a runner. Confirmed by re-running one failed job — attempt 2 of run `34919295579` failed in **3 seconds**, identically. A parallel investigation on PR #111 reached the same conclusion independently and dates the outage to **7 September**, one run earlier than the 100-run API window here reaches.

**The remedy is a human action, not a commit:** add a payment method or raise the Actions spending limit at <https://github.com/settings/billing>. Nothing in any branch can fix it.

Note what still works: the **Vercel preview deployment succeeds** on this branch. So `npm run build` — including the content-review gate, which needs a database — passes in an environment that has one. What is unverified is the test suite, which only CI runs.

The consequence is the governance one. `CLAUDE.md` says every task ends with green tests, build and lints, and `docs/16_build_plan.md` gives each task a DoD in tests. **For at least five days and roughly a hundred merges, none of that has been enforced by anything.** The 93 type errors, the reverted unit-create form (§4.2), and the eligibility-engine test that asserts a dictionary (§4.16 above) are all downstream of the same missing gate. Restoring CI is not property-block work, and it outranks every P1 item in this document. **(F-20, F-23)**

---

## 5. What to do, in order

Sequenced so each step unblocks the next. Nothing here changes the spine.

### P0 — restore the ability to add inventory (days, not weeks)

0. **Restore CI.** Nothing below can be verified while a hundred consecutive runs fail before their first step (§4.16, F-23). The fix is the account's Actions billing — <https://github.com/settings/billing> — not a commit. This is a prerequisite, not a parallel task. Add `tsc --noEmit` to the workflow at the same time and fix the 93 test-file errors.
1. **`InventoryCategory` + `RatePlan` CRUD.** Service in `src/modules/projects`, admin API, one screen under the project. A category create must also create its BAR plan. Without this the property block is read-only. **(F-1)**
2. **~~iCal poll frequency~~ — no code change needed.** The 5-minute scheduler already exists (`.github/workflows/scheduler.yml`); it is dead because Actions billing is dead. Restoring CI in item 0 restores the scheduler with it, and with it OTA sync, hold expiry and the TM30 SLA. Do not buy a Vercel plan for this. **(F-11)**
3. **Retire engine B.** Make `GET /api/units/[unitId]` call `computeCanonicalPriceBreakdown` and a real availability check, or stop returning `pricing` from it. One money implementation. **(F-6)**

### P1 — make the listing real (the OTA product)

4. **Listing editor.** One screen, one `PUT`, every field the schema already holds: description, amenities, floor, areas, views, features, accessibility, safety, furnishing, pets, policies, instant-book. Extend `updateUnit` to accept them. This closes F-2 and F-5 together and is mostly typing.
5. **Unit type and amenities as data.** Replace the `UnitType` enum with a catalog-backed key (`hotel_room`, `apartment`, `penthouse`, `bungalow`, `shophouse`, `land`, `commercial`, …) and grow the amenity catalog to a real OTA set with categories and icons. Move `taxonomies.ts` into the content layer. **(F-8, F-15)**
6. **`SleepingSpace` / `Bed` write path** and render it on the PDP. Mandatory for both Airbnb and Booking.com parity, and already modelled. **(F-4)**
7. **Media completion.** Reorder, delete, alt text, caption, room tag, derivatives, `ProjectMedia` upload. **(F-17)**
8. **PDP to S4.** Reviews, description, beds, floor, views, house rules with the real schedule, host contact, map. **(F-10)**

### P2 — the calendar layer, and the reason it must come with an index

9. **Materialised availability/rate index.** `unit_availability(unit_id, date, rate_satang, min_nights, status)`, written on every rate, booking, block and iCal change. This is the *same* prerequisite for (a) fixing search performance, (b) the guest calendar, (c) the tape chart and (d) the rate calendar. Building the calendar without it means four screens that each re-derive prices night by night. **(F-7, F-18)**
10. **`Calendar` / `DateRangePicker` in the design system** to doc 06 §3.2 — month grid, struck unavailable nights, range selection, price in cell, mobile sheet. Replace every `<input type="date">` in the product.
11. **Operator tape chart** at `/ops/calendar` — units × dates, bookings as bars, drag to block, click to open. The screen an operations manager lives in.
12. **Rate calendar** — bulk edit by drag-select, replacing the one-range-at-a-time form.
13. **Map** on search, using the viewport support that already exists. **(F-16)**

### P3 — decisions before code

14. **Ownership & title model (Q41).** Founder + counsel. Until it exists the sales product cannot start; once it exists, `CommercialOffering` is already shaped to hold it. **(F-9)**
15. **Building/tower tier (Q40).** Needed before the first multi-tower condominium, not before. **(F-21)**
16. **Long-term tenancy.** Decide whether *live* is a product or a long booking. **(F-19)**
17. **Wire the eligibility engine** to the go-live gate once credentials and sleeping layout have write paths, replacing the bare `permittedUseConfirmedAt` stamp. **(F-13)**

### Hygiene — cheap, do alongside

18. Add `tsc --noEmit` to CI and fix the 93 test-file errors. **(F-20)**
19. Zod schemas on every property write route. **(F-22)**
20. Mark `docs/audits/*` as design intent, or rewrite them to state what is actually delivered. Move the five dead canonical models into `open_questions.md` with a build-or-drop decision. **(F-14)**
21. Give `Project.areaId` a writer, then drop `areaLabelKey`. **(F-12)**

---

## 6. What not to build

- **Do not touch the booking transaction.** The lock/constraint pair is the best thing in the repository.
- **Do not invent ownership structures.** Q41's reasoning is correct and should hold.
- **Do not build a channel manager before the listing is complete.** There is nothing worth syncing yet.
- **Do not add microservices, a plugin layer, or a second database.** Every problem in this audit is a missing write path or a missing index inside the existing monolith.
- **Do not build the calendar screens before the availability index.** Four screens re-deriving prices per night is how the current search got slow.

---

## 7. Sources

Schema: `prisma/schema.prisma`. Migrations: `20260907000000_canonical_property_data_system`, `20260909160000_canonical_commerce_federation_onboarding`, `20260913100000_canonical_inventory_category_links`, `20260913210000_canonical_inventory_bootstrap`. Code: `src/modules/projects/{units,projects,public.service,property-facts.service,taxonomies}.ts`, `src/modules/core/{availability,canonical-pricing}.service.ts`, `src/modules/booking/{booking.service,revenue-tariff-engine}.ts`, `src/modules/browse/*`, `src/modules/media/media.service.ts`, `src/modules/integrations/*`, `src/modules/compliance/commercial-eligibility.engine.ts`. Routes: `src/app/api/{admin/units,admin/projects,units,search/units,pricing}/**`. Screens: `src/app/(admin)/app/admin/{units,projects}/**`, `src/app/{units,search,buying,ops/calendar,mc/calendar}/**`, `src/components/units/AvailabilityPricingPanel.tsx`. Specs: docs 06 §3.2/S4, 08 §1/§6, 16 T-008/T-015, `open_questions.md` Q40/Q41/Q43, `docs/audits/*`.
