# Техническое описание

Актуализировано по main 2026-10-16. 21 каталог модулей: 20 runtime + workflows tests. src/app содержит маршруты и часть orchestration, src/lib — инфраструктурные helpers; не всё сосредоточено в modules. Полный перечень services/exports/tests в REFERENCE.

## Проверяемый источник

[Код](../package.json) · [Полное описание системы](current/SYSTEM.md) · [Реализация и остаток](current/IMPLEMENTATION_STATUS.md) · [Полный справочник](current/REFERENCE.md).

Текущие исходники определяют фактическое поведение. [PROJECT](../PROJECT.md) и [canonical](canonical/README.md) задают продуктовую цель, которую нельзя автоматически считать реализованной. Production version/schema/data/runtime в этой сверке не проверялись.
