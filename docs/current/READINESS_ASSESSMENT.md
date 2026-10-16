# Оценка production readiness после пакета исправлений

Дата: 16 октября 2026, Asia/Bangkok. Основа: [PR294](https://github.com/pavel949/myUNO-final/pull/294), exact codeRevision в [REFERENCE](REFERENCE.md), read-only production SQL, Vercel deployment/alias metadata, CI и изолированный Chromium. Для каждого утверждения о тестах указан проверенный code SHA; актуальный exact-head result доступен в PR294 Checks.

## Та же шкала 1–10

| Контур | Предыдущая оценка | Новая оценка после проверенного пакета | Почему |
|---|---:|---:|---|
| Техническая готовность кода | 7/10 | 8/10 после успешной полной приёмки code SHA | Закрыты конкретные дефекты launch gates, unsigned statements, service closure, stale private reads и transaction/email delivery |
| Реальная готовность production | 5/10 | 5/10 | Alias пока обслуживает старый SHA; текущие исправления не применены/не приняты на live. Нового основания повысить runtime score нет |

Это экспертная инженерная оценка по прежней шкале, а не процент реализованных функций, тестового покрытия или вероятность отсутствия инцидента. Уровень 9/10 остаётся отдельным release acceptance: >=90 подтверждённых weighted points по [плану](PRODUCTION_READINESS_PLAN.md) и ни одного критического провала денег, приватности, инвентаря, восстановления или обязательного рабочего процесса. Наличие кода и synthetic green не равны live acceptance.

## Что повышает оценку кода

1. **Launch readiness соответствует runtime.** Opn provider key/public+secret configuration, Blob token/OIDC+store и freshness каждого frequent job проверяются согласованно; env presence не объявляется provider health.
2. **Content review fail-closed.** Отсутствующая/недоступная production БД, pending review и запрещённый production bypass не дают успешный gate. Исключение — explicit isolated loopback CI с совпадающей test/app DB.
3. **Owner statement freshness.** Start/end calendar dates входят в source fingerprint. Same-total перенос дат должен инвалидировать unsigned statement; issued/signed история проверяется на integrity и не переписывается.
4. **Услуги имеют полный путь закрытия текущего заказа.** Customer confirm, положительный whole-hour window (default 48h), UI deadline, dispute и auto-close сериализуются по одной order row. Undecided dispute блокирует closure. Closure не признаёт commission и не создаёт payment/payout повторно; closed order остаётся доступным для оценки.
5. **Приватные данные не возвращаются запоздалым ответом.** Durable polling сохраняется, focus/visibility инициируют refresh; поздний успешный response не восстанавливает thread/notifications после актуального отказа доступа.
6. **Notification email отделён от незавершённой бизнес-транзакции.** Durable post-commit queue, конкурирующие workers, provider idempotency и bounded retries заменяют fire-and-forget через закрытый TransactionClient. Rollback не отправляет письмо; legacy ambiguous pending не replay-ятся автоматически.
7. **Релиз диагностируется безопаснее.** Ошибка migration содержит stage/allowlisted code, без driver message, connection string или provider body; автоматический history repair не добавлен.

## Что продолжает снижать production score

| Приоритет | Подтверждённый факт / отсутствие доказательства | Что закрывает риск |
|---|---|---|
| P1: релиз | Vercel READY deployment dpl_4hoKajzkxCMc1nRrp5LKzoBmSW7v с alias my-uno-final.vercel.app указывает на 408ad99abfae9e7e67b6f518a736b751d72a7283 | Exact-main CI → protected backup/migration → staged deployment → authenticated runtime acceptance → promotion и повторная сверка alias SHA |
| P1: миграция | Run38899390156: backup/restore passed, migrate failed до применения SQL/вывода pending. Read-only ledger: две ожидаемые pending, только известное comment-only checksum отличие, незавершённых migrations нет | Установить причину connection/config по безопасным diagnostics; повторный protected workflow с exact-main backup и financial parity. Не переписывать history |
| P1: автоматизация | Последние frequent JobRun10:50 UTC; проверка спустя >час. Успешный Scheduler38889878798 был manual dispatch | Подтверждённая серия именно scheduled ticks, current JobRun для каждого frequent job, правильный scheduler mode и рабочие alerts |
| P1: контент | В production4213 needs_review и 8716 ok translations | Содержательное review, локали и required keys; founder/legal facts отдельно. Никакого blanket approval ради прохождения build |
| P1: внешние последствия | Live Opn charge/refund, actual Blob upload/finalize и email provider ack этим пакетом не доказаны. В production нет canonical bookings/payments/service orders/notification deliveries | Dedicated разрешённые test/draft fixtures с реальным provider, безопасной auth session и сверкой результата; synthetic данные не создавать в canonical production бизнес-учёте |
| P1: полнота текущих протоколов | BookingReschedule replacement hold/funding/commit и ServiceQuoteVersion acceptance в runtime остаются открытыми | Отдельные законченные vertical slices с race/expiry/late-payment/revision/UI acceptance. Текущий manual quote fallback сохраняется честным |
| P1: эксплуатационная приёмка | Полная live цепочка PMS→расход/receipt→owner statement→sign-off/payout и cross-scope/revoke/private-media не подтверждена этим пакетом | Доказательства на deployed SHA с реальными полномочиями, без вымышленных оплат/документов |

Backup перестал быть неподтверждённой декларацией: consistent snapshot и actual restore parity всех 120 application tables проверены run 38896564642 и повторно backup stage38899390156. Но backup не заменяет migration, release, keys/recovery и сверку внешних платежей после точки восстановления.

## Результаты проверок

Проверенный Node20 code head e54c5497a719161b854605ce143ebeb34da29fa0: [CI38901926718](https://github.com/pavel949/myUNO-final/actions/runs/38901926718) — **5990/5990 tests,553 files, lint, production TypeScript и build passed**. [Chromium38901927006](https://github.com/pavel949/myUNO-final/actions/runs/38901927006) — passed, включая actual cash→accept→fulfil→customer confirm и dispute→confirmation denied.

Node24 code head b1ca19b10b17e777cd7c5c76ae2c967c4933aac7 (codeRevision a24327623137b4f60e9afbd6e590a7f600b49e1a): [CI38903204352](https://github.com/pavel949/myUNO-final/actions/runs/38903204352), [Chromium38903204454](https://github.com/pavel949/myUNO-final/actions/runs/38903204454). **Эти и последующие exact-head checks должны иметь success для окончательного технического8/10.** Их актуальное состояние берётся из linked runs/PR Checks, не из наличия тестового файла. Следующие commits документации не меняют codeRevision.

Локально пройдены103 targeted tests,24 policy/isolation checks, production TypeScript, repository lint с max-warnings0 и docs/reference consistency. Первый полный CI:5975 passed/2 static seeded-key formatting failures; формат исправлен, обе coverage suites и последующий полный CI green. Семь PostgreSQL closure/concurrency tests,14 statement snapshot tests и6 post-commit delivery tests прошли в полном Node20 run. Node24 добавляет ещё один regression на redaction произвольного provider error.

Главное условие повышения production с5 к9: изменения действительно развёрнуты, обязательные gates и cadence работают, а денежные/операционные пути доказаны на deployed SHA. Следующий набор исправлений должен сопровождаться новой датированной оценкой по той же шкале.
