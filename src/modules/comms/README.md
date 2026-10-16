# comms — Общение и поддержка

Сверено по main 2026-10-16. **Статус: код присутствует; production-проверка отдельно.**

Threads/messages, in-app notifications, email delivery records, объявления, лиды, tickets/SLA, disputes и контроль аудитории. SSE buses находятся в памяти процесса.

## Пользовательские поверхности

/messages · /tickets · /announcements · /app/admin/tickets.

## Что остаётся

Для нескольких экземпляров требуется общий транспорт событий; внешние messenger adapters отсутствуют. Проверить фактическую доставку и повторы.

## Источники и сопровождение

[Полный состав файлов, exports и тестов](../../../docs/current/REFERENCE.md#module-comms) · [система](../../../docs/current/SYSTEM.md) · [матрица реализации](../../../docs/current/IMPLEMENTATION_STATUS.md).

Контракты API задаются route handlers и вызываемыми domain services; права проверяются server-side. Наличие тестового файла не означает прохождение теста.
