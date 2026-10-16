# content — Контент и языки

Сверено по main 2026-10-16. **Статус: код присутствует; production-проверка отдельно.**

ContentKey/Translation, CMS CRUD/CSV, namespaces, review status, draft fallback, локали ru/en/th/zh; RU по умолчанию.

## Пользовательские поверхности

/app/admin/content · /app/admin/content/homepage.

## Что остаётся

ZH поддерживается кодом, но полнота переводов не подтверждена. Проверить review gate, реальные ключи, fallback и мобильные подписи.

## Источники и сопровождение

[Полный состав файлов, exports и тестов](../../../docs/current/REFERENCE.md#module-content) · [система](../../../docs/current/SYSTEM.md) · [матрица реализации](../../../docs/current/IMPLEMENTATION_STATUS.md).

Контракты API задаются route handlers и вызываемыми domain services; права проверяются server-side. Наличие тестового файла не означает прохождение теста.
