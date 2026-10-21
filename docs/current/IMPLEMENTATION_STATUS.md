# Реализованное, незавершённое и проверки

> Follow-up 2026-10-20: [release validation evidence](../audits/release-validation-2026-10-20/RELEASE_EVIDENCE.md) records fresh read-only production schema/content/job facts, 6,055 passing local tests, isolated Chromium acceptance and recovery rehearsal. Release, scheduler activation and real email delivery remain blocked; the operational changes are prepared for review, not deployed.

Дата 2026-10-16; application codeRevision `c61412e71801e345fb7d3cde0168a6631b0b4932`, ops main53634204 после PR294–297. Exact codeRevision указан в REFERENCE; production acceptance оценивается отдельно. Метод: inventory всех pages/handlers/modules/schema/migrations/tests, чтение domain services, guards, adapters, jobs и deployment files. Это сверка кода и документации, не эксплуатационная приёмка.

## Как читать статус

- **Код реализован**: найден рабочий код сценария; не утверждает production readiness.
- **Частично**: есть часть пути/модель, отсутствует существенное звено.
- **Не найдено**: соответствующая реализация не найдена в обследованном main; не учитывать feature из документа/PR как shipped.
- **Не проверено**: нужны credentials, данные, миграции или живое окружение.

Для всех модулей общий live acceptance по-прежнему **не подтверждён**. Backup/restore и отдельные production read-only facts перечислены в [плане](PRODUCTION_READINESS_PLAN.md). Permissions/тесты присутствуют в исходниках, но не имеют общей отметки «пройдено». Не используется выдуманный процент готовности.

Полное сопоставление всех целевых бизнес-процессов CO01–CO30 и функций без отдельного runtime-модуля (AI concierge, itinerary/wallet, procurement/capex, standards/offboarding): [PROCESS_COVERAGE](PROCESS_COVERAGE.md).

## По каждому модулю

| Модуль | Что уже есть | Что остаётся реализовать / подтвердить |
|---|---|---|
| [analytics](../../src/modules/analytics/README.md) | События, дневные агрегаты, KPI, occupancy/revenue/channel reports, buyer signals, purchase interest. | Подтвердить формулы на реальных данных, полноту событий воронки и доступ к отчётам. |
| [audit](../../src/modules/audit/README.md) | Запись и поиск AuditLog по субъекту, исполнителю, времени и области. | Проверить покрытие привилегированных действий и сохранность журнала при отказах. |
| [auth](../../src/modules/auth/README.md) | Регистрация, пароль, email verification/reset, claim приглашения; подписанные cookie; Google OAuth через маршруты auth. | Проверить доставку писем, настройки Google и отзыв сессий в развёрнутом окружении. |
| [booking](../../src/modules/booking/README.md) | Quote/selection exact unit или category, request/approve/decline, pending payment, confirmation, отмена, перенос дат, extension, no-show, check-in/out, группы броней, Home Space, отзывы и lifecycle reminders. | Полный сценарий BookingReschedule с replacement hold и оплатой разницы не найден: модель существует, текущий changeBookingDates меняет бронь напрямую. Проверить гонки и все денежные переходы на отдельной БД. |
| [browse](../../src/modules/browse/README.md) | Фильтры amenities, сортировка, map bounds, рейтинги, сохранённые квартиры и поиски. Общий поиск мест находится также в src/lib/place-search.ts. | Проверить полноту подсказок, координаты, результаты на реальном каталоге и мобильной карте. |
| [comms](../../src/modules/comms/README.md) | Threads/messages, in-app notifications, durable post-commit email queue, объявления, лиды, tickets/SLA, disputes и контроль аудитории. SSE buses находятся в памяти процесса. | Клиенты уже читают durable messages/notifications polling через БД (15/30 секунд); добавлены refresh на focus/visibility и защита от stale responses/revoked access. In-memory SSE не является межсерверным транспортом. Внешние messenger adapters отсутствуют; фактическая доставка проверяется отдельно. |
| [compliance](../../src/modules/compliance/README.md) | RegulatoryCredential и commercial eligibility для short-term, long-term и sale. | Подтвердить документы, сроки и допустимость использования по каждому объекту; код не удостоверяет юридические факты. |
| [config](../../src/modules/config/README.md) | Реестр параметров, override по scope, журнал изменений, booking windows, encrypted secret vault. | Проверить действующие значения и права раскрытия секретов; наличие vault entry не доказывает подключение сервиса. |
| [content](../../src/modules/content/README.md) | ContentKey/Translation, CMS CRUD/CSV, namespaces, review status, draft fallback, локали ru/en/th/zh; RU по умолчанию. | ZH поддерживается кодом, но полнота переводов не подтверждена. Проверить review gate, реальные ключи, fallback и мобильные подписи. |
| [core](../../src/modules/core/README.md) | Identity/organizations/roles, invites/claim, permission matrix, scoped capabilities, engagement, canonical pricing, tariffs, blocks, retention, account/session revoke. | Продолжить аудит всех писателей прав и scoped read paths. Сверить тарифы и booking-policy approval по каждому scope. |
| [crm](../../src/modules/crm/README.md) | CrmProfile, opportunities/stages, activity, public leads, attribution, consent; PropertyDeal с приватными доказательствами. | Проверить handover из выигранной сделки, полноту ежедневных next actions и показатели pipeline. Не выдавать CRM за омниканальную доставку. |
| [destinations](../../src/modules/destinations/README.md) | Реестр направлений и построение ссылок destinationPath. Данные районов обслуживаются projects/area.service.ts. | Проверить фактическое покрытие направлений; расширение географии требует контента и supply. |
| [finance](../../src/modules/finance/README.md) | Cash/transfer records, Opn checkout/webhook/refund adapter, append-only ledger/reversals, manual costs/private receipts, deposits/claims, statements snapshots/sign-off, payouts/remittances/reconciliation. | Opn требует merchant configuration и доказательства реального charge/refund. Проверить statements на границах периодов, суммы, повторные выплаты и возвраты. Launch-readiness согласован с PAYMENT_PROVIDER=opn и реальной public/secret key конфигурацией; live charge/refund остаётся отдельной проверкой. |
| [home](../../src/modules/home/README.md) | Public homepage read model, ранжирование комплексов, распределение квартир между проектами, editorial placement, группировка услуг. | Подтвердить актуальные фото, контент, размещения и поведение при сбое БД на опубликованной версии. |
| [integrations](../../src/modules/integrations/README.md) | IntegrationAccount, encrypted config, iCal import/export/signing/conflicts; Layantara mappings, versioned inbox/checkpoint, signed channel intake, protection, workbook dry-run/import. | Полный OTA ARI/channel manager отсутствует. WhatsApp/Telegram registration/webhook seams есть, отправка явно возвращает MESSENGER_ADAPTER_UNAVAILABLE. Проверить cutover/config/лаг в production. |
| [media](../../src/modules/media/README.md) | Vercel Blob upload, signed direct upload/finalization, MIME/size/signature checks, cover/order/gallery readiness, video policy, managed Yandex import. | Проверить реальную загрузку и повтор finalize в окружении с Blob. Readiness и upload используют общий parser token либо OIDC+store; наличие config не заменяет actual upload/finalize acceptance. |
| [onboarding](../../src/modules/onboarding/README.md) | Canonical unit resolution, offerings, submission/description, employee draft/review/convert, scoped content proposals с атомарным approval, autosave/template models. | Проверить полный путь нового объекта до публикации, scope/revoke, импорт и восстановление draft. Не приравнивать submit к go-live. |
| [ops](../../src/modules/ops/README.md) | Today/board/calendar projections, operating spaces/teams/capabilities, reservations/guest registry, turnover tasks, check-in readiness, housekeeping, maintenance/preventive plans, TM30/passport/condition reports. | Проверить рабочие смены, командные границы, блокировки готовности, preventive cron, check-out→clean→inspection. TM30 здесь учёт/доказательство подачи, автоматическая отправка государству не установлена. |
| [projects](../../src/modules/projects/README.md) | Projects/Units/areas/structure/categories/sleeping spaces, ownership periods, owner stay/dashboard, MC portfolio, factual completeness, readiness, public portals, amenities/hours/reservations, nearby/distances, commercial discovery. | Проверить полноту контента и полномочий. Progressive discovery не означает готовность к бронированию; не публиковать через обход activation gate. |
| [services](../../src/modules/services/README.md) | Provider applications/approval, service catalogue/localized copy, project offers, standalone address/area ordering, payment→accept→fulfill, cancel/decline/no-show/refunds, reviews/reminders. | ServiceQuoteRequest/Version есть в схеме, но рабочих writers/API не найдено. Добавлены customer confirm, окно подтверждения/спора (по умолчанию 48h), общая row/advisory lock с dispute creation, auto-close в service-order sweep и customer UI deadline; незавершённый спор блокирует закрытие. Закрытие не создаёт commission/payout повторно. SKU/stock/delivery/recurring не реализованы как отдельная торговая система. |
| [workflows](../../src/modules/workflows/README.md) | Integration tests expense→owner report, property→financial close и cancelled booking statements. Это тестовый пакет, не runtime workflow engine. | Выполнять на изолированной БД; наличие файлов не означает прохождение на текущем commit. |

## Подтверждённые разрывы и следующий результат

| ID / приоритет | Факт и доказательство | Что должно быть сделано | Критерий приёмки |
|---|---|---|---|
| D01 / P1 | Исправлено в коде: readiness принимает opn и реальные public/secret keys без неиспользуемого HMAC secret | Подтвердить merchant config и live provider path | Config regression tests; live charge/refund отдельно |
| D02 / P1 | Исправлено в коде: общий storage credentials parser для token/OIDC+store | Actual upload/finalize/retry на staged deployment | Оба config-пути проверены unit tests; наличие config не означает store health |
| D03 / P1 | Есть ServiceQuoteRequest/ServiceQuoteVersion в schema; runtime обращения к `serviceQuoteRequest`/`serviceQuoteVersion` в src не найдены | Реализовать request→version→accept→order с frozen terms и UI либо явно отключить quote-mode | Полный сценарий с revision/expiry, concurrency и запретом изменения принятой версии |
| D04 / P1 | BookingReschedule есть в schema, runtime delegate calls не найдены; текущий changeBookingDates меняет даты напрямую | Спроектировать и реализовать replacement hold, разницу оплаты/возврата и атомарный commit | Original stay сохраняется до commit; новый hold истекает/освобождается; duplicate payment не переносит дважды |
| D05 / P1 | Добавлены confirm/dispute/window/auto-close writers, route, UI, cron; общая блокировка заказа, atomic ticket+dispute | Пройти DB/concurrency/browser и live acceptance | Confirm/dispute/close без противоречивых состояний и повторного commission/payout |
| D06 / P1 | Messenger send возвращает MESSENGER_ADAPTER_UNAVAILABLE | Выбрать и реализовать внешние WhatsApp/Telegram adapters с delivery evidence | Provider ack/status, idempotency/retry и ошибки; не отправлять сообщения без разрешения |
| D07 / P1 | iCal и Layantara intake есть, полного OTA rate/availability/inventory adapter не найдено | Channel manager остаётся отдельной будущей работой | Авторизованный round-trip ARI, mapping, lag/fallback, recovery, no overbooking |
| D08 / P1 | Durable polling уже реализован (messages15s/notifications30s); добавлены focus/visibility refresh и stale-response guard | Подтвердить end-to-end чтение через независимые экземпляры | Component regression: revoked access очищает приватные данные, поздний ответ их не возвращает |
| D09 / P1 | Build/install не мигрируют; Git deploymentEnabled=false | Для релиза зафиксировать ручной Vercel deployment SHA и отдельный schema rollout | SHA main = deployment source; нужные migrations применены; alias проверен |
| D10 / P1 | Реальный backup/restore run38896564642 успешен; PR293 в main. Scheduler readiness исправлен: учитывает каждый frequent job | Repeat backup на release SHA, production JobRun freshness и restore/external reconciliation | Snapshot всех120 public tables; parity, encrypted artifact12043314893; scheduler regression tests |
| D11 / P2 | Goods/SKU/stock/delivery/recurring/package runtime не найден | Реализовывать только при подтверждённой supply/бизнес-модели | Реальные товары/capacity, принятые terms, fulfillment, refund и settlement |
| D12 / P2 | Locale zh есть, языковой coverage не установлен; SEO origin=NEXTAUTH_URL | Сверить переводы/fallback и canonical origin после выбора домена | RU/EN/TH/ZH критические пути, lang/hreflang/canonical/sitemap без вымышленных URL |
| D13 / P1 | Scope guards, RLS migrations и tests есть; coverage runtime не доказан | AT28: проверить owner/MC/provider/employee cross-scope reads/writes/export/media | Foreign IDs запрещены, revoke немедленно закрывает действие, audit не раскрывает PII |
| D14 / P1 | Исправлено в коде: start/end calendar dates входят в statement source fingerprint | DB period-boundary/signed-history regressions passed в PR295; live acceptance остаётся открытой, PR274 требует reconciliation | Same total + moved dates инвалидирует unsigned draft; issued/signed history не переписывается |
| D15 / P1 | Production content gate fail-closed, safe diagnostics, explicit isolated loopback test exception | В production обнаружено4213 needs_review; требуется содержательное review | Missing/unreachable/pending/valid и CI bypass policy tests; никакого blanket approval |

Приоритет P1 означает важность для надёжного запуска соответствующей функции, а не доказанный production-инцидент. P0 назначается только при подтверждённом нарушении безопасности/денег/инвентаря.

## Реальные проверки, которые ещё нужны

| Процесс | Проверка |
|---|---|
| Публикация | Новый комплекс/квартира → scope → draft → фото → tariffs/offering → review → publish → публичная карточка; недостающие сведения отображаются честно |
| Гостевая бронь | Search→quote→request/instant→payment→confirmed; expiry; два одновременных покупателя; category consent |
| Деньги | Cash/transfer receipt; provider test charge/webhook/refund; late payment; payment duplicate; cancellation/retained revenue; manual cost/receipt→statement→sign-off→payout |
| PMS | Arrival/check-in gate→guest register→TM30→extension→checkout→cleaning→inspection→ready; maintenance blocker; no-show; night audit |
| Услуги | Project и standalone order, paid-before-accept, fulfill, no-show/cancel/refund, rating, provider settlement |
| Доступ | Platform/project/unit/org/provider/space/team scopes, истечение и отзыв делегирования; private receipts/passports/deal files |
| Контент/медиа | Admin QA upload→Blob→MediaAsset→reload подтверждён на старом deployedSHA; direct upload/finalize/retry/foreign scope, cover/reorder/delete, amenities/fallback ещё требуют acceptance |
| UX | 320/360/390/430 px, desktop, keyboard, loading/error/empty/stale, RU/EN/TH/ZH |
| Эксплуатация | Exact deployed SHA, migrate status, content gate, scheduler recent success, restore и reconciliation после восстановления |

## Открытые PR на момент сверки

Повторно проверено через GitHub16 октября после merge PR297. Содержимое этих открытых PR не засчитывается автоматически как main; PR294–297 с исправлениями readiness уже merged.

| PR | Тема | Что сделать перед зачётом |
|---|---|---|
| [#283](https://github.com/pavel949/myUNO-final/pull/283) | Homepage TS/lint | Сверить diff с main, фактические checks и нужность изменения |
| [#279](https://github.com/pavel949/myUNO-final/pull/279) | Progressive condo publication | Проверить draft visibility, missing details и сохранность booking gates |
| [#277](https://github.com/pavel949/myUNO-final/pull/277) | Occupancy regression gates | Проверить delta и выполнить изолированные concurrency tests |
| [#275](https://github.com/pavel949/myUNO-final/pull/275) | Separate canonical site origin | Сверить metadata consumers и проверять после назначения домена |
| [#274](https://github.com/pavel949/myUNO-final/pull/274) | Statement dates fingerprint | Сверить текущий fingerprint, tests и историю подписанных statements |

## Проверяемые источники

- [Launch readiness](../../src/lib/launch-readiness.ts)
- [Payment provider seam](../../src/modules/finance/providers/index.ts)
- [Blob service](../../src/modules/media/media.service.ts) и [direct upload](../../src/modules/media/direct-upload.service.ts)
- [Schema](../../prisma/schema.prisma)
- [Service order lifecycle](../../src/modules/services/service-order.service.ts)
- [Booking lifecycle/date changes](../../src/modules/booking/booking.service.ts)
- [Messenger seam](../../src/modules/integrations/messenger.ts)
- [Thread bus](../../src/modules/comms/thread.bus.ts), [notification bus](../../src/modules/comms/notification.bus.ts)
- [Vercel config](../../vercel.json), [workflows](../../.github/workflows)

Повторная проверка после изменения кода: обновить срез, status/evidence, справочник и release evidence. Старое «already fixed» из design/reconciliation не переносится без повторной сверки.


## 2026-10-18: вход администратора в редактирование карточек

Вход `/property/content` без выбранного объекта/предложения направляет активного администратора в существующий `/app/admin/projects`, вместо пустого списка назначений сотрудника. Сотрудники сохраняют прежний scoped proposal editor; явные target/proposal deep links не изменены. Новых прав и обхода review нет. Добавлены регрессионные проверки в `src/app/property/workspace-nav.test.tsx`. Это исправление навигации, не подтверждение полной приёмки публикации или готовности production.

## 2026-10-19: обновление зависимостей по `npm audit`

Next.js 14.2.35 → 15.5.28 (закрыты advisory уровня critical/high, в т.ч. RCE в Image Optimizer), maplibre-gl 4.7.1 → 6.15.0 (XSS sanitizer bypass), вложенный PostCSS Next переопределён на корневой patched-версию через `overrides`. `npm audit --omit=dev`: 0 уязвимостей. Request-API (`params`, `searchParams`, `headers`) переведены на async-форму по codemod; `getRequestLocale` и `handleError` оставлены на синхронном `UnsafeUnwrapped*` (работает в Next 15, удаляется в Next 16 — отдельная миграция ~140 вызовов). Dev-зависимости (vitest toolchain и др.) не обновлялись, их advisories не входят в production-сборку. Это проверка кода и сборки (tsc, eslint, `next build`, unit-тесты без БД), не live-приёмка: на staged deployment нужно проверить карту поиска, изображения, навигацию и cookie-локаль.

Известное ограничение React 19.2 (Next 15.5): ложная ошибка гидратации #418 на идентичном дереве, когда Flight-узел страницы лежит прямо в дочерних элементах DOM-тега при поэтапной гидратации ([react/react#37584](https://github.com/react/react/issues/37584), исправлено в React 19.3.0, в 19.2 не бэкпортируется). `ApplicationFrame` оборачивает контент страницы в `ContentSlot` (отдельный fiber); обходной путь убрать при переходе на Next с React ≥ 19.3. Локальные изолированные прогоны `founder-publication-booking` на production-сборке: без обхода 8–14 ошибок #418 за прогон, с обходом 0 в трёх прогонах подряд (25/25 шагов). Не покрыт исходящий баг [react/react#37321](https://github.com/react/react/issues/37321) (редкая гонка при холодной загрузке с кэшированными чанками).

## Historical observation: 2026-10-19 production after #312/#313

This dated snapshot is retained as historical evidence only. Its pending-migration and deployment identifiers are superseded: read-only verification on 2026-10-21 found both October 15 migrations applied on October 18, and the alias serving deployment `dpl_7MnyfYxJU8fYz7xT4fpaWz5jXdd5` at the same `8bb999a6` source. The refund authorization migration remains pending; current release status requires fresh verification.

Только чтение (Vercel, Resend, история GitHub Actions); production не менялся, миграции и deploy не запускались.

- **Release.** `main` = `1fa0309d` (Next 15.5.28, maplibre-gl 6.15.0). Alias `my-uno-final.vercel.app` → `dpl_DBLCzT2HfMDARmWviY7LqHWAMkjr`, source `8bb999a6` (PR #306, 18 октября): эти исправления на живом сайте ещё не работают. Deploy новой ревизии остаётся за защищённой миграцией (две ожидаемые pending migrations, preflight ранее: `network_unreachable`) и ручным решением; git auto-deploy выключен.
- **Email.** Единственный домен Resend `send.ignatevestate.com` в статусе **failed**: все три записи (DKIM TXT `resend._domainkey.send`, SPF MX и SPF TXT на `send.send`) не прошли проверку. DNS `ignatevestate.com` не управляется Vercel (в проекте только `bymyuno.com` и `myuno.app`, NS Cloudflare), поэтому записи вносит владелец DNS. Выбор sender-домена (`ignatevestate.com` против домена продукта) — решение основателя. До verified письма не доставляются.
- **Scheduler.** GitHub `*/5` фактически срабатывает редко: за 24 часа до 2026-10-19 11:24 UTC зафиксировано 9 scheduled-запусков вместо 288, максимальный интервал ≈5,5 ч, все success. Vercel Hobby допускает cron не чаще раза в сутки (см. комментарий в `scheduler.yml`). Заявленная частота 5 минут (hold expiry, TM30, iCal) не достигнута; `SCHEDULER_MODE=external` ставить нельзя. Варианты: платный план Vercel с `*/5` в `vercel.json` либо внешний бесплатный триггер (например, Cloudflare Workers Cron) на `/api/cron/run-frequent` с `CRON_SECRET`; выбор и расходы — решение основателя.
- **Dependabot.** #307 и #308 (patch-группы): `ci` красный на текущем `main`, причина в логах job не установлена; #310/#311 (vitest 1.6 → 5.0.5, major) красные и по `ci`, и по браузерной приёмке — не принимать без отдельной миграции test-инфраструктуры. #309 (maplibre 6.14.0) устарел после #313.
- **Внешние checks `myunoapp`.** Красные checks с этим именем — сторонняя интеграция GitHub, не относящаяся к платформе deployment; Vercel — единственная платформа. Интеграцию нужно отключить в её собственном проекте.
## PMS remediation, 2026-10-21 (local branch)

Reservation guest/finance access, cancellation refund durability/recovery, property-local date boundaries and calendar/form correctness were hardened with regressions. See [scope and verification boundaries](../audits/PMS_REMEDIATION_2026-10-21.md). No production deployment or historical data repair is asserted.

## Property-card editing, 2026-10-21 (local branch)

PMS project-facts saves use descriptive fields without legacy facility arrays. Unit writers validate physical facts; the PMS unit/project forms submit optimistic versions and retain failed/conflicting edits. Editors expose distinct area measurements, protect unsaved navigation and localize controls. Administrators can maintain documentary sleeping spaces/beds from the PMS editor using the existing admin guard; staff permissions and physical capacity are unchanged. Gallery uploads retain distinct asset ownership and refresh partial results after failure. See [verification and remaining boundaries](../audits/PROPERTY_CARD_EDITING_2026-10-21.md). No production deployment, migration or property-data repair is asserted.
