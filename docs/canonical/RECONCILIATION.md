# Сверка target architecture с текущим кодом

Актуализировано 2026-10-16. Старые branch-specific «already fixed» и release blockers заменены повторной сверкой main; прошлые версии доступны в Git history этого файла.

**Единая текущая матрица:** [IMPLEMENTATION_STATUS](../current/IMPLEMENTATION_STATUS.md). **Описание всех модулей:** [SYSTEM](../current/SYSTEM.md). **Маршруты/модели/тесты:** [REFERENCE](../current/REFERENCE.md).

Подтверждены расхождения: quote/reschedule models без полного runtime path, отсутствующие external messenger send и full ARI, process-local realtime buses, Opn/Blob readiness mismatch. Целевые требования к этим функциям сохраняются, статус не подменяется наличием schema.

Старые assertions о production rate plans, текущих deploy failures, migration state и cutover больше не используются без нового environment evidence. Code snapshot и production readiness рассматриваются отдельно. Для каждого следующего изменения фиксировать preserve/extend/fix/migrate/already fixed/not checked на точном SHA.
