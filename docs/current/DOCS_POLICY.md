# Политика актуальности документации

Обновлено 2026-10-16.

## Приоритет фактов

1. Для реализованного поведения: текущий код/main, schema, services, handlers, guards, config и результаты проверок на точном SHA.
2. README + docs/current: единый текущий гид; SYSTEM объясняет реализацию, IMPLEMENTATION_STATUS содержит остаток и неизвестные, REFERENCE/inventory.json перечисляют код.
3. PROJECT + canonical: обязательные продуктовые требования и ограничения. Это target, а не подтверждение реализации.
4. Дополнительные specs/design/runbooks: справочные детали, актуальность сверять с текущим гидом и кодом.
5. Dated audits/delivery/release reports: историческое evidence только для их commit/environment/date. Не текущий статус main/production.

История изменений остаётся в Git. Стабильные старые пути 00–18, DATABASE_SETUP, VERCEL-SETUP и deployment entry points перенаправлены на текущие источники; недействующие команды/статистика удалены из активного набора.

## Что обновлять в одном PR с feature

- SYSTEM: purpose, actor, screens, writer, scope, money/notifications/failures.
- IMPLEMENTATION_STATUS: уже реализованное, реальный остаток и runtime evidence; не переносить target в completed по модели/странице.
- REFERENCE + inventory.json: `node scripts/generate-repository-reference.mjs`.
- Соответствующий module README/SOP, configuration и release/runbook при изменениях процесса.
- Docs index: новый документ должен иметь тип (current / target / reference / historical) и ссылку.
- Проверка: `node scripts/check-repository-docs.mjs`, meaningful tests затронутого инструмента/функции.

Срез ревизии исполняемого кода в REFERENCE генерируется через git log по runtime/schema/config paths. Documentation-only commit не выдаётся за новую production version. Изменения дат, статусов и providers должны подтверждаться source/evidence, а не старым отчётом.

## Запрещённые утверждения без evidence

«Полностью готово», «все тесты прошли», «production migrated», «автоматически deployed», «деньги получены/возвращены», «сообщение доставлено», «владелец/лицензия verified». Наличие файла, env key, модели, mock или зелёной сборки не подтверждает эти факты.

## Минимум release evidence

Commit, environment, deployment SHA/alias, migration state, data/config, scope checks, test result, проверенный пользовательский процесс, blockers и next action. Секреты/PII в evidence запрещены. Если проверки не выполнялись, писать «не проверено».
