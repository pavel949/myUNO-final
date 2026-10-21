# Роли и права

Актуализировано по main 2026-10-16. RoleType: owner, guest, resident, buyer, provider_member, mc_member, juristic_member, staff_ops, onsite_host, content_contributor, pricing_editor, booking_mode_editor. Admin — Identity.isAdmin. Scope и operating capabilities проверять по server guards; имя рабочего места не равно отдельной роли enum.

## Проверяемый источник

[Код](../src/modules/core/permissions.ts) · [Полное описание системы](current/SYSTEM.md) · [Реализация и остаток](current/IMPLEMENTATION_STATUS.md) · [Полный справочник](current/REFERENCE.md).

Текущие исходники определяют фактическое поведение. [PROJECT](../PROJECT.md) и [canonical](canonical/README.md) задают продуктовую цель, которую нельзя автоматически считать реализованной. Production version/schema/data/runtime в этой сверке не проверялись.
