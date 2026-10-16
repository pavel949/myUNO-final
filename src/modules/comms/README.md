# comms — Общение и поддержка

Сверено по main 2026-10-16. **Статус: код присутствует; production-проверка отдельно.**

Threads/messages, in-app notifications, durable post-commit email delivery queue, объявления, лиды, tickets/SLA, disputes и контроль аудитории. SSE buses находятся в памяти процесса.

## Пользовательские поверхности

/messages · /tickets · /announcements · /app/admin/tickets.

## Что остаётся

Клиенты уже читают durable messages/notifications polling через БД (15/30 секунд); добавлены refresh на focus/visibility и защита от stale responses/revoked access. In-memory SSE не является межсерверным транспортом. Внешние messenger adapters отсутствуют; фактическая доставка проверяется отдельно.

## Источники и сопровождение

[Полный состав файлов, exports и тестов](../../../docs/current/REFERENCE.md#module-comms) · [система](../../../docs/current/SYSTEM.md) · [матрица реализации](../../../docs/current/IMPLEMENTATION_STATUS.md).

Контракты API задаются route handlers и вызываемыми domain services; права проверяются server-side. Наличие тестового файла не означает прохождение теста.

## Доставка после commit

Внешняя notification delivery сохраняется как pending с marker queued_after_commit_v1. TransactionClient не отправляет email: частый booking_lifecycle sweep подбирает только новые marked rows после commit. Root-client writer может сразу обработать сохранённую запись. Advisory lock сериализует workers; email использует стабильный Idempotency-Key. Retryable network/429/5xx остаются pending; постоянный отказ — failed. Retry ограничен23h (provider сохраняет keys24h); просроченные и legacy unmarked pending требуют manual reconciliation. Rendered payload при повторе должен совпадать: изменение content/recipient может вызвать отказ provider, а не повторную отправку. Старые неопределённые pending не рассылаются автоматически.

[Provider idempotency contract](https://resend.com/docs/dashboard/emails/idempotency-keys). Доставкой считается provider ack; queued/in-app/console не являются подтверждением email. Никаких реальных сообщений для приёмки этого пакета не отправлялось.
