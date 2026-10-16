# Разработка, деплой и эксплуатация

Актуально по коду 2026-10-16. Источники: package.json, vercel.json, .env.example, next.config.js, scripts/provision-database.mjs, src/jobs и workflows. Фактические аккаунт/план/секреты/успешные запуски здесь не проверены.

## 1. Единственная схема деплоя

Репозиторий `pavel949/myUNO-final`; production branch `main`; известный адрес [my-uno-final.vercel.app](https://my-uno-final.vercel.app). Адрес не подтверждает актуальный deployment SHA.

`vercel.json`: install `npm ci`, build `npm run build`, output `.next`, functions region `sin1`, **git.deploymentEnabled=false**. Автоматическая публикация после push/merge отключена. Preview также создаётся явным Vercel deployment и получает отдельную БД/секреты.

`postinstall`: только Prisma generate. Build: Prisma generate → content review gate → Next production build. Никакого автоматического migration repair или schema rollout. Content gate теперь fail-closed в production при отсутствующей/недоступной БД или needs_review; production bypass запрещён. Исключение разрешено только explicit isolated CI с совпадающими DATABASE_URL/DATABASE_URL_TEST на loopback/test DB, без VERCEL_ENV/VERCEL_TARGET_ENV. Server rendering также может обращаться к БД; поведение сборки без БД проверять отдельно.

## 2. Локальная среда и CI

Node 20 (как в CI), npm lockfile, PostgreSQL. `npm ci` → настроить локальную .env → Supabase-compatible test roles → migrate/provision → dev. Полные команды — [CONTRIBUTING](../../CONTRIBUTING.md).

CI использует full Git checkout (fetch-depth=0) для точного revision справочника и поднимает disposable PostgreSQL 16, создаёт совместимые роли, применяет реальную migration chain, проверяет drift/Data API grants, выполняет tests/lint/production typecheck/build. Browser acceptance поднимает отдельную БД и production app, использует synthetic seed и egress guard. Backup restore использует PostgreSQL 17; production-migration runner — Node 24. Это разные назначения, не доказательство версии live DB.

## 3. База и миграции

Supabase используется как PostgreSQL, Prisma — ORM. Default project ref `burcnghheyzbzffzgmjz` и pooler host `aws-1-ap-south-1.pooler.supabase.com` записаны в resolveDatabaseUrl.ts; live размещение требует сверки. Использовать session pooler 5432 и qualified user из панели проекта; секреты — в защищённом окружении. Не копировать production URL в dev/preview.

Runtime resolver может переписать direct Supabase host/transaction port на session pooler, добавляет SSL/connection_limit. Это защитная совместимость, не замена правильной config. Provision отвергает port 6543/pgbouncer=true.

Перед schema rollout: проверить target host/database и backup, изучить SQL и совместимость старого/new app, применить forward-only migrations, сверить drift/history и grants/RLS. Не запускать db push или массовый migrate resolve. Failed migration требует исследования фактической схемы и точечного восстановления; `db:repair` не является обязательным или автоматическим шагом.

Следующие команды — provisioning локального/изолированного окружения. Production schema rollout — через `.github/workflows/production-migration.yml`, а не обход его safety gate. Workflow требует exact-main successful push CI, выполняет read-only ledger preflight, вызывает reusable backup, затем protected production job: target validation, unchanged main, BACKUP_VERIFIED_SHA, pending allowlist/checksums, Prisma migrate deploy и financial snapshot parity. Runner использует существующий resolveDatabaseUrl: canonical direct URL переводится на тот же session pooler, что runtime; target проверяется до и после. Prisma read и CLI migrate получают одну resolved URL, без вывода credentials. Это не гарантирует доступность или валидность secret. Config/content seed остаётся отдельным reviewed шагом. Допуск новых migrations меняется только после review policy.

```bash
# DATABASE_URL уже установлен безопасным способом для изолированного окружения.
npx prisma migrate status
node scripts/provision-database.mjs
npx prisma migrate status
```

Provision запускает migrate deploy, seed-registries, затем считает config/content/translations и завершает с ошибкой при пустых обязательных реестрах. Seed не создаёт inventory. Идемпотентность не отменяет review: seed может обновить существующие значения. Demo `db:seed` — только disposable/local.

## 4. Конфигурация окружения

Полный автоматически извлечённый список переменных с consumer files — [REFERENCE](REFERENCE.md#environment). Значения не включаются в документацию.

| Группа | Переменные / смысл |
|---|---|
| Данные | DATABASE_URL; DATABASE_URL_TEST только для отдельной БД; DATABASE_POOLER_HOST, SUPABASE_PROJECT_REF, DATABASE_CONNECTION_LIMIT — overrides resolver |
| Сессия | SESSION_SECRET; NEXTAUTH_SECRET compatibility fallback; NEXTAUTH_URL для auth links и текущего SEO origin |
| URL | NEXT_PUBLIC_APP_URL — deployed origin; VERCEL_* supplies deployment metadata; NODE_ENV вручную не фиксировать |
| Encryption | ENCRYPTION_KEY — 64 hex AES-256-GCM; сохранять вместе с защищённой recovery-процедурой |
| Почта | RESEND_API_KEY, EMAIL_FROM; отсутствие key не означает доставку |
| Google | NEXT_PUBLIC_GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET; callback `/api/auth/callback/google` |
| Платежи | PAYMENT_PROVIDER=opn, OMISE_PUBLIC_KEY, OMISE_SECRET_KEY; webhook route сверять с adapter, не считать shared secret заменой re-fetch event |
| Media | BLOB_READ_WRITE_TOKEN либо поддерживаемый deployment OIDC + BLOB_STORE_ID; direct upload требует session secret и корректный store/deployment context |
| Jobs | CRON_SECRET, SCHEDULER_MODE; ICAL_FEED_SECRET для feeds; ALERT_WEBHOOK_URL для unexpected errors |
| Content gate | CONTENT_REVIEW_GATE_ENABLED; default production gate не отключать ради обхода непроверенного контента |
| Layantara | LAYANTARA_PROTECTION_INTAKE_ENABLED, UNIFIED_BOOKING_INTAKE_ENABLED, UNIFIED_CHANNEL_ENVIRONMENT, LAYANTARA_WEBHOOK_SECRET; дополнительно ExternalSystem config/mappings/authority |
| GitHub scheduler | Repository secret CRON_SECRET; variable APP_BASE_URL; bypass secret только для protected deployment |
| GitHub backup | BACKUP_DATABASE_URL, BACKUP_PASSPHRASE; это workflow secrets, не public app config |

Разные изолированные окружения имеют свои ключи и synthetic data. При переносе зашифрованных данных в recovery сохранять **тот ключ, которым они зашифрованы**. Не раздавать production ENCRYPTION_KEY разработчикам. Ротация требует контролируемого re-encryption, простой replace делает старые записи нечитаемыми.

## 5. Порядок релиза

1. Зафиксировать main SHA, содержимое открытых PR и scope; проверить CI на точном SHA.
2. Для schema change подготовить reviewed migration, backup/restore evidence и expand/contract rollout; проверить compatibility.
3. На изолированном окружении выполнить schema/config, build и затронутые browser/API процессы.
4. Отдельно выполнить production-migration workflow с успешным exact-SHA backup/restore; seed config/content применить отдельно согласованным rollout. Ни install, ни Vercel deploy этого не делают.
5. Создать явный Vercel production deployment из нужного main SHA или проверенного эквивалентного checkout. Для CLI использовать установленную актуальную версию и её `--help`; не считать merge триггером.
6. Проверить deployment ready, source SHA, production alias, `/api/health`, страницы и затронутый процесс. Не отправлять тестовые письма/платежи реальным людям без отдельной авторизации.
7. Записать environment, commit/deployment, migration state, tests, runtime result и оставшиеся ограничения.

Rollback приложения — возврат к последнему совместимому Vercel deployment; миграции/данные автоматически не откатываются. Несовместимая схема требует forward correction или согласованного recovery.

## 6. Планировщик

| Источник | UTC | Bangkok | Назначение |
|---|---|---|---|
| GitHub scheduler | `*/5 * * * *` | каждые 5 минут | POST `/api/cron/run-frequent` |
| GitHub scheduler | `0 19 * * *` | 02:00 следующего дня | POST `/api/cron/run-all` |
| Vercel daily | `0 7 * * *` | 14:00 | `/api/cron/run-frequent` |
| Vercel daily | `0 19 * * *` | 02:00 следующего дня | `/api/cron/run-all` |
| Vercel media | `0 8 * * *` | 15:00 | `/api/cron/import-managed-yandex-media` |
| GitHub backup | `0 20 * * *` | 03:00 следующего дня | dump→restore check→encrypt→artifact |

Registry имеет 3 frequent job keys и 7 nightly. Intended intervals: booking lifecycle 5 min, TM30/iCal 15 min, остальные daily; actual workflow dispatch и внутренний throttling проверять в dispatch.ts. GitHub schedules best-effort. SCHEDULER_MODE=external ставить только после наблюдаемого успешного исполнения. Health panel: `/app/admin/scheduler`, JobRun history. Три daily entries в Vercel config не доказывают, что текущий тарифный план допускает их и deployment принял конфигурацию.

## 7. Мониторинг и readiness

`GET /api/health`: 200 status=ok/db=ok после SELECT 1; 503 degraded с db=pool_exhausted/unreachable. Это DB reachability, не проверка миграций, mail, Blob, payment или booking correctness.

Launch readiness `/app/admin/launch-readiness` объединяет env presence, scheduler и data/config. Opn enum и Blob OIDC config согласованы с runtime; scheduler требует freshness каждого frequent job. См. evidence и оставшиеся runtime проверки D01/D02. Даже зелёная env presence не доказывает работоспособность provider.

Unexpected errors проходят observability webhook, если он настроен. Retention/uptime settings внешней платформы не гарантированы кодом. Не выводить сырые credentials, PII, passport/deal files или secret values в evidence/log.

## 8. Backup и recovery

Workflow backup.yml содержит nightly pg_dump, restore в scratch PostgreSQL, проверки таблиц/migration history, GPG AES256 и GitHub artifact retention 30 дней. Факт успешного выполнения, quota и полнота доступа backup role проверяются по последнему run. `pg_read_all_data` сам по себе **не обходит RLS**; надо проверить read coverage конкретной backup role. Нельзя считать complete backup по одной настройке роли. Offsite destination пока закомментирован.

Recovery: остановить writers/webhooks/jobs → сохранить повреждённую БД как evidence → получить проверенный artifact и ключ → decrypt → restore в новую защищённую БД → сверить row counts/schema/migration history/grants/RLS и encrypted fields → reconcile внешние payments/bookings после точки backup → переключить совместимое приложение → выполнить acceptance → возобновить writers. SQL dump может включать RLS; после restore проверять фактические flags/policies/grants, не предполагать их потерю или наличие. Production data не восстанавливать в общедоступное staging.

## 9. Эксплуатационные ограничения

- iCal не является real-time ARI; источник может отставать.
- Внешние мессенджеры пока не доставляют сообщения через provider adapter.
- Внутренний polling читает durable данные между экземплярами; in-memory SSE не используется как гарантия доставки.
- Opn, email, storage, cron, backup требуют реальной проверки конфигурации и фактов выполнения.
- Документационный commit не означает новый production deployment.

CI и isolated browser acceptance используют Node24, как подтверждённый Vercel project runtime24.x.

## 10. Доставка notification email после commit

Новые external deliveries имеют status=pending и marker queued_after_commit_v1. TransactionClient не вызывает внешний provider. Root writer может обработать сохранённую запись сразу; booking_lifecycle в frequent slot подбирает bounded batch после commit. Workers сериализуются по delivery id. При временной ошибке/неопределённом provider response запись остаётся pending, повтор использует тот же Idempotency-Key. Provider ack записывает sent; console или queued не считаются delivered.

Ретраи ограничены 23h. Старые unmarked pending и expired retry window требуют ручной сверки с provider, не массового replay. Изменение content/recipient между attempts может быть отклонено provider как changed payload. Проверять в операционном контроле: oldest marked pending, failed reasons, disabled/muted channels, реальную cadence booking_lifecycle и provider ack. Provider errors/driver messages/credentials не сохраняются в failureReason; технические состояния имеют фиксированные безопасные формулировки.

В production на read-only срезе этого пакета NotificationDelivery был пуст; реальная доставка email не подтверждена синтетическими tests.


### Read-only migration diagnostics

production-migration.yml принимает preflight_only=true: выполняются reviewed-main и protected read-only preflight, а backup/migrate пропускаются. Такой run не доказывает применение SQL. pooler_host выбирается явно из configured и двух session hosts ap-south-1; выбор одинаков для preflight и реального migration job. Credentials сохраняются. Для нормального release preflight_only=false, после successful read-only проверки выполняются прежние backup/restore и financial parity gates. Диагностика выводит только validated host/port, Prisma kind/code и фиксированную категорию; raw driver message/URI/SQL не выводятся.
