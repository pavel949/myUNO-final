# config — Конфигурация и секреты

Сверено по main 2026-10-16. **Статус: код присутствует; production-проверка отдельно.**

Реестр параметров, override по scope, журнал изменений, booking windows, encrypted secret vault.

## Пользовательские поверхности

/app/admin/config · /app/admin/access.

## Что остаётся

Проверить действующие значения и права раскрытия секретов; наличие vault entry не доказывает подключение сервиса.

## Источники и сопровождение

[Полный состав файлов, exports и тестов](../../../docs/current/REFERENCE.md#module-config) · [система](../../../docs/current/SYSTEM.md) · [матрица реализации](../../../docs/current/IMPLEMENTATION_STATUS.md).

Контракты API задаются route handlers и вызываемыми domain services; права проверяются server-side. Наличие тестового файла не означает прохождение теста.
