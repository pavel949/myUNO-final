# Текущее устройство myUNO

Сверка исходников 2026-10-16; exact codeRevision в REFERENCE. Факты production и текущая оценка отделены от кода в [READINESS_ASSESSMENT](READINESS_ASSESSMENT.md). Полная статическая карта: [REFERENCE](REFERENCE.md). Пробелы и критерии приёмки: [IMPLEMENTATION_STATUS](IMPLEMENTATION_STATUS.md).

## Границы приложения

Один Next.js App Router обслуживает публичную витрину, guest experience, owner, MC, provider, PMS и admin control plane. PostgreSQL доступен через Prisma server-side. Supabase — хост БД; собственная авторизация приложения не использует Supabase Auth. Vercel обслуживает приложение, Blob — публичные marketing media. Разрешённые внешние изображения в next.config.js включают унаследованный Supabase storage URL, сайт Layantara и Unsplash: это источники изображений, а не альтернативный деплой.

Identity, Organization и RoleAssignment связывают пользователя с ролями/scopes. Administrative authority также использует Identity.isAdmin; отдельного `superadmin` в RoleType нет. OperatingSpace/Member/Unit, teams и project/unit capabilities ограничивают рабочие области. Интерфейс и server guards должны проверяться вместе.

## Физическая и коммерческая недвижимость

Area → Project → optional ProjectStructureNode → InventoryCategory → Unit. CommercialOffering определяет продаваемый сценарий и условия; Unit — физический объект. OwnershipPeriod хранит историю владельцев; UnitEngagement и ManagementContract описывают управление. Публичная ответственность выводится resolver-ом из полномочий и доказательств.

Проект имеет editorial content, ProjectMedia, amenities, nearby places и связанные услуги ServiceProject. Amenity имеет часы/правила/персонал/расположение/booking details; публичные страницы комплекса и квартиры используют общую проекцию. SleepingSpace/Bed описывают размещение; категория/квартира имеют собственные фото. Readiness отдельно контролирует публикацию и коммерческую допустимость. Видимость импортированного draft в discovery не равна доступности продажи.

## Реальные пользовательские процессы

| Процесс | Основные экраны | Состояние по коду |
|---|---|---|
| Поиск жилья | `/`, `/search`, `/areas`, `/projects`, `/units/[id]` | Витрина, фильтры, карта, фото, quote, category/unit selection |
| Бронь и поездка | `/book/review`, `/trips`, `/trips/[id]` | Booking request/instant, pending payment, approval/decline, payment, cancellation |
| Проживание | `/bookings/[bookingId]/home-space`, `/ops/stays/[bookingId]` | Дом/инструкции, гости, passports, check-in/out, work items |
| Публикация | `/property/onboard`, `/property/listings`, admin submissions | Draft → review/convert → readiness → activation; нет автоматической публикации любого draft |
| Сотрудник | `/property/create`, `/property/content`, `/property/pricing`, `/property/booking-mode` | Scoped creation/proposals, тарифы и booking mode с отдельными полномочиями |
| PMS | `/ops`, `/ops/calendar`, `/ops/reservations`, `/ops/spaces` | Общая Booking projection; календарь не второй источник броней |
| Уборка/ремонт | `/ops/housekeeping`, `/ops/maintenance`, `/ops/tasks` | Task transitions, turnover/inspection readiness, blocking maintenance запрещает заезд и сохраняется после уборки, preventive maintenance |
| Владельцы/MC | `/owner`, `/owner/statements`, `/mc/portfolio` | Scope-based portfolio, owner stays, отчёты/sign-off, bookings/compliance |
| Продажи | `/homes`, `/buying`, `/app/admin/crm` | Commercial discovery, leads/opportunities/deals; не автоматическая юридическая сделка |
| Услуги | `/services`, `/services/orders`, `/provider` | Project/stay/standalone order, payment, accept, fulfillment, refund/review |
| Общение/споры | `/messages`, `/tickets`, admin disputes | Threads, notifications, email seam, SLA, disputes; внешний messenger send отсутствует |

## Цены, доступность и бронь

`core/canonical-pricing.service.ts` — общий calculator. Для подтверждённого seasonal tariff grid приоритет имеет CommercialOffering с `quoteEngine=canonical_tariff_grid_v1` и verified tax/policy settings. Для monthly требуется подтверждённая monthly grid; годовой порог отправляет в lease request. В остальных путях используются BAR RatePlan (unit→category→project), dated PricingRule и совместимые category/unit config. Нельзя описывать цену только как Unit.baseNightlyThb или только как RatePlan: ветви реально сосуществуют.

Числа `*Thb`/`*_thb` в core money paths исторически названы так, но расчёт ведётся в целых satang. Display conversion — через money helpers. Цена клиента не является авторитетной. Booking хранит принятую snapshot. Quote не удерживает инвентарь.

Availability учитывает canonical blocking booking statuses/active payment holds и BlockedDate. Транзакционные inventory locks и SQL constraints защищают пересечения. Category booking имеет подписанный quote/selection evidence; подмена exact unit без согласия не разрешена. Manual blocks/owner stay/import должны сверяться с тем же физическим инвентарём. Детальные enum values и SQL sources — в REFERENCE.

## Финансы

Cash/transfer — запись подтверждённого сотрудником факта, не автоматическая проверка банка. Opn реализован как adapter с проверкой фактов через provider API; production merchant account и успешный charge/refund этим обзором не подтверждены. `PAYMENT_PROVIDER=opn`; mock запрещён в production. Ledger append-only, corrections через reversal. Расходы имеют business date, source/idempotency и защищённые receipts. Owner statements имеют source snapshots, fingerprint (включая start/end dates брони), lines и sign-off; payout запись не означает автоматический банковский перевод. Provider remittance учитывает accepted economics и fulfillment period. Writer payout повторно проверяет сумму и unresolved refunds под provider/order locks, запрещает пересекающиеся/открытые периоды; неоднозначная late pre-payout refund adjustment блокируется для reconciliation, а не исчезает из расчёта.

## Коммуникации, фоновые работы и федерация

Email использует Resend; console без provider config не считается доставкой. NotificationDelivery образует post-commit queue: TransactionClient сохраняет pending, root writer или frequent sweep выполняет bounded dispatch с advisory lock, стабильным Idempotency-Key и ограниченным retry window; legacy ambiguous pending не переотправляются автоматически. Внутренние сообщения/уведомления читаются из БД polling (15/30s), с refresh по focus/visibility и защитой от запоздалых responses. In-process SSE buses остаются локальными. WhatsApp/Telegram integration records не являются реализацией отправки.

Production migration workflow требует successful push CI на точном main SHA, успешный backup/restore, approved pending migrations/checksums и financial parity; deployment остаётся отдельным действием.

10 registry jobs покрывают booking lifecycle, TM30 escalation, iCal sync, verification deadlines, retention, metrics rollup, guest lifecycle, service expiry, deposit release, preventive maintenance. GitHub scheduler вызывает frequent slot каждые 5 минут и nightly в 19:00 UTC; Vercel содержит daily backup slots и отдельный media import cron. Факт запуска подтверждается JobRun, не наличием yaml.

Layantara intake использует ExternalSystem(environment), ExternalMapping, ExternalEventInbox, ExternalAggregateCheckpoint, подписи/идемпотентность/версии и quarantine. Приём операционных данных draft-villa не публикует её. Workbook payment label не доказывает оплату. Полномочия myUNO cutover проверяются конфигурацией, а не названием объекта. iCal переносит occupancy/conflicts, не полный ARI.

## Все каталоги модулей

### `analytics` — Аналитика и коммерческие сигналы

**Реализовано:** События, дневные агрегаты, KPI, occupancy/revenue/channel reports, buyer signals, purchase interest.

**Поверхности:** /app/admin/operational-kpis · /app/admin/reports/attribution · /app/admin/signals.

**Остаток / проверка:** Подтвердить формулы на реальных данных, полноту событий воронки и доступ к отчётам.

[Исходники](../../src/modules/analytics/README.md) · [полный состав файлов/exports](REFERENCE.md#module-analytics)

### `audit` — Журнал действий

**Реализовано:** Запись и поиск AuditLog по субъекту, исполнителю, времени и области.

**Поверхности:** /app/admin/audit.

**Остаток / проверка:** Проверить покрытие привилегированных действий и сохранность журнала при отказах.

[Исходники](../../src/modules/audit/README.md) · [полный состав файлов/exports](REFERENCE.md#module-audit)

### `auth` — Авторизация

**Реализовано:** Регистрация, пароль, email verification/reset, claim приглашения; подписанные cookie; Google OAuth через маршруты auth.

**Поверхности:** /login · /register · /auth/claim · /account.

**Остаток / проверка:** Проверить доставку писем, настройки Google и отзыв сессий в развёрнутом окружении.

[Исходники](../../src/modules/auth/README.md) · [полный состав файлов/exports](REFERENCE.md#module-auth)

### `booking` — Бронирование и проживание

**Реализовано:** Quote/selection exact unit или category, request/approve/decline, pending payment, confirmation, отмена, перенос дат, extension, no-show, check-in/out, группы броней, Home Space, отзывы и lifecycle reminders.

**Поверхности:** /book/review · /trips · /ops/reservations · /ops/stays/[bookingId].

**Остаток / проверка:** Полный сценарий BookingReschedule с replacement hold и оплатой разницы не найден: модель существует, текущий changeBookingDates меняет бронь напрямую. Проверить гонки и все денежные переходы на отдельной БД.

[Исходники](../../src/modules/booking/README.md) · [полный состав файлов/exports](REFERENCE.md#module-booking)

### `browse` — Поиск и избранное

**Реализовано:** Фильтры amenities, сортировка, map bounds, рейтинги, сохранённые квартиры и поиски. Общий поиск мест находится также в src/lib/place-search.ts.

**Поверхности:** /search · /saved.

**Остаток / проверка:** Проверить полноту подсказок, координаты, результаты на реальном каталоге и мобильной карте.

[Исходники](../../src/modules/browse/README.md) · [полный состав файлов/exports](REFERENCE.md#module-browse)

### `comms` — Общение и поддержка

**Реализовано:** Threads/messages, in-app notifications, email delivery records, объявления, лиды, tickets/SLA, disputes и контроль аудитории. SSE buses находятся в памяти процесса.

**Поверхности:** /messages · /tickets · /announcements · /app/admin/tickets.

**Остаток / проверка:** Клиенты уже читают durable messages/notifications polling через БД (15/30 секунд); добавлены refresh на focus/visibility и защита от stale responses/revoked access. In-memory SSE не является межсерверным транспортом. Внешние messenger adapters отсутствуют; фактическая доставка проверяется отдельно.

[Исходники](../../src/modules/comms/README.md) · [полный состав файлов/exports](REFERENCE.md#module-comms)

### `compliance` — Разрешённые коммерческие действия

**Реализовано:** RegulatoryCredential и commercial eligibility для short-term, long-term и sale.

**Поверхности:** /app/admin/compliance · /app/admin/compliance-checklists.

**Остаток / проверка:** Подтвердить документы, сроки и допустимость использования по каждому объекту; код не удостоверяет юридические факты.

[Исходники](../../src/modules/compliance/README.md) · [полный состав файлов/exports](REFERENCE.md#module-compliance)

### `config` — Конфигурация и секреты

**Реализовано:** Реестр параметров, override по scope, журнал изменений, booking windows, encrypted secret vault.

**Поверхности:** /app/admin/config · /app/admin/access.

**Остаток / проверка:** Проверить действующие значения и права раскрытия секретов; наличие vault entry не доказывает подключение сервиса.

[Исходники](../../src/modules/config/README.md) · [полный состав файлов/exports](REFERENCE.md#module-config)

### `content` — Контент и языки

**Реализовано:** ContentKey/Translation, CMS CRUD/CSV, namespaces, review status, draft fallback, локали ru/en/th/zh; RU по умолчанию.

**Поверхности:** /app/admin/content · /app/admin/content/homepage.

**Остаток / проверка:** ZH поддерживается кодом, но полнота переводов не подтверждена. Проверить review gate, реальные ключи, fallback и мобильные подписи.

[Исходники](../../src/modules/content/README.md) · [полный состав файлов/exports](REFERENCE.md#module-content)

### `core` — Идентичность, права, цены и доступность

**Реализовано:** Identity/organizations/roles, invites/claim, permission matrix, scoped capabilities, engagement, canonical pricing, tariffs, blocks, retention, account/session revoke.

**Поверхности:** /app/admin/people · /property/access · /property/pricing · /property/booking-mode.

**Остаток / проверка:** Продолжить аудит всех писателей прав и scoped read paths. Сверить тарифы и booking-policy approval по каждому scope.

[Исходники](../../src/modules/core/README.md) · [полный состав файлов/exports](REFERENCE.md#module-core)

### `crm` — CRM и сделки

**Реализовано:** CrmProfile, opportunities/stages, activity, public leads, attribution, consent; PropertyDeal с приватными доказательствами.

**Поверхности:** /app/admin/crm · /app/admin/crm/opportunities/[id]/deal.

**Остаток / проверка:** Проверить handover из выигранной сделки, полноту ежедневных next actions и показатели pipeline. Не выдавать CRM за омниканальную доставку.

[Исходники](../../src/modules/crm/README.md) · [полный состав файлов/exports](REFERENCE.md#module-crm)

### `destinations` — Направления

**Реализовано:** Реестр направлений и построение ссылок destinationPath. Данные районов обслуживаются projects/area.service.ts.

**Поверхности:** /areas · /areas/[slug].

**Остаток / проверка:** Проверить фактическое покрытие направлений; расширение географии требует контента и supply.

[Исходники](../../src/modules/destinations/README.md) · [полный состав файлов/exports](REFERENCE.md#module-destinations)

### `finance` — Оплаты и расчёты

**Реализовано:** Cash/transfer records, Opn checkout/webhook/refund adapter, append-only ledger/reversals, manual costs/private receipts, deposits/claims, statements snapshots/sign-off, payouts/remittances/reconciliation.

**Поверхности:** /ops/costs · /ops/refunds · /owner/statements · /app/admin/statements · /app/admin/payouts.

**Остаток / проверка:** Opn требует merchant configuration и доказательства реального charge/refund. Проверить statements на границах периодов, суммы, повторные выплаты и возвраты. Launch-readiness согласован с PAYMENT_PROVIDER=opn и реальной public/secret key конфигурацией; live charge/refund остаётся отдельной проверкой.

[Исходники](../../src/modules/finance/README.md) · [полный состав файлов/exports](REFERENCE.md#module-finance)

### `home` — Главная страница

**Реализовано:** Public homepage read model, ранжирование комплексов, распределение квартир между проектами, editorial placement, группировка услуг.

**Поверхности:** /.

**Остаток / проверка:** Подтвердить актуальные фото, контент, размещения и поведение при сбое БД на опубликованной версии.

[Исходники](../../src/modules/home/README.md) · [полный состав файлов/exports](REFERENCE.md#module-home)

### `integrations` — Интеграции и Layantara

**Реализовано:** IntegrationAccount, encrypted config, iCal import/export/signing/conflicts; Layantara mappings, versioned inbox/checkpoint, signed channel intake, protection, workbook dry-run/import.

**Поверхности:** /app/admin/integrations · /app/admin/layantara.

**Остаток / проверка:** Полный OTA ARI/channel manager отсутствует. WhatsApp/Telegram registration/webhook seams есть, отправка явно возвращает MESSENGER_ADAPTER_UNAVAILABLE. Проверить cutover/config/лаг в production.

[Исходники](../../src/modules/integrations/README.md) · [полный состав файлов/exports](REFERENCE.md#module-integrations)

### `media` — Фотографии и файлы

**Реализовано:** Vercel Blob upload, signed direct upload/finalization, MIME/size/signature checks, cover/order/gallery readiness, video policy, managed Yandex import.

**Поверхности:** /app/admin/projects/[id]/media · /property/content.

**Остаток / проверка:** Проверить реальную загрузку и повтор finalize в окружении с Blob. Readiness и upload используют общий parser token либо OIDC+store; наличие config не заменяет actual upload/finalize acceptance.

[Исходники](../../src/modules/media/README.md) · [полный состав файлов/exports](REFERENCE.md#module-media)

### `onboarding` — Добавление объектов и контент сотрудников

**Реализовано:** Canonical unit resolution, offerings, submission/description, employee draft/review/convert, scoped content proposals с атомарным approval, autosave/template models.

**Поверхности:** /property/onboard · /property/create · /property/content · /app/admin/property-submissions · /app/admin/property-content-proposals.

**Остаток / проверка:** Проверить полный путь нового объекта до публикации, scope/revoke, импорт и восстановление draft. Не приравнивать submit к go-live.

[Исходники](../../src/modules/onboarding/README.md) · [полный состав файлов/exports](REFERENCE.md#module-onboarding)

### `ops` — PMS и операционные пространства

**Реализовано:** Today/board/calendar projections, operating spaces/teams/capabilities, reservations/guest registry, turnover tasks, check-in readiness, housekeeping, maintenance/preventive plans, TM30/passport/condition reports.

**Поверхности:** /ops · /ops/calendar · /ops/spaces · /ops/housekeeping · /ops/maintenance · /ops/tm30.

**Остаток / проверка:** Проверить рабочие смены, командные границы, блокировки готовности, preventive cron, check-out→clean→inspection. TM30 здесь учёт/доказательство подачи, автоматическая отправка государству не установлена.

[Исходники](../../src/modules/ops/README.md) · [полный состав файлов/exports](REFERENCE.md#module-ops)

### `projects` — Недвижимость, владельцы и управляющие

**Реализовано:** Projects/Units/areas/structure/categories/sleeping spaces, ownership periods, owner stay/dashboard, MC portfolio, factual completeness, readiness, public portals, amenities/hours/reservations, nearby/distances, commercial discovery.

**Поверхности:** /projects · /units/[id] · /homes · /owner · /mc · /property/listings.

**Остаток / проверка:** Проверить полноту контента и полномочий. Progressive discovery не означает готовность к бронированию; не публиковать через обход activation gate.

[Исходники](../../src/modules/projects/README.md) · [полный состав файлов/exports](REFERENCE.md#module-projects)

### `services` — Маркетплейс услуг

**Реализовано:** Provider applications/approval, service catalogue/localized copy, project offers, standalone address/area ordering, payment→accept→fulfill, cancel/decline/no-show/refunds, reviews/reminders.

**Поверхности:** /services · /services/orders · /provider · /app/admin/service-orders.

**Остаток / проверка:** ServiceQuoteRequest/Version есть в схеме, но рабочих writers/API не найдено. Добавлены customer confirm, окно подтверждения/спора (по умолчанию 48h), общая row/advisory lock с dispute creation, auto-close в service-order sweep и customer UI deadline; незавершённый спор блокирует закрытие. Закрытие не создаёт commission/payout повторно. SKU/stock/delivery/recurring не реализованы как отдельная торговая система.

[Исходники](../../src/modules/services/README.md) · [полный состав файлов/exports](REFERENCE.md#module-services)

### `workflows` — Сквозные регрессионные сценарии

**Реализовано:** Integration tests expense→owner report, property→financial close и cancelled booking statements. Это тестовый пакет, не runtime workflow engine.

**Поверхности:** Тесты; отдельного пользовательского маршрута нет.

**Остаток / проверка:** Выполнять на изолированной БД; наличие файлов не означает прохождение на текущем commit.

[Исходники](../../src/modules/workflows/README.md) · [полный состав файлов/exports](REFERENCE.md#module-workflows)

## Контент, UX, SEO

Тексты — ContentKey/Translation и seeds, fallback/draft в code; default RU, локали RU/EN/TH/ZH. Наличие locale не является подтверждением полного перевода. Конкретные UI строки/правила review сверять с content service и gate. Design tokens/Tailwind и переиспользуемые компоненты задают оформление; экспорт Stitch — reference, не отдельный runtime.

SEO: metadata, canonical/hreflang helpers, sitemap, robots, llms.txt и JSON-LD существуют. `src/lib/seo.ts` сейчас берёт origin из NEXTAUTH_URL; отдельный NEXT_PUBLIC_SITE_URL находится в открытом PR, не в этом main. Sitemap/robots/JSON-LD и индексацию проверять после назначения домена.

## Архитектура цели и факт

Canonical pack описывает развитие системы, в том числе более полные commercial/fulfillment/settlement states и federation. Наличие модели, enum, страницы или описания в canonical не означает законченный сквозной процесс. Точные неподтверждённые места перечислены в матрице; старые release reports являются историческим evidence только для указанного там commit/environment.

## PMS remediation, 2026-10-21 (local branch)

Reservation guest/finance access, cancellation refund durability/recovery, property-local date boundaries and calendar/form correctness were hardened with regressions. See [scope and verification boundaries](../audits/PMS_REMEDIATION_2026-10-21.md). No production deployment or historical data repair is asserted.

## Sales desk and client proposals (2026-10-21 implementation)

`/ops/sales?spaceId=…` reuses existing reservation capability/effective-unit scope to search canonical availability and pricing, compare up to four alternatives and persist append-only offer revisions. `SalesTariffValidation` independently approves an exact canonical rules/config fingerprint; calculability alone never emits a firm price. No tariff approvals are seeded, including Layantara. Existing booking writer handles explicit staff request handoff with fresh scope/price checks, idempotency and no automatic guest notification.

The explicit share action creates an expiring/revocable hash-only capability. `/proposal` is a standalone shell without authenticated navigation or identity payload; a URL fragment is exchanged through POST for the recursively allowlisted snapshot. No privileged public booking writer exists. Text and browser print/Save PDF use the same snapshot, with stale-version/rule/availability checks. See [sales-offers README](../../src/modules/sales-offers/README.md). Production migration, property tariff approval and deployment are separate release prerequisites.
