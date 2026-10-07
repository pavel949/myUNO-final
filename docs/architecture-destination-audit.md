# Аудит архитектуры: дестинации, funnel, области ответственности и масштабирование

Дата: 2026-10-08, Asia/Bangkok. Репозиторий: `pavel949/myUNO-final`. Проверенный checkout: `24138a2d717773534d923244a102631987aad641`, main. Термин пользователя «MyBuna funnel» здесь трактуется как существующий discovery → quote → booking/request → trip → services/owner funnel myUNO; отдельного подтвержденного продукта или сущности MyBuna в проверенном коде не найдено.

Это специализированная часть общего архитектурного аудита. Проверены код, Prisma-модели, контракты и локальные чистые тесты. Production DB, примененные миграции, чужие аккаунты, нагрузка, восстановление и реальная новая дестинация в этой части не проверялись. Отсутствие таких проверок не заменяется наличием файлов или зеленым build. Изменений production-кода, схемы или данных в рамках этого аудита нет.

## Вывод

У платформы есть подходящая основа для сети объектов: модульный монолит, единая Identity, Project/Unit, категории, коммерческие предложения, организационные связи, OperatingSpace, единый расчет цены и отдельная модель внешних систем. Обычный второй объект в Таиланде не требует отдельной базы или приложения по самой модели данных.

Однако **копировать существующий funnel на любую дестинацию только настройками сейчас нельзя**. DestinationConfig пока описывает одну дестинацию для presentation/metadata/analytics. Он не ограничивает основные выборки каталога. Валюта в финансовом ядре намеренно THB; несколько операционных поверхностей используют Bangkok независимо от Project.timezone. Право оператора и роль пользователя разрешаются несколькими отдельными механизмами, а не одним каноническим resolver эффективной полномочности. Эти ограничения существенно важнее визуального сходства интерфейсов.

Различать три задачи:

| Сценарий | Архитектурная оценка по коду | Что требуется до запуска |
|---|---|---|
| Новый condo/resort на Phuket, THB, тот же merchant | Значительная часть модели уже пригодна | Реальные данные, mandate/ownership, конфигурация тарифов/медиа, scoped permissions, booking/channel/finance acceptance |
| Вторая дестинация Таиланда в той же базе | Частично готово; public funnel не имеет destination isolation | Destination relation/context, фильтры каталога/API/sitemap, независимая редакционная конфигурация, контроль cache keys и cross-destination тесты |
| Другая страна, timezone, currency, merchant, правила | Не готово как configuration-only rollout | Currency/merchant/jurisdiction contracts, timezone propagation, country-specific policy/compliance, payment/provider adaptation, migration and financial parity |

## Доказательная база

Нормативные ориентиры: `PROJECT.md` §§6–12, 16, 20–24; `docs/canonical/ARCHITECTURE.md` §§1–17; `DATA_MODEL.md`; `AI_FULL_PLATFORM_AUDIT.md`; `AI_FLOW_SURFACE_MATRIX.md`; `AI_AUDIT_REPORT_TEMPLATE.md`. `npm run audit:inventory` выполнен как средство обнаружения, не как E2E-доказательство.

Проверка 2026-10-08: `npx vitest run src/modules/destinations/index.test.ts src/modules/home/homepage-placement.test.ts src/modules/projects/public-discovery.test.ts src/lib/date.test.ts src/modules/booking/calendar-projection.test.ts src/lib/plus-code.test.ts` — **6 файлов, 43 теста passed**. Эти тесты проверяют текущую конфигурацию, placement semantics, public draft visibility, календарные helpers и Plus Code. Они **не проверяют** запуск второго destination, DB isolation, load или финансовую готовность новой страны. Локальный лог: `/tmp/architecture-destination-tests.log` (временный, не долговечная release evidence).

| Область | Фактический источник | Что подтверждено |
|---|---|---|
| Выбор дестинации | `src/modules/destinations/index.ts:1–45` | Единственный registry entry Phuket; env selection; fallback; route helper пока возвращает исходный path |
| Каталог главной | `src/modules/home/public-homepage.service.ts:34–160` | Destination используется для HomepagePlacement; остальные readers вызываются без destination scope |
| Проекты | `src/modules/projects/public.service.ts:153+` | Выборки live/imported approved draft, media/offering/responsibility gates; destination scope отсутствует |
| Discovery units | `src/modules/projects/public-discovery.ts:18–75` | Unit/project/area/category/type filters и лимит 200; destination filter отсутствует |
| Search/quote | `src/app/api/search/units/route.ts:38–260, 426+, 610+` | Даты и project/category consistency проверяются; destination не включен в Prisma where; цены считаются каноническим calculator |
| Районы | `src/modules/projects/area.service.ts:215–269` | Иерархия районов и live project count; нет destination relation/filter |
| Services | `src/modules/services/service.service.ts:395–452` | Active vetted platform catalogue, optional project offer; нет destination coverage selection в reader |
| Asset/scope | `prisma/schema.prisma:929–1043, 1611+, 1887+, 3854+` | Area tree, Project country/timezone, Organization relationships, scoped roles, OperatingSpace |
| Деньги/locale/time | `src/lib/money.ts`, `src/lib/date.ts:43+`, `src/lib/format.ts:14–15`, `src/modules/content/types.ts` | Satang THB contract; timezone-aware helper плюс global Bangkok defaults; четыре compile-time locales |

## Findings: факты, риск, безопасный путь

Severity характеризует последствия при расширении. Здесь нет доказанного production P0 инцидента. Архитектурные P1 нельзя автоматически интерпретировать как текущую утечку private PII: глобальный public каталог и private tenant isolation — разные вещи.

### DEST-01 — P1: destination не является ограничением public inventory

**Факт.** Prisma Area и Project не имеют destinationId. Project содержит country/region/city/district и areaId, но это описательные поля. `DestinationConfig` — TypeScript registry без relation с asset graph. Homepage queries projects/units/areas/services глобальны; только `HomepagePlacement.destinationKey` фильтруется. Search получает `getDestination()`, но строит supply scope из projectId/category/area/bounds, не из destination.

**Последствие.** Если добавить второй entry registry и проекты второй дестинации в общую DB, название/metadata главной могут говорить о destination A, а fallback catalog содержать destination B. Даже идеальная редакционная подборка не исправляет direct search, projects hub, details и sitemap.

**Исправление.** Добавить стабильный Destination ID/key и relation с корнем Area либо Project (выбрать одну авторитетную связь и обеспечить ее согласованность). Протянуть обязательный public DestinationContext в project/unit/area/service discovery queries, включая detail lookups. Существующий global cross-destination каталог сохранить только как отдельный явно global режим. Backfill Phuket до переключения readers; unknown destination должен закрывать scoped route, не незаметно заменять его Phuket.

**Acceptance.** Две дестинации с одинаковыми categoryKey и похожими area names; homepage/projects/search/map/details/sitemap A не выдают B. Чужой projectId/categoryId не расширяет destination scope. Проверить запрос без area/project filter.

### DEST-02 — P1: destination routing и конфигурация пока deployment-wide

**Факт.** `getDestination` использует `NEXT_PUBLIC_MYUNO_DESTINATION` и один registry entry; неизвестный key fallback Phuket закреплен тестом. `destinationPath(path, _destination)` ничего не меняет. `siteUrl()` использует один NEXTAUTH_URL; sitemap строит global project/unit/area URL. Нет подтвержденного host/path resolver второй дестинации.

**Последствие.** Стратегия «отдельный deployment для destination» не изолирует общую базу; стратегия «один deployment несколько destination» пока не имеет request-scoped canonical URL. Unknown config может выглядеть рабочей, показывая Phuket. SEO/PWA/links/email return URLs надо проектировать вместе.

**Исправление.** ADR: единый `/destinations/[slug]` (или компактный префикс) либо allowlisted host mapping. Единый resolver host/path → destination; redirect/canonical policy; совместимость старых Phuket URL. Global Identity и auth остаются общими. Destination не превращается в authorization grant.

**Acceptance.** Deep links, refresh, login return, booking/trip links, locale switch, emails и canonical/hreflang корректны для обеих дестинаций. Misconfigured key обнаруживается deployment validation/health.

### DEST-03 — P1: THB-only ядро не поддерживает новую валюту одной настройкой

**Факт.** `src/lib/money.ts` прямо закрепляет integer satang и THB-only. Availability DTO, unit/category rates, config keys и price filters используют `*Thb`/`*_thb`; API input converts baht → satang. DestinationConfig.currency — string, но не проводит currency через эти contracts. SEO offer priceCurrency тоже THB.

**Последствие.** Смена registry currency на IDR/AED/USD создаст ложную визуальную универсальность; calculation/payment/ledger останутся с THB-семантикой. Просто переименовать поля или добавить символ недопустимо.

**Исправление.** Отдельный финансовый проект: Money {minorAmount, currency}, currency exponent registry, immutable transaction currency/accepted terms, payment-provider support, explicit settlement currency/FX rules. Старые THB snapshots неизменны; expand/backfill/shadow parity; не создавать глобальную auto-conversion задним числом.

**Acceptance.** Разные minor-unit exponents, round-trip display/input, fees/tax/refunds/payout allocations, historical THB parity. Несовпадение currencies в quote/order/payment блокируется до записи.

### DEST-04 — P1: Project.timezone не распространяется на весь операционный контур

**Факт.** Есть корректные универсальные calendarDayIn(timeZone) и Project.timezone; booking check-in и часть lifecycle jobs читают project timezone. Но calendar projection содержит `bangkokCalendarDay`, используемый MC Today, ops stays/calendar board/night-audit. UI uses global APP_TZ Bangkok для сроков requests/services/tickets.

**Последствие.** Resort в другой timezone может иметь неверный «сегодня», morning/arrival list, historical calendar state или night-audit selection; UI deadline отображается в Bangkok. Чистые тесты нынешнего Bangkok behavior не подтверждают другой resort.

**Исправление.** Передавать OperatingSpace/Project timezone на все read models и formatter boundaries; для cross-project portfolio явно выбирать operational day per property либо marked portfolio display timezone. Stored @db.Date продолжать читать как calendar day UTC; не конвертировать его в instant timezone.

**Acceptance.** Asia/Bangkok, Europe/London (DST), America/Los_Angeles (behind UTC): arrival/departure boundaries, after-midnight audit, request expiry, calendar history; mixed-zone portfolio не смешивает business days без обозначения.

### DEST-05 — P1: role, organization и operating authority не объединены в один resolver

**Факт.** Shared `can()` проверяет blocked/isAdmin, role action/access и platform/project/unit scope. OrganizationId существует у RoleAssignment, но shared scopeMatches его не разрешает как отдельную область. OperatingSpace membership/capability проверяет другой service. UnitEngagement/ManagementContract/source booking authority существуют отдельно; shared can() не делает сам effective authority/conflict resolution по canonical function.

**Последствие.** Добавляя нового оператора, разработчик должен знать несколько permission seams и правильно сочетать их в каждом writer/query. Наличие role или OperatingSpace capability само по себе не доказывает legal mandate, finance delegation или exclusive booking/pricing authority. Это архитектурный gap, не доказанный обход конкретного API.

**Исправление.** Единый resolveEffectiveAuthority(actor, action, resource, effectiveAt) с типизированным результатом и deny reason; адаптировать legacy guards постепенно. Отдельно legal ownership, org membership, role и operational mandate. Exclusive overlap = conflict. Admin override отдельная audited policy, а не перенос обычных operator roles в platform scope.

**Acceptance.** Два независимых manager/org, owner, frontline, provider; SSR/API/export/media и writers; истекший mandate, будущий mandate, read-only, conflicting authority. Роль A не наследует права на B через shared collection/destination.

### DEST-06 — P2: time-bounded OperatingSpace unit membership не проверяет startsOn в reader

**Факт.** `getOperatingSpaceUnitIds` фильтрует active и endsOn > now/null, но не startsOn <= now. Prisma OperatingSpaceUnit содержит оба поля. Вызов helpers не проверяет Identity сам, capability assertion вызывается отдельно.

**Риск.** Future-start unit может попасть в текущий portfolio/unit list, если такой row создан. Это воспроизводимая логика выборки по коду; реальные future rows/злоупотребление в production не проверены. Нельзя утверждать, что capability guard отсутствует у всех callers.

**Исправление.** Ввод effectiveAt и полного half-open interval [startsOn, endsOn) в membership readers; command-level check и query-level scope соединить через общий service contract. Прежде проверить все callers и end/start business semantics.

**Acceptance.** Future, expired, inactive rows; переход exactly startsOn/endsOn; belonging to two spaces не расширяет разрешенные unit IDs.

### DEST-07 — P2: search limit ограничивает выдачу, а не вычислительную работу

**Факт.** Search dates/price sort/filter branch получает все candidates, запускает `Promise.all(candidates.map(priceUnit))`, затем фильтрует/sorts/slices. Category grouping имеет nested calculator calls. Overlap booking/blockedDate queries идут по dates во всей базе без supply/destination scope. Media candidates также проверяются до pagination. Public project reader тянет project graph и units/media без pagination; discovery unit reader ограничен первыми 200.

**Риск.** При большом multi-destination каталоге появляются unbounded DB calls/concurrency/memory, global overlap scan, неполная выдача после 200 units в другом reader. Это не измеренный текущий performance инцидент; latency/load testing не проводились.

**Исправление.** Сначала supply/destination restriction, DB query plans, composite indexes и bounded candidate projection. Batch canonical pricing inputs; concurrency limits; dated price/availability projection с явной freshness; final authoritative quote остается live. Не «исправлять» цену пагинацией до фильтра, которая меняет totals/price sorting.

**Acceptance.** 100/1,000/10,000 units, simultaneous dated/category/map requests; p95/p99, DB pool saturation, query count; min/max/sort/total semantics сохраняются. Измерить прежде выбирать search service или microservices.

### DEST-08 — P2: services destination coverage не задается public reader

**Факт.** `listPublicMarketplaceServices` читает platform-wide active/vetted catalog; optional project offer применяется после retrieval. Homepage reader передает только limit. Destination context отсутствует. Project-specific availability и actual order validation — отдельные контракты.

**Последствие.** Вторая дестинация может рекламировать provider, работающего только в первой. Риск ложного discovery claim остается даже если checkout правильно отклонит адрес позднее.

**Исправление.** Provider coverage/service-area canonical graph с explicit country/destination/area/service geography, eligibility reason, context types stay/owned/managed/standalone. Public query scope по coverage; availability/quote validation повторяется server-side. Не создавать fake «All Destination» Project.

**Acceptance.** Provider A only, provider multi-area, remote/referral offer, disabled project override, standalone address outside coverage; cards и order writer согласованы.

### DEST-09 — P2: merchant/config inheritance недостаточно для независимых операторов

**Факт.** ConfigScope = global/project/unit; getConfig resolve unit → project → global, процессный TTL 60 секунд. Destination/organization layer нет. Merchant legal identity/bank parameters global в seed. Tax parameters допускают project override. Это сознательная текущая single-merchant модель, не само по себе defect.

**Последствие.** Независимый merchant или jurisdiction требует explicit money collector/responsible organization, не override одной глобальной строки. Одновременно оператор/курорт может требовать shared organization defaults без копирования в каждый Project. Process-local invalidation не мгновенно очищает другой instance (TTL ограничивает staleness, не транзакционную correctness).

**Исправление.** Разделить destination presentation, organization commercial policy, project operations и immutable transaction terms. Не добавлять organization/destination arbitrary JSON override к authority. Для критичных config versions и writer live read; invalidation/pubsub только для derived display. Merchant record/reference в accepted transaction snapshot.

**Acceptance.** Два collectors/bank accounts; receipt/refund/settlement не меняются после merchant update; policy precedence documented; two app instances не принимают stale critical terms.

### DEST-10 — P2: локализация и editorial defaults не образуют полный destination pack

**Факт.** Destination.supportedLocales/defaultLocale заданы; Content module compile-time locales ru/en/th/zh и DEFAULT_LOCALE ru. Search использует Content.DEFAULT_LOCALE, хотя destination default en. Global SEO alternates uses LOCALES. EmergencyPhone есть в registry, но search по production source не нашел consumption этого поля. Нет доказанного полного country policy/emergency/support routing через destination config.

**Последствие.** Новый registry entry не задает реально единый locale fallback, copy, legal/emergency/support bundle. Наличие emergencyPhone в interface не подтверждает guest emergency UX. Для другого региона не достаточно поменять название hero.

**Исправление.** Versioned destination launch pack: locales/translations, geography, service coverage, support contacts, emergency guidance, legal policy versions, media, SEO/PWA; centralized fallback policy. Новый language support остается отдельным product decision, не free-form string в registry.

**Acceptance.** Missing/unreviewed translations; region-specific legal/emergency links; language switching сохраняет destination and booking context. Ответственный человек подтверждает местные emergency/legal facts.

### DEST-11 — P2: source-control exception привязан к Layantara

**Факт.** Source-booking guard/exclusion queries explicitly system_key layantara_os; imported-public visibility whitelist includes layantara_os/yandex_disk_public_media. ExternalSystem itself имеет unique(system_key, environment), что является хорошей базой для federation. Whitelist регулирует draft discovery, а не permission to book.

**Последствие.** Новый external PMS не получает автоматически те же booking authority/freshness protections. Копирование adapters плюс strings может создать новый special-case funnel. Это не доказательство, что нынешний Layantara guard слабый.

**Исправление.** Общий source-authority contract/capability по ExternalSystem/OperatingScope: query, quote, hold, confirm, cancel, pending/unknown, freshness, cutover proof; imports publish по reviewed readiness, не только provenance. Layantara-specific mapping/translation остаются в adapter.

**Acceptance.** Второй test adapter, staging/prod IDs, stale projection, timeout unknown, retry/idempotency, partial cutover per unit/property; нельзя подтвердить booking через stale search result.

## Что сохранить

1. Единые Project/Unit и explicit commercial offering: не форкать Unit для sale/stay или второй страны.
2. Integer minor-unit money и канонический server calculator: multi-currency evolution обязана сохранить точность.
3. Project/category consistency validation в Search: расширить destination consistency, не убрать проверки.
4. Отдельные discovery/readiness/booking gates: красивый public draft не означает sellable capacity.
5. Media readiness и verified responsibility readers: расширять source/context, не генерировать доверие по названию destination.
6. Area tree и project geo/timezone fields: foundation полезен; добавлять destination relation безопасно.
7. Scoped role deny-by-default/read-vs-write и отдельные OperatingSpace capabilities: перейти к unified resolution без wholesale security rewrite.
8. ExternalSystem environment uniqueness и adapter boundary: ordinary properties shared DB; federated resort исключение, не шаблон новой базы.
9. HomepagePlacement ordering только eligible canonical entities: редакция не должна менять права/availability/pricing.
10. Build `prisma generate` без автоматического production migration: сохранить отдельный migration stage.

## Целевая структура без microservice split

| Слой | Канонический contract | Не должен владеть |
|---|---|---|
| Destination | geography, locale/presentation, support/legal bundle, public funnel context | Private authorization, ownership, booking capacity |
| Organization/operator | memberships, legal entity, delegated authority, commercial responsibility | Identity fork; global search eligibility без media/publish gates |
| Project/property | timezone, assets, operational/config policy, readiness | Переписывание accepted historical terms |
| Unit/category/offering | Physical resource, category inventory, commercial modes, scoped rate applicability | Duplicate physical capacity для каждого режима |
| Search/public projection | Bounded eligible DTO, canonical price reference, source freshness | Confirmation/write authority |
| Domain commands | Effective authorization, validate/transaction/idempotency/event | UI labels/unsafe global config overrides |
| Adapter | Source mapping/version/quote/hold/confirm/health | Direct UI query external tables, display-name matching |

DestinationContext должен явно передаваться application queries; private AuthorityContext отдельно. Не делать optional destination всеобщим default, после чего забытый аргумент снова показывает global catalog. Global admin views используют явно названный global query contract.

## План внедрения и контрольные ворота

| Этап | Объем | Условие завершения | Что не активировать преждевременно |
|---|---|---|---|
| 0 — Baseline/ADR | Routing, scope graph, currency/merchant strategy, writer inventory; actual DB/migration/authority ownership | Решения согласованы; текущий Phuket funnel captured; rollout/rollback owners | Новый destination live/public claims |
| 1 — Same-country destination | Additive destination relation; Phuket backfill; request context; query filters/details/sitemap/cache; reviewed pack | Two-destination isolation tests + dated search/quote parity + actual runtime | Вторую валюту/другую legal модель |
| 2 — Effective operator authority | Typed resolver, org membership and mandate; adapt read/writers; interval boundaries | Negative IDOR/cross-org tests and expired/conflict cases at APIs/SSR/media/export | Platform roles вместо scoped permissions |
| 3 — Search scale | Bounded scope, batch pricing, projections/indexes/query plans, pool/concurrency budgets | Measured p95/p99 and correctness parity; instrument slow queries/lag | Microservices без bottleneck evidence |
| 4 — Foreign jurisdiction | Money currency, collectors/tax/legal/compliance/timezone propagation | Financial golden master; refund/settlement/historical parity; payment/legal local review | Registry-only change currency/country |
| 5 — Repeatable launch kit | Validated import dry-run, reusable pack, operator/team/services/channels, readiness gates | Вторую дестинацию вводит operator без custom dashboard/app fork; recorded interventions | Скрипты как ручной бесконтрольный launch |

Временные оценки и стоимость здесь не выдуманы: для них нужны live inventory/DB size, authoritative operating rules, provider contracts и выбранная routing/currency strategy.

## Обязательные сценарии следующей проверки

| Scenario | Проверка |
|---|---|
| Two destinations, shared DB | Homepage→project→unit→dated search→quote isolation; crafted foreign IDs; sitemap/deep links |
| Two operators in same destination | Role+organization+mandate/function; scoped units/finance/media/export; revoked membership |
| One operator, mixed projects/timezones | Today/night audit/departures/job deadlines, project vs portfolio date semantics |
| Category resort + individual condo | Same physical resource; category inventory; rate override/applicability; no double sell |
| New external PMS | Fresh/stale source, timeout unknown, retry, environment mapping; no confirm from projection |
| Different currency/merchant | Amount exponent, accepted immutable terms, taxes, refund, settlement allocation, bank instructions |
| Large portfolio | Global/mapped/date/category search query count, connection saturation, latency/memory; no silent 200-unit omission |
| Destination pack update | Metadata/editorial cache invalidation; no price/authority change; expired legal terms/history preserved |

## Readiness dimensions этой части

| Capability | Specification | Code | Migration | Data/config | Permission | UI | Critical tests | Deploy | Runtime |
|---|---|---|---|---|---|---|---|---|---|
| Current destination config boundary | partial | verified | not applicable | partial | not applicable | not checked | partial (43 pure tests overall) | not checked in this audit | not checked |
| Multi-destination public isolation | verified as target | failed (scope absent) | not checked | not checked | not applicable public / private separate | not checked | not checked | not checked | not checked |
| Same-country project foundation | verified | partial | not checked | not checked | partial by code | not checked | partial | not checked | not checked |
| Unified effective operator authority | verified | partial | not checked | not checked | partial | not checked | not checked end-to-end | not checked | not checked |
| Arbitrary currency/country | partial product policy | failed as general currency contract | not checked | not checked | not checked | not checked | not checked | not checked | not checked |
| Search capacity at multi-destination scale | verified target | partial | not checked | not checked | not applicable public | not checked | not checked load | not checked | not checked |

**Code readiness:** база масштабирования есть; расширение на любую дестинацию не configuration-only и имеет конкретные P1/P2 gaps. **Deployed operating readiness:** запуск второй дестинации/нового оператора/другой страны этим аудитом не подтвержден; нужны описанные migration, isolation, money, performance и runtime evidence. Ни один неизвестный пункт не считается pass.
