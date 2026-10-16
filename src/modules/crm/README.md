# crm — CRM и сделки

Сверено по main 2026-10-16. **Статус: код присутствует; production-проверка отдельно.**

CrmProfile, opportunities/stages, activity, public leads, attribution, consent; PropertyDeal с приватными доказательствами.

## Пользовательские поверхности

/app/admin/crm · /app/admin/crm/opportunities/[id]/deal.

## Что остаётся

Проверить handover из выигранной сделки, полноту ежедневных next actions и показатели pipeline. Не выдавать CRM за омниканальную доставку.

## Источники и сопровождение

[Полный состав файлов, exports и тестов](../../../docs/current/REFERENCE.md#module-crm) · [система](../../../docs/current/SYSTEM.md) · [матрица реализации](../../../docs/current/IMPLEMENTATION_STATUS.md).

Контракты API задаются route handlers и вызываемыми domain services; права проверяются server-side. Наличие тестового файла не означает прохождение теста.
