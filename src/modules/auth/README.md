# auth — Авторизация

Сверено по main 2026-10-16. **Статус: код присутствует; production-проверка отдельно.**

Регистрация, пароль, email verification/reset, claim приглашения; подписанные cookie; Google OAuth через маршруты auth.

## Пользовательские поверхности

/login · /register · /auth/claim · /account.

## Что остаётся

Проверить доставку писем, настройки Google и отзыв сессий в развёрнутом окружении.

## Источники и сопровождение

[Полный состав файлов, exports и тестов](../../../docs/current/REFERENCE.md#module-auth) · [система](../../../docs/current/SYSTEM.md) · [матрица реализации](../../../docs/current/IMPLEMENTATION_STATUS.md).

Контракты API задаются route handlers и вызываемыми domain services; права проверяются server-side. Наличие тестового файла не означает прохождение теста.
