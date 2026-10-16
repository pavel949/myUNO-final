# Конфигурация

Актуализировано по main 2026-10-16. ConfigParameter/ConfigOverride/ConfigChange, scope overrides, catalog keys, booking windows и secret vault. Цены/fee/policy не копировать из старых документов как production значения. Полный env registry извлекается из consumer files.

## Проверяемый источник

[Код](../src/modules/config/config.service.ts) · [Полное описание системы](current/SYSTEM.md) · [Реализация и остаток](current/IMPLEMENTATION_STATUS.md) · [Полный справочник](current/REFERENCE.md).

Текущие исходники определяют фактическое поведение. [PROJECT](../PROJECT.md) и [canonical](canonical/README.md) задают продуктовую цель, которую нельзя автоматически считать реализованной. Production version/schema/data/runtime в этой сверке не проверялись.
