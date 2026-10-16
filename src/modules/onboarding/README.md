# onboarding — Добавление объектов и контент сотрудников

Сверено по main 2026-10-16. **Статус: код присутствует; production-проверка отдельно.**

Canonical unit resolution, offerings, submission/description, employee draft/review/convert, scoped content proposals с атомарным approval, autosave/template models.

## Пользовательские поверхности

/property/onboard · /property/create · /property/content · /app/admin/property-submissions · /app/admin/property-content-proposals.

## Что остаётся

Проверить полный путь нового объекта до публикации, scope/revoke, импорт и восстановление draft. Не приравнивать submit к go-live.

## Источники и сопровождение

[Полный состав файлов, exports и тестов](../../../docs/current/REFERENCE.md#module-onboarding) · [система](../../../docs/current/SYSTEM.md) · [матрица реализации](../../../docs/current/IMPLEMENTATION_STATUS.md).

Контракты API задаются route handlers и вызываемыми domain services; права проверяются server-side. Наличие тестового файла не означает прохождение теста.
