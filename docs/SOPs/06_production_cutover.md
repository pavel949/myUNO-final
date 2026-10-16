# Релиз и восстановление

Обновлено по текущему коду 2026-10-16. Реальные SLA, суммы, сроки и права брать из действующих настроек/terms. Production исполнение здесь не подтверждено.

1. Следовать [OPERATIONS](../current/OPERATIONS.md), проверить точный main SHA и CI.
2. Проверить migration state/backup/restore и целевую БД; выполнять schema rollout отдельно от build.
3. Настроить реальные secrets и config, проверить scheduler JobRun, mail/storage/provider по фактам.
4. Выполнить явный Vercel deployment: auto Git deployment выключен. Сверить source SHA и alias.
5. Пройти затронутый процесс на нужном окружении, записать evidence и remaining blockers. /api/health проверяет только соединение с БД.
6. Rollback приложения не откатывает schema/payment facts. Для recovery остановить writers, восстановить в новую БД и reconcile внешние системы.

[Система](../current/SYSTEM.md) · [Статус и пробелы](../current/IMPLEMENTATION_STATUS.md) · [Все маршруты](../current/REFERENCE.md).
