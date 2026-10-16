# Уведомления и jobs

Актуализировано по main 2026-10-16. Notification/Delivery/Preference, notification/thread buses, email Resend, guest/order reminders и 10 registry jobs. Внешняя delivery требует provider evidence, realtime buses сейчас process-local. Полный список cron и cadence в OPERATIONS.

## Проверяемый источник

[Код](../src/jobs/registry.ts) · [Полное описание системы](current/SYSTEM.md) · [Реализация и остаток](current/IMPLEMENTATION_STATUS.md) · [Полный справочник](current/REFERENCE.md).

Текущие исходники определяют фактическое поведение. [PROJECT](../PROJECT.md) и [canonical](canonical/README.md) задают продуктовую цель, которую нельзя автоматически считать реализованной. Production version/schema/data/runtime в этой сверке не проверялись.
