# ops — PMS и операционные пространства

Сверено по main 2026-10-16. **Статус: код присутствует; production-проверка отдельно.**

Today/board/calendar projections, operating spaces/teams/capabilities, reservations/guest registry, turnover tasks, check-in readiness, housekeeping, maintenance/preventive plans, TM30/passport/condition reports.

## Пользовательские поверхности

/ops · /ops/calendar · /ops/spaces · /ops/housekeeping · /ops/maintenance · /ops/tm30.

## Что остаётся

Проверить рабочие смены, командные границы, блокировки готовности, preventive cron, check-out→clean→inspection. TM30 здесь учёт/доказательство подачи, автоматическая отправка государству не установлена.

## Источники и сопровождение

[Полный состав файлов, exports и тестов](../../../docs/current/REFERENCE.md#module-ops) · [система](../../../docs/current/SYSTEM.md) · [матрица реализации](../../../docs/current/IMPLEMENTATION_STATUS.md).

Контракты API задаются route handlers и вызываемыми domain services; права проверяются server-side. Наличие тестового файла не означает прохождение теста.
