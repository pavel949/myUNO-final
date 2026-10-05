# myUNO Next.js App Router & Architecture Route Specification
**Target Framework:** Next.js 14/15 (App Router, Route Groups, Server Components & Parallel Routes)  
**Date:** October 2026 | **Version:** 2.4-canonical  
**Design System:** Andaman Sanctuary & Architectural Living  

---

## 1. Обзор архитектуры Next.js App Router

Экосистема **myUNO** организована по принципу изолированных модульных групп маршрутов (`Route Groups`), каждая из которых имеет свой собственный корневой Layout, наборы Middleware-защиты, ролевую модель RBAC и дизайн-контекст:

```
src/app/
├── (public)/                 # Публичная витрина, гостевой портал, бронирование
├── (guest-app)/              # PWA гостя: Активная поездка, цифровой ваучер, Live-трекинг
├── (owner)/                  # Портал собственника & мастер онбординга объектов
├── (agent)/                  # myUNO Agent Hub — брокерский пульт и воронка
├── (vendor)/                 # myUNO Vendor Hub — пульт подрядчиков и нарядов
├── (pms)/                    # myUNO PMS Operations — шахматка, фронтдеск, ночной аудит
├── (pwa-clean)/              # myUNO Clean — мобильное PWA хаускипинга
├── (admin)/                  # myUNO SuperAdmin Global OS — консоль управления
├── (team)/                   # myUNO Homespace — культура, манифест и стратегия
├── (auth)/                   # Единый шлюз авторизации и ролевой маршрутизатор
└── api/                      # Route Handlers (REST & Webhooks)
```

---

## 2. Полная карта маршрутов (Directory Map & Screens Linkage)

### 2.1. Публичная витрина и поиск жилья: `src/app/(public)/`
*Layout:* Стандартный веб-шелл (`web_standard`), Top Navigation Bar + Mega-menu («Аренда», «Купить», «Комплексы», «Услуги», «Собственникам») + Подвал.

| Маршрут | Назначение | Связанный экран в дизайне |
|---|---|---|
| `/` | Главная страница myUNO (Пхукет) с тройным поиском (Отдых / Надолго / Купить) | `{{DATA:SCREEN:SCREEN_115}}` (Desktop)<br>`{{DATA:SCREEN:SCREEN_113}}` (Mobile) |
| `/projects/[slug]` | Портал резиденции (каталог квартир, инфраструктура, скоуп мандата) | `{{DATA:SCREEN:SCREEN_109}}` (The Title Legendary) |
| `/stays/[unitId]` | Карточка апартаментов/виллы, прозрачный расчет цены, условия | `{{DATA:SCREEN:SCREEN_111}}` (Mobile #F-302) |
| `/stays/[unitId]/book` | Чекаут, бронирование, верификация гостя и безопасная оплата Stripe | `{{DATA:SCREEN:SCREEN_107}}` (Desktop)<br>`{{DATA:SCREEN:SCREEN_103}}` (Mobile) |
| `/long-term` | Премиальный каталог долгосрочной аренды (от 1 до 12 месяцев) | `{{DATA:SCREEN:SCREEN_27}}` (Desktop) |
| `/invest` | Каталог покупки недвижимости, инвестиционные расчеты и ROI | `{{DATA:SCREEN:SCREEN_57}}` (Desktop) |
| `/owners` | Посадочная страница для собственников: калькулятор доходности, аудит | `{{DATA:SCREEN:SCREEN_59}}` (Desktop) |
| `/services` | Консьерж-маркетплейс услуг (шефы, авто, яхты, трансферы) | `{{DATA:SCREEN:SCREEN_93}}` (Desktop)<br>`{{DATA:SCREEN:SCREEN_97}}` (Mobile) |
| `/services/[serviceId]` | Страница конкретной услуги с конфигуратором опций и бронью | `{{DATA:SCREEN:SCREEN_91}}` (Шеф-повар Desktop)<br>`{{DATA:SCREEN:SCREEN_89}}` (Шеф Mobile)<br>`{{DATA:SCREEN:SCREEN_95}}` (Аренда авто Mobile) |

---

### 2.2. Гостевой кабинет и PWA проживания: `src/app/(guest-app)/`
*Layout:* Мобильный таб-бар (`mobile_tab`) для главных разделов либо стэк-заголовок с кнопкой назад (`mobile_stack`).

| Маршрут | Назначение | Связанный экран в дизайне |
|---|---|---|
| `/trip/[bookingId]` | Экран активного проживания «Мой UNO» (ключи, PIN Salto, батлер, сервисы) | `{{DATA:SCREEN:SCREEN_99}}` (Mobile #F-302) |
| `/trip/[bookingId]/voucher` | Цифровой ваучер, QR-код заселения, TM.30 статус, правила резиденции | `{{DATA:SCREEN:SCREEN_101}}` (Mobile) |
| `/trip/[bookingId]/orders/[orderId]` | Трекинг выполнения услуги в реальном времени (Live Status) | `{{DATA:SCREEN:SCREEN_9}}` (Mobile Шеф #SRV-9042) |

---

### 2.3. Кабинет собственника и инвестора: `src/app/(owner)/`
*Layout:* Адаптивный дашборд (`web_dashboard`) либо пошаговый мастер визарда.

| Маршрут | Назначение | Связанный экран в дизайне |
|---|---|---|
| `/owner/portal` | Аналитика доходности P&L юнита, выплаты инвестору, личный календарь | `{{DATA:SCREEN:SCREEN_61}}` (Desktop #F-302) |
| `/owner/onboarding` | 2-минутный мастер добавления объекта (выбор комплекса, юнит, контакт) | `{{DATA:SCREEN:SCREEN_21}}` (Шаг 1)<br>`{{DATA:SCREEN:SCREEN_25}}` (Визард) |

---

### 2.4. Рабочее место агента и брокера: `src/app/(agent)/`
*Layout:* Премиальный светлый консольный интерфейс брокера (`web_dashboard`).

| Маршрут | Назначение | Связанный экран в дизайне |
|---|---|---|
| `/agent` | Главный пульт агента: канбан воронка сделок, горячие лиды, активные клиенты | `{{DATA:SCREEN:SCREEN_29}}` (Desktop) |
| `/agent/inventory` | Каталог проверенного инвентаря myUNO с White-Label витриной | `{{DATA:SCREEN:SCREEN_35}}` (Desktop) |
| `/agent/payouts` | Финансовый клиринг, сплит комиссий и реестр выплат брокерам | `{{DATA:SCREEN:SCREEN_33}}` (Desktop) |

---

### 2.5. Пульт сервисных партнеров и вендоров: `src/app/(vendor)/`
*Layout:* Оперативный пульт вендора со списком заказов и графиком (`web_dashboard`).

| Маршрут | Назначение | Связанный экран в дизайне |
|---|---|---|
| `/vendor` | Пульт нарядов, расписание выездов шефов/авто и подтверждение слотов | `{{DATA:SCREEN:SCREEN_23}}` (Desktop) |

---

### 2.6. Отельная система управления: `src/app/(pms)/`
*Layout:* Специализированный темный PMS-шелл (`navy-deep` sidebar V2.4 + селектор смены/кластера).

| Маршрут | Назначение | Связанный экран в дизайне |
|---|---|---|
| `/pms/tape-chart` | Интерактивная 14-дневная шахматка бронирований (Multi-Calendar) | `{{DATA:SCREEN:SCREEN_75}}` (Desktop) |
| `/pms/front-desk` | Операционный пульт Front Desk: заезды, выезды, экспресс-заселение | `{{DATA:SCREEN:SCREEN_13}}` (Desktop) |
| `/pms/folios/[folioId]` | Электронное фолио гостя, начисления, депозиты, сплит вендоров | `{{DATA:SCREEN:SCREEN_87}}` (Desktop #UN-84920) |
| `/pms/inventory-rates` | Номерной фонд, динамические тарифы, стоп-сейлы и Channel Manager | `{{DATA:SCREEN:SCREEN_81}}` (Desktop) |
| `/pms/housekeeping` | Диспетчерский пульт хаускипинга, смены горничных, статус чистоты | `{{DATA:SCREEN:SCREEN_85}}` (Desktop) |
| `/pms/maintenance` | Инженерная служба курорта, наряды на ремонт, аварийные инциденты | `{{DATA:SCREEN:SCREEN_11}}` (Desktop) |
| `/pms/night-audit` | Регламентный ночной аудит, закрытие EOD, сверка кассы и шлюзов | `{{DATA:SCREEN:SCREEN_7}}` (Desktop) |

---

### 2.7. PWA мобильного хаускипинга: `src/app/(pwa-clean)/`
*Layout:* PWA Mobile Viewport (Standalone, Touch UI).

| Маршрут | Назначение | Связанный экран в дизайне |
|---|---|---|
| `/clean/inspection/[unitId]` | Чек-лист проверки чистоты номера супервайзером с фотофиксацией | `{{DATA:SCREEN:SCREEN_55}}` (Mobile #F-302) |

---

### 2.8. Консоль суперадмина экосистемы: `src/app/(admin)/`
*Layout:* Command OS Sidebar (Dark Glass, System Telemetry, Global Search).

| Маршрут | Назначение | Связанный экран в дизайне |
|---|---|---|
| `/admin` | Executive Hub: сводный дашборд всей экосистемы (ADR, GMV, RevPAR) | `{{DATA:SCREEN:SCREEN_73}}` (Desktop) |
| `/admin/portfolio` | Реестр комплексов, скоупы мандатов управления и допуск юнитов | `{{DATA:SCREEN:SCREEN_71}}` (Desktop) |
| `/admin/onboarding/project` | Форма онбординга нового жилого комплекса и настройка отельного мандата | `{{DATA:SCREEN:SCREEN_51}}` (Desktop) |
| `/admin/onboarding/unit` | Верификация и оцифровка нового юнита перед публикацией в каталоге | `{{DATA:SCREEN:SCREEN_53}}` (Desktop) |
| `/admin/onboarding/queue` | Пульт согласования входящих заявок собственников на управление | `{{DATA:SCREEN:SCREEN_49}}` (Desktop) |
| `/admin/expansion` | Управление направлениями экспансии (Пхукет, Алгарве, Барселона) | `{{DATA:SCREEN:SCREEN_19}}` (Desktop) |
| `/admin/import` | Экспресс-импорт и оцифровка объектов из внешних источников (Web, Files, OTA) | `{{DATA:SCREEN:SCREEN_17}}` (Desktop) |
| `/admin/vendors` | Управление каталогом услуг, аккредитация поставщиков и комиссионные сплиты | `{{DATA:SCREEN:SCREEN_65}}` (Desktop) |
| `/admin/ledger` | Главная бухгалтерская книга, сплит-движок 80/20 и клиринг выплат | `{{DATA:SCREEN:SCREEN_69}}` (Desktop) |
| `/admin/iam` | Ролевая безопасность, матрица RBAC прав и неизменяемый аудит-лог | `{{DATA:SCREEN:SCREEN_67}}` (Desktop) |
| `/admin/infrastructure` | Инфраструктурный мониторинг, шлюзы Salto KS, Daikin Cloud, Stripe | `{{DATA:SCREEN:SCREEN_63}}` (Desktop) |

---

### 2.9. Команда и культура: `src/app/(team)/`
*Layout:* Брендированный редакционный Topbar.

| Маршрут | Назначение | Связанный экран в дизайне |
|---|---|---|
| `/team/homespace` | myUNO Homespace: культура, манифест качества, стандарты отбора и роадмап | `{{DATA:SCREEN:SCREEN_3}}` (Desktop) |

---

### 2.10. Авторизация: `src/app/(auth)/`
*Layout:* Чистый модальный / центрированный экран без навигационного мусора.

| Маршрут | Назначение | Связанный экран в дизайне |
|---|---|---|
| `/login` | Единый шлюз авторизации для всех ролей с маршрутизацией по правам | `{{DATA:SCREEN:SCREEN_39}}` (Desktop) |

---

## 3. Next.js Middleware: Ролевая маршрутизация (RBAC & Auth Guard)

Файл `src/middleware.ts` обеспечивает перенаправление пользователей на соответствующие рабочие места в зависимости от сессии:

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('myuno_session_token')?.value;

  // Публичные маршруты доступны без ограничений
  const isPublicRoute = 
    pathname === '/' || 
    pathname.startsWith('/stays') || 
    pathname.startsWith('/projects') || 
    pathname.startsWith('/long-term') || 
    pathname.startsWith('/invest') || 
    pathname.startsWith('/owners') || 
    pathname.startsWith('/services') || 
    pathname === '/login';

  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Защищенные разделы требуют авторизации
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Ролевая маршрутизация (декодирование роли из токена/кэша)
  const userRole = request.cookies.get('myuno_user_role')?.value;

  if (pathname.startsWith('/pms') && !['FRONT_DESK', 'NIGHT_AUDITOR', 'HOTEL_MANAGER', 'SUPER_ADMIN'].includes(userRole || '')) {
    return NextResponse.redirect(new URL('/unauthorized', request.url));
  }

  if (pathname.startsWith('/admin') && userRole !== 'SUPER_ADMIN') {
    return NextResponse.redirect(new URL('/unauthorized', request.url));
  }

  if (pathname.startsWith('/clean') && !['HOUSEKEEPER', 'CLEAN_SUPERVISOR', 'SUPER_ADMIN'].includes(userRole || '')) {
    return NextResponse.redirect(new URL('/unauthorized', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

---

## 4. Рекомендации по интеграции с Claude Code / Cursor

1. Все динамические страницы бронирования (`/stays/[unitId]`, `/projects/[slug]`) должны использовать React Server Components (`RSC`) для первоначальной выборки инвентаря и SEO-метатегов.
2. Для интерактивных компонентов (поисковый виджет, Tape Chart, чекаут, модалки онбординга) используется директива `'use client'`.
3. Сохранение контекста поиска (`SearchContext`: destination, intent, dates, guests) реализовано через URL Query Params (`?intent=holiday&dates=15-22nov&guests=2`), что гарантирует передачу параметров между главной, порталом резиденции и чекаутом без потери состояния.
