# services — Маркетплейс услуг

Сверено по main 2026-10-16. **Статус: код присутствует; production-проверка отдельно.**

Provider applications/approval, service catalogue/localized copy, project offers, standalone address/area ordering, payment→accept→fulfill, cancel/decline/no-show/refunds, reviews/reminders.

## Пользовательские поверхности

/services · /services/orders · /provider · /app/admin/service-orders.

## Что остаётся

ServiceQuoteRequest/Version есть в схеме, но рабочих writers/API не найдено. Customer confirm/dispute/auto-close после fulfillment не найден как законченный lifecycle. SKU/stock/delivery/recurring не реализованы как отдельная торговая система.

## Источники и сопровождение

[Полный состав файлов, exports и тестов](../../../docs/current/REFERENCE.md#module-services) · [система](../../../docs/current/SYSTEM.md) · [матрица реализации](../../../docs/current/IMPLEMENTATION_STATUS.md).

Контракты API задаются route handlers и вызываемыми domain services; права проверяются server-side. Наличие тестового файла не означает прохождение теста.
