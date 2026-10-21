# Конфигурация

Актуализировано по main 2026-10-16. ConfigParameter/ConfigOverride/ConfigChange, scope overrides, catalog keys, booking windows и secret vault. Цены/fee/policy не копировать из старых документов как production значения. Полный env registry извлекается из consumer files.

## Проверяемый источник

[Код](../src/modules/config/config.service.ts) · [Полное описание системы](current/SYSTEM.md) · [Реализация и остаток](current/IMPLEMENTATION_STATUS.md) · [Полный справочник](current/REFERENCE.md).

Текущие исходники определяют фактическое поведение. [PROJECT](../PROJECT.md) и [canonical](canonical/README.md) задают продуктовую цель, которую нельзя автоматически считать реализованной. Production version/schema/data/runtime в этой сверке не проверялись.

## Sales tariff review (2026-10-21, implementation branch)

`SalesTariffValidation` records independent review of canonical tariff fingerprints, evidence, rule version, currency, stay coverage and expiry. Calculability is not verification. No production validation rows or new tariff defaults are seeded. Only the existing canonical THB engine is supported. See `src/modules/sales-offers/README.md`; release requires separately reviewed commercial baselines.
