# analytics — Аналитика и коммерческие сигналы

Сверено по main 2026-10-16. **Статус: код присутствует; production-проверка отдельно.**

События, дневные агрегаты, KPI, occupancy/revenue/channel reports, buyer signals, purchase interest.

## Пользовательские поверхности

/app/admin/operational-kpis · /app/admin/reports/attribution · /app/admin/signals.

## Что остаётся

Подтвердить формулы на реальных данных, полноту событий воронки и доступ к отчётам.

## Источники и сопровождение

[Полный состав файлов, exports и тестов](../../../docs/current/REFERENCE.md#module-analytics) · [система](../../../docs/current/SYSTEM.md) · [матрица реализации](../../../docs/current/IMPLEMENTATION_STATUS.md).

Контракты API задаются route handlers и вызываемыми domain services; права проверяются server-side. Наличие тестового файла не означает прохождение теста.
