# Аналитика

Актуализировано по main 2026-10-16. AnalyticsEvent и MetricDaily отделены от AuditLog и финансового ledger. Dashboard/KPI/report services, attribution и buyer signals присутствуют. Счётчики/статистика требуют проверки scope/formula/completeness, не брать старые sample numbers.

## Проверяемый источник

[Код](../src/modules/analytics) · [Полное описание системы](current/SYSTEM.md) · [Реализация и остаток](current/IMPLEMENTATION_STATUS.md) · [Полный справочник](current/REFERENCE.md).

Текущие исходники определяют фактическое поведение. [PROJECT](../PROJECT.md) и [canonical](canonical/README.md) задают продуктовую цель, которую нельзя автоматически считать реализованной. Production version/schema/data/runtime в этой сверке не проверялись.
