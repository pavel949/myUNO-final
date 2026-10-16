# workflows — Сквозные регрессионные сценарии

Сверено по main 2026-10-16. **Статус: код присутствует; production-проверка отдельно.**

Integration tests expense→owner report, property→financial close и cancelled booking statements. Это тестовый пакет, не runtime workflow engine.

## Пользовательские поверхности

Тесты; отдельного пользовательского маршрута нет.

## Что остаётся

Выполнять на изолированной БД; наличие файлов не означает прохождение на текущем commit.

## Источники и сопровождение

[Полный состав файлов, exports и тестов](../../../docs/current/REFERENCE.md#module-workflows) · [система](../../../docs/current/SYSTEM.md) · [матрица реализации](../../../docs/current/IMPLEMENTATION_STATUS.md).

Контракты API задаются route handlers и вызываемыми domain services; права проверяются server-side. Наличие тестового файла не означает прохождение теста.
