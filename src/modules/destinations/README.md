# destinations — Направления

Сверено по main 2026-10-16. **Статус: код присутствует; production-проверка отдельно.**

Реестр направлений и построение ссылок destinationPath. Данные районов обслуживаются projects/area.service.ts.

## Пользовательские поверхности

/areas · /areas/[slug].

## Что остаётся

Проверить фактическое покрытие направлений; расширение географии требует контента и supply.

## Источники и сопровождение

[Полный состав файлов, exports и тестов](../../../docs/current/REFERENCE.md#module-destinations) · [система](../../../docs/current/SYSTEM.md) · [матрица реализации](../../../docs/current/IMPLEMENTATION_STATUS.md).

Контракты API задаются route handlers и вызываемыми domain services; права проверяются server-side. Наличие тестового файла не означает прохождение теста.
