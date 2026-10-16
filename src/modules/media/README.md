# media — Фотографии и файлы

Сверено по main 2026-10-16. **Статус: код присутствует; production-проверка отдельно.**

Vercel Blob upload, signed direct upload/finalization, MIME/size/signature checks, cover/order/gallery readiness, video policy, managed Yandex import.

## Пользовательские поверхности

/app/admin/projects/[id]/media · /property/content.

## Что остаётся

Проверить реальную загрузку и повтор finalize в окружении с Blob. Readiness и upload используют общий parser token либо OIDC+store; наличие config не заменяет actual upload/finalize acceptance.

## Источники и сопровождение

[Полный состав файлов, exports и тестов](../../../docs/current/REFERENCE.md#module-media) · [система](../../../docs/current/SYSTEM.md) · [матрица реализации](../../../docs/current/IMPLEMENTATION_STATUS.md).

Контракты API задаются route handlers и вызываемыми domain services; права проверяются server-side. Наличие тестового файла не означает прохождение теста.
