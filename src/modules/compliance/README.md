# compliance — Разрешённые коммерческие действия

Сверено по main 2026-10-16. **Статус: код присутствует; production-проверка отдельно.**

RegulatoryCredential и commercial eligibility для short-term, long-term и sale.

## Пользовательские поверхности

/app/admin/compliance · /app/admin/compliance-checklists.

## Что остаётся

Подтвердить документы, сроки и допустимость использования по каждому объекту; код не удостоверяет юридические факты.

## Источники и сопровождение

[Полный состав файлов, exports и тестов](../../../docs/current/REFERENCE.md#module-compliance) · [система](../../../docs/current/SYSTEM.md) · [матрица реализации](../../../docs/current/IMPLEMENTATION_STATUS.md).

Контракты API задаются route handlers и вызываемыми domain services; права проверяются server-side. Наличие тестового файла не означает прохождение теста.
