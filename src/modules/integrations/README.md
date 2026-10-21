# integrations — Интеграции и Layantara

Сверено по main 2026-10-16. **Статус: код присутствует; production-проверка отдельно.**

IntegrationAccount, encrypted config, iCal import/export/signing/conflicts; Layantara mappings, versioned inbox/checkpoint, signed channel intake, protection, workbook dry-run/import.

## Пользовательские поверхности

/app/admin/integrations · /app/admin/layantara.

## Что остаётся

Полный OTA ARI/channel manager отсутствует. WhatsApp/Telegram registration/webhook seams есть, отправка явно возвращает MESSENGER_ADAPTER_UNAVAILABLE. Проверить cutover/config/лаг в production.

## Источники и сопровождение

[Полный состав файлов, exports и тестов](../../../docs/current/REFERENCE.md#module-integrations) · [система](../../../docs/current/SYSTEM.md) · [матрица реализации](../../../docs/current/IMPLEMENTATION_STATUS.md).

Контракты API задаются route handlers и вызываемыми domain services; права проверяются server-side. Наличие тестового файла не означает прохождение теста.
