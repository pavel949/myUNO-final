# Безопасность myUNO

Сверено с исходниками 2026-10-16; это архитектура и правила, не сертификат отсутствия уязвимостей. [Границы проверки](docs/current/IMPLEMENTATION_STATUS.md).

## Контроли в коде

- Собственная Identity/auth/session модель, bcrypt password hashes, signed cookies, one-time hashed tokens, session generation/revocation и active-identity checks.
- RoleAssignment, server permission matrix, organization/project/unit/provider scopes; operating-space/team membership и делегированные capabilities. UI hiding не является контролем доступа.
- Общий PostgreSQL rate limiter в src/app/libs/rateLimit.ts; при недоступности shared counter запрос отклоняется. Это не только in-memory limiter.
- Prisma server-side; Supabase Data API grants и RLS — отдельная поверхность, проверяемая migration/DB checks. Нет Supabase browser privileged client.
- AES-256-GCM для чувствительных данных; private receipts/deal evidence имеют отдельный доступ, не публичную gallery URL.
- AuditLog, retention/anonymization, notification delivery tracking; запрет PII/credentials в логах и analytics.
- Inventory locks, idempotency, append-only money ledger, snapshot/sign-off, проверка provider facts. Эти механизмы требуют regression tests, не гарантируют абсолютную безопасность сами по себе.

## Секреты и окружения

Production secrets в защищённом окружении платформы. Не хранить в Git, публичном UI, URL, screenshot/log или NEXT_PUBLIC_ variables. NEXT_PUBLIC_ — только намеренно публичные значения. Dev/preview используют отдельную БД и synthetic data.

ENCRYPTION_KEY должен сохраняться для восстановления данных, которые им зашифрованы. Не менять ключ поверх существующего ciphertext; ротация — отдельный re-encryption проект. Не переносить production key/PII в обычную dev среду. Документация содержит имена ключей и consumer paths, не их значения.

## Что проверять перед релизом

Cross-scope read/write/export/search/aggregate/media; отзыв/истечение роли; access к passport/receipt/deal files; public DTO; secret vault reveal; webhooks/signatures/provider re-fetch; replay/concurrency; Data API grants/RLS и реальные DB role permissions; backup/restore и ключи. Наличие политики/теста не является runtime evidence.

## Сообщение о проблеме

Не публиковать exploit с credentials или PII в открытом issue. Использовать приватный канал владельца репозитория или GitHub private vulnerability reporting, если он включён. Доступность private reporting и отдельный security email этим репозиторием не подтверждены.

[Операции и recovery](docs/current/OPERATIONS.md) · [Canonical security requirements](docs/canonical/ARCHITECTURE.md).
