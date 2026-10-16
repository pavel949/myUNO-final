# Покрытие целевых процессов: CO01–CO30

Срез исходников2026-10-16; exact codeRevision в [REFERENCE](REFERENCE.md). Это сверка наличия и границ реализации, **не отметка прохождения E2E**. Целевые определения: [PROCESS_MAP](../canonical/PROCESS_MAP.md), [паспорта](../canonical/PROCESS_PASSPORTS.md), [AT01–AT30](../canonical/READINESS_ACCEPTANCE.md). Конкретные источники/методы API/модели/тесты: [REFERENCE](REFERENCE.md); известные технические разрывы D01–D15: [матрица](IMPLEMENTATION_STATUS.md).

«Код пути есть» означает, что найдены связанные services/UI; полнота всех требований паспорта и production acceptance требует отдельного доказательства. «Частично» не означает, что отсутствующая часть может быть заменена ручным изменением БД.

| ID | Процесс | Что есть в текущем коде | Что остаётся до полного целевого процесса |
|---|---|---|---|
| CO01 | Лид → первое действие | Public lead, Identity/profile/opportunity, CRM activity, attribution; `/app/admin/crm` | Подтвердить ответственного, fallback inbox и обязательный next action для каждого источника; внешние channels не доставляют автоматически |
| CO02 | Квалификация → конверсия | Opportunity stages/activities, PropertyDeal; booking/service/onboarding существуют отдельно | Полный shortlist/proposal/negotiation и typed downstream handover не доказан одним сценарием |
| CO03 | Поиск внешнего партнёра | Organizations/CRM, integration records, external references и коммерческие контексты | Не доказан sourcing request→accepted partner terms→fulfillment evidence→commission receivable; внешняя listing не становится managed от наличия записи |
| CO04 | Привлечение владельца | `/owners`, `/rent-out`, `/manage`, lead intake, engagement/contract/onboarding | Проверить inspection/qualification→commercial proposal→approved mandate→onboarding без потери context |
| CO05 | Добавление недвижимости | Submission/drafts, employee creation/review/convert, canonical Unit, offerings/readiness, `/property/onboard` | Проверить все шесть стадий, resume/import/templates, owner proof/team/services и readiness на реальных данных; submit не означает activation |
| CO06 | Изменение тарифа/дистрибуции | Scoped pricing editor, canonical tariff preview/save, booking mode delegation; `/property/pricing` | Full external ARI distribution отсутствует; проверить approval, concurrent revisions и health после activation |
| CO07 | Бронь | Search/quote/availability/hold/request/payment/confirmation, unit/category consent, Trips | Проверить concurrency/idempotency/late payment/expiry/real provider на полном сквозном пути |
| CO08 | До заезда | Guest lifecycle messages, Trips, passports, stay work items, access/readiness data | Полный ETA/transfer/services handover и ответственные за каждый blocker не доказаны; автоматической itinerary orchestration не найдено |
| CO09 | Заезд | Check-in assessment/checklist, guest registry, verification/TM30, readiness; `/ops/stays/[bookingId]/check-in` | Проверить своевременный доступ, PII isolation и фактическую TM30 filing evidence; блокирующий ремонт теперь запрещает заезд |
| CO10 | Запрос во время проживания | Home Space, messages, tickets, tasks, service orders, SLA | Проверить triage/acknowledgment→назначение→гостевой видимый результат и fallback между типами обращений |
| CO11 | Уборка | Turnover tasks, housekeeping, inspection/readiness transitions | Проверить recurring entitlement/shift/checklist/supervisor exceptions. Уборка не снимает независимый maintenance blocker |
| CO12 | Техобслуживание | Reactive/preventive tasks/plans, blocksInventory, costs/evidence; `/ops/maintenance` | Полный estimate→approval threshold→parts/vendor/procurement→inspection/reopen ещё не доказан |
| CO13 | F&B | Project amenity/F&B editorial, provider/service catalogue и reservations могут описывать реальную supply | Специализированный kitchen/menu/allergy/pax/stock/waste workflow не найден как законченный контур; не обещать работу ресторана по amenity record |
| CO14 | Услуга/товар/аренда | Standalone/project service order, fixed/hourly/person price model, payment→accept→fulfill, cancel/no-show/refund | Customer confirmation/48h dispute window/auto-close добавлены и требуют проверок, указанных в оценке; quote version acceptance/capacity требуют завершения; goods/SKU/delivery/recurring не реализованы как полный commerce engine |
| CO15 | Выезд | Checkout, condition report, claim/refund/deposit paths, turnover task generation, post-stay messages/reviews | Проверить access return, final finance/claim и handover к cleaning/inspection одним сценарием |
| CO16 | Отмена/перенос/продление/no-show | Cancellation policy/refund quote, cancel/changeBookingDates/extension/no-show | Replacement-hold BookingReschedule lifecycle не найден в runtime; linked service reconciliation/funding failure требуют доказательства |
| CO17 | Жалоба/инцидент/спор | Tickets/events/media, incidents, Dispute decision/remedy links | Проверить все типы subject/approver scopes, reopen и late refund; fulfillment/dispute/closure race пока не завершён как общий services workflow |
| CO18 | Закупки | Manual cost/receipt/ledger, task estimated/actual cost | Requisition→supplier quotes→approval→purchase order→partial receipt→invoice/payable reconciliation не найден как полный процесс. Expense record не заменяет закупку |
| CO19 | Финансовое закрытие периода | Payments/refunds/ledger/costs, owner statement snapshot/sign-off, payouts/provider remittances/reconciliation | Проверить period boundaries, retained cancelled revenue, stale fingerprints, obligation allocation и actual bank transfers |
| CO20 | Согласование с владельцем/capex | Owner portal/evidence, tickets/tasks, management context и costs | Отдельный полный approval/budget→procurement/work→evidence→asset-history workflow не доказан |
| CO21 | Проживание владельца | `bookOwnerStay`, ownership/availability locks, cleaning scheduling, owner dashboard | Проверить effective ownership/scope, services/turnover и запрет двойной брони |
| CO22 | Жизненный цикл сотрудника | Invite/claim, org/roles/scopes, password reset/change, block/revoke, operating space/team/delegation | Полный deactivation→session revoke→task/account reassignment и multi-space смены требуют E2E |
| CO23 | Жизненный цикл поставщика | Apply/approve/reject/provider membership, service review, orders, remittances | Coverage/capacity/docs/terms, suspend/offboard и незавершённые obligations проверить до claims о verified network |
| CO24 | Контент/медиа | CMS/i18n/review gate, content proposals/atomic approval, Blob/direct upload/gallery/order/cover | Проверить rights/provenance, freshness/archive, real upload/retry/revoke и языки; gate fail-open указан как D15 |
| CO25 | Стандарты | Compliance credentials/checklists, property data/readiness и public responsibility | Полный standard-version→applicability→assessment→exception→corrective action→endorsement не доказан. Readiness score не является сертификацией |
| CO26 | Гость → покупатель → владелец | Buyer signals/interest, CRM lifecycle/opportunities, PropertyDeal, OwnershipPeriod | Проверить viewing/diligence/legal evidence→ownership→management handover; CRM won не создаёт право собственности сам по себе |
| CO27 | Смена владельца/оператора | Ownership history/effective dates, engagement/contracts, roles, immutable statement/payment history | Проверить future booking/service responsibility и settlement split/authority cutover целиком; не выводить готовность из одной setUnitOwner |
| CO28 | Завершение управления/партнёрства | Status/role revoke, retention/export capabilities, financial/history records | Единый offboarding case с future obligations, guest handover, exports, final finance и archive не доказан |
| CO29 | Сбой интеграции/восстановление | iCal health/conflicts, Layantara durable inbox/mapping/checkpoint/quarantine/dedup, observability/jobs | Проверить outages/stale fallback/retry/replay и операционную recovery; external messenger adapters/ARI отсутствуют |
| CO30 | Управленческий обзор периода | Admin dashboard/KPI/reports, CRM pipeline, ledger/statements, incidents/process views | Единый review→decisions→owners/deadlines→follow-up не доказан; dashboard не является выполненным управленческим циклом |

## Целевые функции вне существующих модулей

| Цель | Текущий факт | Следующая работа |
|---|---|---|
| AI concierge | Runtime integration с LLM/agent action orchestration не найдена. Concierge contact CTA — ручная связь | Определить допустимые данные/intent/confirmation и authority boundaries; реализовать реальную интеграцию, затем acceptance без вымышленных цен/availability |
| Itinerary / Vacation Planner | Trips/Home Space есть; отдельные itinerary model/route/orchestration в этом срезе не найдены | Описать и реализовать guest schedule/context, links к booking/service и восстановление после отмены/переноса |
| Wallet | Payments/refunds/receivables есть; отдельный wallet ledger/UI не найден; слово wallet в комментарии не feature | Определить необходимый сценарий без неподтверждённых обещаний custody/credit; не считать payment history кошельком |
| Goods/rentals/packages/recurring | Обычные Service/ServiceOrder и отдельные ProjectAmenityReservation есть | Реализовать stock/resource/occurrence/line-level fulfillment только для подтверждённой supply; amenity reservation не полный equipment rental |
| Procurement/owner capex approvals | Expenses/tasks дают часть входных данных | Отдельный approved purchase/receipt/payable/owner consent процесс, роли, доказательства и reconciliation |
| Standards / endorsement lifecycle | Credentials/readiness/public responsibility дают основу | Versioned applicability/assessment/evidence/exceptions и проверяемое право публичного endorsement |
| Cross-channel inbox | Internal threads/email delivery и integration registrations есть | Реальные inbound/outbound adapters для каналов; не выдавать WhatsApp deep link или запись activity за синхронизированный inbox |
| Physical capacity commercial variants | Один физический Unit и canonical occupancy есть | AT18: проверить alternate bedroom/offering modes одним concurrency test и реальными commercial configurations; модель предложения не доказывает защищённость всех вариантов |

## Приёмка

Ни один CO/AT здесь не помечен «полностью готов в production». Для закрытия конкретного процесса нужны actor/scope, state/money, exceptions, idempotency, message/job evidence, handover, UX и результат соответствующего acceptance scenario на точном deployment. Тестовый прогон подтверждает только выполненные assertions своего окружения.

Открытые архитектурные требования сохраняются в canonical pack. Технические confirmed gaps и запусковые неизвестные — в IMPLEMENTATION_STATUS; эта таблица дополняет их полной картой целевых бизнес-процессов.
