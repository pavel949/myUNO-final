# comms — Общение и поддержка

Сверено по main 2026-10-16. **Статус: код присутствует; production-проверка отдельно.**

Threads/messages, in-app notifications, email delivery records, объявления, лиды, tickets/SLA, disputes и контроль аудитории. SSE buses находятся в памяти процесса.

## Пользовательские поверхности

/messages · /tickets · /announcements · /app/admin/tickets.

## Что остаётся

Клиенты уже читают durable messages/notifications polling через БД (15/30 секунд); добавлены refresh на focus/visibility и защита от stale responses/revoked access. In-memory SSE не является межсерверным транспортом. Внешние messenger adapters отсутствуют; фактическая доставка проверяется отдельно.

## Источники и сопровождение

[Полный состав файлов, exports и тестов](../../../docs/current/REFERENCE.md#module-comms) · [система](../../../docs/current/SYSTEM.md) · [матрица реализации](../../../docs/current/IMPLEMENTATION_STATUS.md).

Контракты API задаются route handlers и вызываемыми domain services; права проверяются server-side. Наличие тестового файла не означает прохождение теста.
