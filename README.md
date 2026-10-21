# myUNO — Property, Hospitality & Services OS

> **Application identity (2026-10-21):** Next.js myUNO Final, repository `pavel949/myUNO-final`. `pavel949/myuno` is a separate React/Vite application. Both require the same verified 39-villa Layantara catalogue and tariffs. [Current data, publication status and remaining parity work](docs/LAYANTARA_APPLICATION_PARITY.md).

**Актуальная документация по коду `main` на 16 октября 2026.** Репозиторий: [pavel949/myUNO-final](https://github.com/pavel949/myUNO-final). Точный срез исходников: codeRevision в [REFERENCE](docs/current/REFERENCE.md). Реальная production-готовность и проверенные ограничения: [оценка](docs/current/READINESS_ASSESSMENT.md); план достижения 9/10: [критерии и работы](docs/current/PRODUCTION_READINESS_PLAN.md).

myUNO объединяет поиск жилья, прямое бронирование, проживание, PMS, владельцев, управляющих, CRM, услуги и финансовый учёт Ignatev Estate. Один физический объект и одна Identity связывают эти процессы. Внутри — Next.js modular monolith с PostgreSQL; публичные страницы и рабочие кабинеты работают в одном приложении.

## Начать здесь

| Задача | Документ |
|---|---|
| Понять всю систему и каждый модуль | [Описание системы](docs/current/SYSTEM.md) |
| Увидеть реализованное и оставшиеся работы | [Матрица реализации и backlog](docs/current/IMPLEMENTATION_STATUS.md) |
| Готовность к production и план 9/10 | [Оценка](docs/current/READINESS_ASSESSMENT.md) · [План](docs/current/PRODUCTION_READINESS_PLAN.md) |
| Сверить все 30 целевых бизнес-процессов | [CO01–CO30 и функции без реализации](docs/current/PROCESS_COVERAGE.md) |
| Найти любой экран, API, модель, enum или тест | [Полный справочник кода](docs/current/REFERENCE.md) |
| Установить и запустить проект | [Разработка](CONTRIBUTING.md) |
| Деплой, БД, секреты, scheduler, backup, восстановление | [Эксплуатация и Vercel](docs/current/OPERATIONS.md) |
| Операционные инструкции команды | [SOP](docs/SOPs/README.md) |
| Безопасность и доступ | [Security](SECURITY.md) |
| Продуктовая цель и правила изменений | [PROJECT.md](PROJECT.md) и [canonical](docs/canonical/README.md) |
| Найти остальные документы и понять их статус | [Каталог документации](docs/README.md) |

## Что уже есть

- **Гость:** поиск/фильтры/карта/избранное → проект/категория/квартира → quote/review → request или instant booking → оплата → Trips/Home Space → паспортные данные/check-in → услуги/support → checkout/review.
- **PMS:** Today, календарь, reservations/stays, карточка объекта, operating spaces/teams, заезды/выезды, уборка, inspection, maintenance/preventive plans, TM30, расходы и возвраты.
- **Недвижимость:** комплексы, районы, структура/категории/квартиры, факты/спальные места, фото/видео, инфраструктура и её правила/часы/бронь, nearby places, редакторы, drafts/review/publish gates.
- **Владелец и управляющий:** портфель, own stay, bookings, compliance/readiness, statements/sign-off, выплаты; MC scoped portfolio.
- **Сотрудники:** ограниченные права на контент, тарифы, режим бронирования; предложения изменений с review/approval; scoped creation и делегирование доступа.
- **CRM:** лиды, общий Identity, opportunities, activities, consent, attribution, property deals и приватные доказательства.
- **Услуги:** проверка поставщиков, каталог, project/standalone заказы, оплата/принятие/исполнение, подтверждение заказчиком и окно спора, автоматическое закрытие, no-show/cancel/refund, отзывы, выплаты поставщикам.
- **Контроль:** конфигурация, CMS/i18n, audit, KPI, scheduler/launch readiness, integration health и Layantara import.

Наличие кода не означает, что все эти процессы прошли production-приёмку. По каждому модулю ограничения и проверки указаны в [матрице](docs/current/IMPLEMENTATION_STATUS.md).

## Реальный стек

| Слой | Реализация |
|---|---|
| Web | Next.js 14 App Router, React 18, TypeScript |
| UI | Tailwind CSS 3, локальные компоненты и Stitch tokens |
| Карта | MapLibre GL 4.7.1; поиск мест в `src/lib/place-search.ts` |
| Данные | PostgreSQL через Prisma 5; Supabase используется как PostgreSQL, без Supabase JS/Auth SDK |
| Авторизация | Собственные Identity/AuthAccount, bcrypt, signed session cookies, Google OAuth |
| Деплой | **Vercel**, `vercel.json`, функции `bom1` |
| Файлы | Vercel Blob; внешние разрешённые фото отдельно перечислены в `next.config.js` |
| Email | Resend через HTTP adapter |
| Оплаты | Cash/transfer accounting; Opn adapter; mock только для разработки |
| Проверки | Vitest, Testing Library, ESLint, TypeScript, GitHub Actions, isolated Chromium acceptance |
| Языки | RU/EN/TH/ZH в коде, RU default; полнота переводов проверяется отдельно |

Git auto-deploy сейчас **отключён** (`git.deploymentEnabled: false`). Merge в main сам по себе не доказывает публикацию. [Процедура релиза](docs/current/OPERATIONS.md) требует сверки SHA приложения и миграций.

## Быстрый локальный запуск

Node.js 24 (как в CI и Vercel) и отдельная PostgreSQL БД; production credentials сюда не копировать.

```bash
npm ci
cp .env.example .env
# Заполнить локальные DATABASE_URL, отдельный DATABASE_URL_TEST и dev secrets.
# На обычном PostgreSQL сначала создать совместимые роли для migration chain:
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/sql/supabase-compat-roles.sql
node scripts/provision-database.mjs
npm run dev
```

Provision применяет миграции и seed реестров config/content. Demo inventory не создаёт. `npm run db:seed` содержит демонстрационные данные и разрешён только на изолированной dev/test БД. Перед любыми миграциями проверить целевой host/database.

## Навигация по исходникам

| Путь | Назначение |
|---|---|
| `src/app/` | App Router pages, route handlers, server actions и route-local helpers |
| `src/modules/` | 21 каталог: 20 runtime-доменов и `workflows` с integration tests |
| `src/components/` | Переиспользуемые интерфейсы, Stitch, calendar/property/guest components |
| `src/lib/` | Сессия, Prisma, money/date/i18n/SEO, launch readiness, navigation |
| `src/jobs/` | Реестр 10 задач, dispatch, auth, история и health |
| `prisma/schema.prisma` | 118 моделей; источник точных полей и связей |
| `prisma/migrations/` | 94 SQL-миграции; наличие в Git не доказывает применение |
| `scripts/` | Provision, audit, verification, import, browser acceptance и maintenance |
| `.github/workflows/` | CI, isolated browser acceptance, scheduler, backup, protected production migration |
| `docs/current/` | Текущее состояние и воспроизводимый справочник |
| `docs/canonical/` | Целевые требования; требования не считаются автоматически реализованными |
| `legacy/` | Справочные материалы; не runtime приложения |

В срезе: **174 page entry points, 248 route handlers (245 API), 553 файла тестов, 0 выявленных совпадений нормализованных URL**. Это статические количества, не число пройденных проверок. Справочник содержит все записи, методы API и source links.

## Проверки и обновление документации

```bash
npm run audit:inventory:test
npm run audit:inventory -- --out /tmp/myuno-inventory.json
node scripts/generate-repository-reference.mjs
node scripts/check-repository-docs.mjs
npm run lint
npx tsc --noEmit --project tsconfig.production.json
npm test
npm run build
```

DB-backed тесты очищают тестовые таблицы. Запускать только с отдельным `DATABASE_URL_TEST`. Успешная сборка не проверяет реальные письма, платежи, фото, права, scheduler и восстановление.

При изменении маршрута, модели, модуля или интеграции обновлять [SYSTEM](docs/current/SYSTEM.md), [IMPLEMENTATION_STATUS](docs/current/IMPLEMENTATION_STATUS.md), перегенерировать [REFERENCE](docs/current/REFERENCE.md). Политика классификации документов — [DOCS_POLICY](docs/current/DOCS_POLICY.md).

## Что ещё остаётся

Подтверждённые разрывы: внешняя отправка WhatsApp/Telegram; полный OTA ARI; рабочий quote lifecycle услуг и replacement-hold reschedule; provider-backed realtime transport (текущий DB polling работает между экземплярами). Launch-readiness уже согласован с Opn/Blob adapters; реальная provider acceptance остаётся отдельной проверкой. Production schema/config/data, live платежи/письма, private/cross-scope media и права требуют отдельной проверки. Реальный admin Blob upload в QA draft и restore120 tables подтверждены; evidence и текущая оценка — в [assessment](docs/current/READINESS_ASSESSMENT.md). Открытые PR не включены в описание main. Все пункты с доказательствами и приёмкой — в [backlog](docs/current/IMPLEMENTATION_STATUS.md).

## Права

Proprietary software of Ignatev Estate Co., Ltd. All rights reserved.
