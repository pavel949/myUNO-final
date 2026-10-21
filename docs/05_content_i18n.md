# Контент и переводы

Актуализировано по main 2026-10-16. ContentKey/Translation, namespaces, CMS/CSV, review status и fallback. LOCALES=ru/en/th/zh, default ru. ZH completeness не подтверждена. Не считать английский fallback доказательством отключённой БД.

## Проверяемый источник

[Код](../src/modules/content/types.ts) · [Полное описание системы](current/SYSTEM.md) · [Реализация и остаток](current/IMPLEMENTATION_STATUS.md) · [Полный справочник](current/REFERENCE.md).

Текущие исходники определяют фактическое поведение. [PROJECT](../PROJECT.md) и [canonical](canonical/README.md) задают продуктовую цель, которую нельзя автоматически считать реализованной. Production version/schema/data/runtime в этой сверке не проверялись.

## Sales offer drafts (2026-10-21, implementation branch)

The `sales.*` namespace is registered by `src/modules/content/sales-offer.seed.ts` as needs-review EN/RU/TH drafts. It supplies the authenticated sales desk and guest-safe offer presentation. Locale drafts do not establish commercial approval; production language review remains required.
