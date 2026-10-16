# projects — Недвижимость, владельцы и управляющие

Сверено по main 2026-10-16. **Статус: код присутствует; production-проверка отдельно.**

Projects/Units/areas/structure/categories/sleeping spaces, ownership periods, owner stay/dashboard, MC portfolio, factual completeness, readiness, public portals, amenities/hours/reservations, nearby/distances, commercial discovery.

## Пользовательские поверхности

/projects · /units/[id] · /homes · /owner · /mc · /property/listings.

## Что остаётся

Проверить полноту контента и полномочий. Progressive discovery не означает готовность к бронированию; не публиковать через обход activation gate.

## Источники и сопровождение

[Полный состав файлов, exports и тестов](../../../docs/current/REFERENCE.md#module-projects) · [система](../../../docs/current/SYSTEM.md) · [матрица реализации](../../../docs/current/IMPLEMENTATION_STATUS.md).

Контракты API задаются route handlers и вызываемыми domain services; права проверяются server-side. Наличие тестового файла не означает прохождение теста.
