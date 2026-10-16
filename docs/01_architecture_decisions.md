# Архитектура

Актуализировано по main 2026-10-16. Next.js modular monolith, PostgreSQL/Prisma, собственная auth/session, Vercel/Blob. UI, route guards и domain services составляют один app. Target federation отделена от текущей configured authority.

## Проверяемый источник

[Код](../src/app) · [Полное описание системы](current/SYSTEM.md) · [Реализация и остаток](current/IMPLEMENTATION_STATUS.md) · [Полный справочник](current/REFERENCE.md).

Текущие исходники определяют фактическое поведение. [PROJECT](../PROJECT.md) и [canonical](canonical/README.md) задают продуктовую цель, которую нельзя автоматически считать реализованной. Production version/schema/data/runtime в этой сверке не проверялись.
