# План доведения myUNO до production readiness 9/10

Дата: 2026-10-16. База плана: main `1d600e95bbcb13515c924c0b0713ed90f84064e5`, инвентаризация всех модулей/CO01–CO30, текущие CI/browser результаты, реальный restore run 38896564642 и read-only SQL. В production: 44 live и 12 draft units; канонических bookings/payments/service orders в момент проверки нет. Нулевые таблицы не являются доказательством исправности процессов.

## Что означает 9/10

Оценка относится к эксплуатации опубликованного продукта: прямые бронирования, PMS, owner/MC/provider scopes, деньги/отчёты, текущие услуги, media и восстановление. Полнота будущей платформы (AI/wallet/товарный склад/full ARI) оценивается отдельно и не объявляется готовой. При запуске должны честно отображаться доступные способы оплаты и каналы связи; неподключённые возможности не могут обещать исполнение.

Достижение цели требует >=90 подтверждённых баллов по следующей таблице **и отсутствия критического провала денег, приватности, инвентаря, восстановления или обязательного operational flow**. Не проверено = 0 подтверждённых баллов; «код написан» не закрывает runtime acceptance. Это фиксированная модель приёмки, не маркетинговый процент.

| Область | Вес | Обязательное доказательство |
|---|---:|---|
| Релиз | 15 | Exact main CI; protected production migration с fresh backup; served deployment SHA; health и реальные route/auth responses |
| Доступ и приватность | 15 | Guest/owner/MC/provider/staff cross-scope denial, revoke/session, private passports/receipts/media, audit |
| Бронирование и услуги | 20 | Quote/request/instant/hold/payment/expiry/cancel/extension/reschedule; service paid/accept/fulfill/refund; duplicate и concurrent calls |
| PMS | 15 | Arrival/check-in/verification/TM30→stay→checkout→cleaning→inspection; maintenance blocker, preventive tasks, команды |
| Деньги и owner reports | 15 | Cash/transfer и доступный provider path; late/duplicate payment/refund; cost/receipt→statement/freshness→sign-off→payout; period boundaries |
| Контент и media | 10 | Draft→scoped edit/review→real Blob upload/finalize/retry→publish→public gallery; mobile/языки; недостающие сведения видны |
| Эксплуатация | 10 | JobRun cadence/failures, alerting, consistent backup→restore parity, key recovery; проверка внешних последствий после restore |

## Последовательность и конкретные изменения

| Пакет | Факт/проблема | Работа | Проверка результата | Статус |
|---|---|---|---|---|
| R01 | Backup был блокером | Сохранить уже выполненный PR #293; повторить protected backup на exact release SHA | Consistent snapshot всех application tables + row-count/digest parity + encrypted artifact | Реальный restore уже подтверждён; repeat at release |
| R02 | Readiness ожидает omise, runtime принимает opn | Исправить provider key и требования; не требовать неиспользуемый HMAC secret | Config tests для opn/unsupported/mock/key mode; provider HTTP tests; real merchant smoke только с настроенным account | Код и целевые unit/policy tests готовы; runtime отдельно |
| R03 | Readiness игнорирует Blob OIDC/store | Общий parser поддержанных storage credentials; корректный secret catalog и отсутствие ложного «storage ready» | Token/OIDC/invalid/missing config; actual upload/finalize/retry on staged deployment | Код и целевые unit/policy tests готовы; runtime отдельно |
| R04 | Content gate пропускает недоступную БД | Production fail-closed, безопасные логи и проверяемая pure policy; dev/isolated CI override явно отделён | Missing/unreachable/review-pending/reviewed cases; никакого bulk approval и отключения review ради релиза | Код и целевые unit/policy tests готовы; runtime отдельно |
| R05 | Statement fingerprint не содержит даты брони | Включить canonical start/end в source fingerprint; historical issued snapshots не менять | Same total + changed dates invalidates unsigned draft; signed snapshot remains readable/immutable | Код и regression test готовы; открытый PR274 содержит пересекающееся изменение |
| R06 | Readiness scheduler может учитывать только первый frequent job | Требовать freshness каждого frequent job и отсутствие unhealthy registry rows | One fresh + one stale никогда не green | Код и целевые unit/policy tests готовы; runtime отдельно |
| R07 | Риск межсерверных уведомлений | Сохранить уже работающие DB polling в NotificationBell и thread-client; укрепить auth/error/race/visibility refresh | Независимые экземпляры читают сохранённые сообщения; revoke закрывает доступ; повтор отправки не дублирует | Polling сохранён; race/revoke/focus/visibility component tests пройдены |
| R08 | Услуги не имеют полного confirm/dispute/close пути | Завершить атомарные переходы, сроки, customer UI и nightly close; не переписать payment/fulfillment/settlement в один статус | Concurrent confirm/dispute/close, duplicate, provider/remittance/refund, real UI | Код route/UI/job/domain готов; DB/concurrency acceptance в CI |
| R09 | Reschedule model без replacement-hold runtime | Добавить предложение новых дат/hold, frozen quote, funding/refund delta, atomic commit/expiry и восстановление | Original booking сохраняется до успешного commit; нельзя double book или оплатить дважды | Запланировано |
| R10 | Quote-priced services отправляют на ручной контакт | Сохранить честный manual fallback; реализовать versioned quote→accept→existing order без client-authoritative total | Expiry/revision/concurrent accept, foreign ID denial, one order, immutable accepted terms | Запланировано |
| R11 | Live release отстаёт от main | После green exact-main protected migration создать staged production deployment; verify→promote | Alias SHA + authenticated property/PMS routes, no404, health; rollback compatible | После кода/CI; без дублирования уже активного release workflow |
| R12 | Фото и полный operational flow не подтверждены live | Изолированные synthetic browser flows + dedicated nonpublic live draft для actual Blob; production read-only для существующих деловых записей | Upload≤8MiB/MIME/retry/foreign identity; booking/payment/PMS/owner flow evidence | Запланировано |
| R13 | Неподключённые внешние провайдеры | Проверить имеющиеся env/config по presence без секретов; работающие каналы показывать честно; adapters только с реальным contract/config | Никакой фиктивной delivery/charge. Outbound smoke — только synthetic recipient или отдельное разрешение | По фактической конфигурации |
| R14 | Часть public content needs_review | Разделить техническую проверку и founder/legal approval; review реального опубликованного контента | Без вымышленных лицензий, ownership, rates, SLA и blanket status changes | По реальному реестру; отсутствие approval остаётся blocker |
| R15 | Финальная оценка может стать произвольной | Обновить evidence по каждой строке веса, blockers и exact SHA; сохранить актуальные docs/reference | Нельзя заявить 9/10 при missing critical evidence; явно назвать достигнутый результат | После приёмки |

## Контуры проверки

1. Unit/component/policy — локально с synthetic values, без production credentials.
2. DB/concurrency/migration replay — отдельная disposable PostgreSQL через CI; test reset никогда не на production.
3. Chromium — production build + synthetic isolated DB/egress guard; mobile/desktop и разные роли.
4. Production existing data — read-only reconciliation и health. Не создавать фиктивные bookings/payments/owners и не менять статус/authority ради теста.
5. Реальные внешние операции — только поддержанным scoped действием, dedicated draft/test object и настроенным provider; факт исполнения фиксируется отдельно от кода.

## Известные зависимости и запрет ложного завершения

- Protected migration требует successful push CI exact main; running workflow не дублировать.
- Vercel team/project берутся из verified project ID, не из предположения по slug.
- Live photo acceptance требует действующей scoped application session и Blob; auth не подделывать, founder passwords не менять для теста.
- Merchant/card/messenger provider должен быть действительно подключён; отсутствующие credentials нельзя заменить mock в production.
- Правила, сроки и разрешённое использование недвижимости не выдумываются из пустого поля.
- Backup не заменяет migration parity, code deployment, external money reconciliation или live process acceptance.

[Система](SYSTEM.md) · [Матрица](IMPLEMENTATION_STATUS.md) · [CO01–CO30](PROCESS_COVERAGE.md) · [Эксплуатация](OPERATIONS.md).

## Evidence пакета исправлений

- Production read-only: translation needs_review=4213, ok=8716. Проверка review не обходится; статусы автоматически не менялись.
- Main CI run38897708543 успешен. Production migration run38899390156: backup/restore успешны, migrate завершился ошибкой до вывода списка pending. Read-only ledger подтверждает две ожидаемые pending и только известное comment-only отличие; причина ошибки connection/config без безопасного stage/code не установлена. В script добавлены stage/code diagnostics без driver message/credentials. Повторный запуск не создан.
- Локально: целевые readiness/storage/statement/component/policy tests; production TypeScript проверяется после Prisma generate. DB race и route authorization tests добавлены для disposable CI PostgreSQL; до успешного CI они не отмечаются пройденными.
- Config key `service.fulfilment_confirm_window_hours` добавлен в seed registry, default48h. Для существующей БД без seeded key применяется тот же48h default; schema migration не требуется. Правки override проходят positive whole-hour validation.
- Закрытие не меняет fulfilled_at, recognized commission, payments и payouts. Legacy fulfilled без fulfilled_at остаётся для operator review, время не восстанавливается из updated_at.
- Production9/10 пока **не подтверждено**: текущий PR ещё не live; R09/R10 и runtime acceptance остаются открытыми, контент требует review.

### Production automation и content, read-only 2026-10-16

- Последние booking_lifecycle/tm30_escalations/ical_sync: 10:50:41–10:50:43 UTC. На момент проверки это больше часа назад. Успешный Scheduler38889878798 был workflow_dispatch; фактическая регулярность external cadence не подтверждена. Default branch main; причина отсутствия новых schedule runs не установлена. Нужна проверка enabled-state workflow и успешной серии scheduled ticks, один ручной запуск не закрывает acceptance.
- Needs_review по основным namespaces: landing829, admin741, staff603, homes230, ops225, home138, nav132, mc131, help126, passport105. Это приоритетный реестр review, а не основание массово ставить ok.
- Новый isolated Chromium runner проверяет реальный cash→accept→fulfil→customer confirm, повтор подтверждения без нового commission/payment, и dispute→confirmation denied. Browser workflow сохраняет service-fulfilment-result.json; до успешного run это authored coverage.

### R16 — подтверждённый transaction/email defect

В полном CI run38900018681 обнаружены исходные ошибки Transaction already closed в fire-and-forget email после accept/fulfil. Добавлена durable post-commit queue на существующем NotificationDelivery: TransactionClient только сохраняет pending; frequent sweep обрабатывает после commit; advisory lock, provider Idempotency-Key, bounded network timeout и retry window, no legacy replay. Unit/DB tests покрывают rollback/no-send, competing workers, transient retry, mute и expiry. Scope не включает реализацию WhatsApp/Telegram adapters; они продолжают честно fail-closed. [Контракт Resend](https://resend.com/docs/dashboard/emails/idempotency-keys).

Первый полный CI:5975 passed/2 failed, оба сбоя — static seeded key discovery (двойные кавычки в новых entries); формат исправлен, локальные coverage tests проходят. PostgreSQL confirm/dispute/close7/7 и route authorization в этом run прошли. Первый isolated browser run38900018460 успешен; новый service-fulfilment runner требует отдельного execution evidence.
