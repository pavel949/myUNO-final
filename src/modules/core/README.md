# core — Идентичность, права, цены и доступность

Сверено по main 2026-10-16. **Статус: код присутствует; production-проверка отдельно.**

Identity/organizations/roles, invites/claim, permission matrix, scoped capabilities, engagement, canonical pricing, tariffs, blocks, retention, account/session revoke.

## Пользовательские поверхности

/app/admin/people · /property/access · /property/pricing · /property/booking-mode.

## Что остаётся

Продолжить аудит всех писателей прав и scoped read paths. Сверить тарифы и booking-policy approval по каждому scope.

## Источники и сопровождение

[Полный состав файлов, exports и тестов](../../../docs/current/REFERENCE.md#module-core) · [система](../../../docs/current/SYSTEM.md) · [матрица реализации](../../../docs/current/IMPLEMENTATION_STATUS.md).

Контракты API задаются route handlers и вызываемыми domain services; права проверяются server-side. Наличие тестового файла не означает прохождение теста.
