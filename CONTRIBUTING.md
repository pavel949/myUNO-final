# Разработка myUNO

Начать с [README](README.md), [текущей системы](docs/current/SYSTEM.md), [PROJECT](PROJECT.md) и [canonical rules](docs/canonical/AI_AGENT_RULES.md). Целевые требования не подменяют фактическое состояние main.

## Среда

Node 20, npm lockfile, PostgreSQL. Отдельная dev DB и отдельная test DB; production credentials не копировать.

```bash
npm ci
cp .env.example .env
# Заполнить локальные DATABASE_URL, DATABASE_URL_TEST и dev secrets.
# Обычный PostgreSQL нуждается в ролях, ожидаемых migration chain:
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/sql/supabase-compat-roles.sql
node scripts/provision-database.mjs
npm run dev
```

Команды psql/node читают переменные процесса: одна запись в .env не экспортирует их в shell автоматически. Перед запуском использовать безопасный механизм загрузки окружения, проверить host/database. Никаких паролей в Git или command logs.

| Команда | Действие |
|---|---|
| npm ci | Установка lockfile + Prisma generate |
| npm run dev / build / start | Next development / production compile / production server |
| npm run db:seed:registries | Config/content seed без inventory; review изменений нужен |
| npm run db:seed | Demo seed; только disposable/local |
| npm run db:verify | Проверка воспроизводимости schema/drift/grants; только отдельная тестовая БД |
| npm run audit:inventory | Статическая карта текущего checkout |
| node scripts/generate-repository-reference.mjs | Обновление полного справочника |
| node scripts/check-repository-docs.mjs | Проверка текущих doc links/инвентаря/устаревших deployment mentions |

## Проверки

```bash
npm run audit:inventory:test
node scripts/generate-repository-reference.mjs
node scripts/check-repository-docs.mjs
npm run lint
npx tsc --noEmit --project tsconfig.production.json
npm test
npm run build
```

Integration tests очищают таблицы. Нужен DATABASE_URL_TEST на отдельной disposable БД; не запускать параллельные suite на одной БД. CI содержит точные env и миграционные подготовительные шаги. CONTENT_REVIEW_GATE_ENABLED=false допустим для изолированных synthetic tests, а не обхода production review. Не фиксировать NODE_ENV вручную.

## Правила изменения

Работать в ветке; изучить main/open PRs; минимальный diff; scope/auth/data/money evidence; проверять затронутые сценарии. Сервер считает цену, money — satang integers; ledger corrections append-only. Никаких вымышленных owner/authority/rates/legal approvals. Права проверять в server guards/services/queries. Public marketing media отделять от private evidence.

Schema: reviewed forward migrations, никакого production db push или automatic migration repair. UI: локализация, существующие tokens/components, loading/empty/error/forbidden states. Добавление feature обновляет SYSTEM/IMPLEMENTATION_STATUS и генерируемый REFERENCE; docs checker должен проходить.

PR описывает конкретный результат, tests, migration/deploy impact и ограничения. Runtime readiness требует реального доказательства; green build или модель в schema недостаточны. Вопросы коммерческих условий фиксировать как unknown/blocker; обычные технические решения выполнять самостоятельно в рамках задачи.

[Vercel и эксплуатация](docs/current/OPERATIONS.md) · [Security](SECURITY.md).
