# Сверка документации — 2026-10-16

## Объект и границы

Repository pavel949/myUNO-final, main 436dd93567e4647e15c04fdafea850e0e103bf3a. Проверены inventory App Router, все каталоги modules, schema/migrations, service exports и ключевые workflows/guards/adapters/jobs/config. Открытые PR #274/#275/#277/#279/#283 учтены отдельно от main.

Это статическая сверка и обновление документации. Production migration history/config/data, deployment SHA, реальные платежи/письма/загрузка media, browser-прохождение всех процессов, latency и restore в этой задаче не проверялись. Код не выдаётся за production acceptance.

## Изменения

- Новый README и current guides: SYSTEM, IMPLEMENTATION_STATUS, OPERATIONS, REFERENCE/inventory, DOCS_POLICY.
- Полная замена старого active numbered suite, deployment/database entry points, CONTRIBUTING, Security и SOP; module READMEs для всех 21 каталогов.
- Остальные документы получили явный тип/reference или historical notice; target architecture сохранена как требования. Прежние версии доступны в Git history.
- Удалены упоминания прежнего deployment provider из Markdown; Vercel-only guidance согласовано с deploymentEnabled=false.
- Исправлены описания Next/MapLibre/custom auth/Blob/Opn/locales и опасные прежние рекомендации о production secrets/automatic migration repair.
- Зафиксированы 15 confirmed gaps / verification tasks D01–D15. Незавершённые quotes/reschedule/messenger/ARI не считаются completed из-за schema или старого отчёта.
- Исправлен статический inventory counter: shared global-desks.ts больше не считается отдельным module directory; regression fixture содержит такой файл.
- Добавлены генератор reference, read-only checker и CI check для freshness/links. Runtime бизнес-логика и schema не менялись.

## Фактически выполненные проверки

| Проверка | Результат |
|---|---|
| node --test scripts/audit-platform-inventory.test.mjs | 4/4 passed |
| Генерация reference и повторный --check | passed; детерминированное соответствие checkout |
| node scripts/check-repository-docs.mjs | passed: local link targets, current anchors, inventory freshness, module READMEs, retired provider scan |
| Negative stale-reference check | Подмена REFERENCE обнаружена, --check отклонил; файл восстановлен |
| Negative broken-link check | Несуществующая local ссылка отклонена; файл восстановлен |
| ESLint 4 изменённых/новых mjs scripts, max-warnings=0 | passed |
| git diff --check | passed |
| Full app tests/build/DB/browser acceptance | Локально не запускались для documentation/tooling change; CI результат фиксируется отдельно |

Статический результат: 174 pages, 247 handlers (244 API), 21 module directories (20 runtime + workflows tests), 118 Prisma models, 94 migrations, 547 test files, 0 normalized route collisions. Это количество файлов/определений, не успешных runtime checks.
