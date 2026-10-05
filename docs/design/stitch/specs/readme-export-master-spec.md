# myUNO — One-Stop Destination Living & Hospitality OS
> **Comprehensive Export & Architecture Master Specification for Claude Code & Cursor**  
> **Platform Version:** 2.4-canonical | **Date:** October 2026  
> **Target Framework:** Next.js 14/15 (App Router, Server Components, Tailwind CSS, TypeScript)  
> **Design System:** Andaman Sanctuary & Architectural Living  

---

## 1. Executive Summary & Brand Positioning

**myUNO** — комплексная операционная экосистема для премиального гостеприимства, недвижимости и местных услуг. Платформа объединяет гостей курорта, собственников апартаментов/вилл, брокеров по недвижимости, аккредитованных консьерж-вендоров, отельную операционную команду (PMS) и глобальный менеджмент суперадмина.

### Ключевые ценности архитектуры:
1. **One-Stop Shop с понятной ответственностью**: от выбора апартаментов и прозрачного расчета цены (Total Price Display) до цифрового ваучера заселения с кодами Salto KS, отельного консьерж-сервиса и регулярных выплат инвесторам.
2. **Безупречный визуальный язык**: Фирменная дизайн-система **Andaman Sanctuary** — глубокий изумруд (`#11382e`), фоновая мягкая мята/слоновая кость (`#effcf9`), акцент благородной латуни/янтаря (`#d19a5b`), строгая типографика **Outfit** (заголовки) + **Manrope** (интерфейсы).
3. **Модульная изоляция рабочих мест**: Маршрутизация по Route Groups в Next.js App Router с единым RBAC-шлюзом авторизации.

---

## 2. Архитектура Next.js App Router (`src/app/`)

Экосистема разделена на изолированные функциональные домены:

```
src/app/
├── (public)/                 # Публичная витрина, тройной поиск, резиденции, чекаут
│   ├── page.tsx              # Главная страница myUNO (Пхукет)
│   ├── projects/[slug]/      # Портал резиденции (The Title Legendary, Layantara)
│   ├── stays/[unitId]/       # Карточка апартаментов, расчет стоимости (Quote)
│   │   └── book/             # Оформление бронирования и Stripe чекаут
│   ├── long-term/            # Долгосрочная аренда (от 1 до 12 месяцев)
│   ├── invest/               # Каталог инвестиционной недвижимости и расчет ROI
│   ├── owners/               # Лендинг для собственников: калькулятор доходности
│   └── services/             # Консьерж-маркетплейс услуг (шефы, авто, яхты)
│       └── [serviceId]/      # Конфигуратор и заказ конкретной услуги
│
├── (guest-app)/              # PWA гостя: Проживание, мобильный консьерж, ваучер
│   └── trip/[bookingId]/     # Кабинет активного проживания «Мой UNO»
│       ├── voucher/          # Цифровой ваучер, Salto KS PIN, TM.30 статус
│       └── orders/[orderId]/ # Live-трекинг выполнения услуги (шеф-повар)
│
├── (owner)/                  # Кабинет собственника и онбординг
│   ├── portal/               # Инвесторский дашборд P&L, выплаты, личный календарь
│   └── onboarding/           # 2-минутный мастер добавления объекта в управление
│
├── (agent)/                  # myUNO Agent Hub — брокерский пульт
│   ├── page.tsx              # Канбан воронка сделок и горячие клиенты
│   ├── inventory/            # Инвентарь с White-Label витриной для шеринга
│   └── payouts/              # Финансовый клиринг и сплит комиссий
│
├── (vendor)/                 # myUNO Vendor Hub — пульт подрядчиков
│   └── page.tsx              # Список нарядов, график выездов, подтверждение слотов
│
├── (pms)/                    # myUNO PMS Operations — отельное управление
│   ├── tape-chart/           # 14-дневная интерактивная шахматка (Multi-Calendar)
│   ├── front-desk/           # Пульт ресепшн: заезды, выезды, экспресс-чекин
│   ├── folios/[folioId]/     # Электронное фолио гостя, начисления и депозиты
│   ├── inventory-rates/      # Управление номерным фондом, OTA Channel Manager
│   ├── housekeeping/         # Диспетчерский пульт хаускипинга
│   ├── maintenance/          # Инженерная служба курорта, наряды на ремонт
│   └── night-audit/          # Ночной аудит, закрытие EOD, сверка кассы
│
├── (pwa-clean)/              # myUNO Clean — PWA горничных и супервайзеров
│   └── clean/inspection/[id] # Чек-лист проверки чистоты номера с фотофиксацией
│
├── (admin)/                  # myUNO SuperAdmin Global OS — консоль управления
│   ├── page.tsx              # Executive Hub: глобальный дашборд (GMV, RevPAR)
│   ├── portfolio/            # Реестр комплексов, скоупы мандатов и юниты
│   ├── onboarding/
│   │   ├── project/          # Онбординг нового жилого комплекса
│   │   ├── unit/             # Верификация нового юнита
│   │   └── queue/            # Пульт согласования заявок собственников
│   ├── expansion/            # Направления экспансии (Пхукет, Алгарве, Барселона)
│   ├── import/               # Экспресс-импорт объектов (Web, Files, OTA)
│   ├── vendors/              # Каталог услуг, аккредитация поставщиков
│   ├── ledger/               # Главная бухгалтерская книга, сплит 80/20
│   ├── iam/                  # RBAC права, роли и аудит-лог
│   └── infrastructure/       # Мониторинг шлюзов (Salto KS, Daikin, Stripe)
│
├── (team)/                   # myUNO Homespace
│   └── homespace/            # Манифест качества, культура, ДНК сервиса и роадмап
│
├── (auth)/                   # Единая авторизация
│   └── login/                # Унифицированный вход для всех ролей с роутером прав
│
└── api/                      # REST & Webhooks (Stripe, Salto, Daikin, OTA iCal)
```

---

## 3. Дизайн-система: Andaman Sanctuary & Architectural Living

### 3.1. Цветовая палитра
```typescript
// tailwind.config.ts
colors: {
  brand: {
    primary: '#11382e',         // Andaman Emerald / Deep Pine (основной бренд)
    'primary-hover': '#0c2821', // Темный акцент при наведении
    'primary-light': '#184d3f', // Вспомогательный изумруд
    surface: '#effcf9',         // Мятно-слоновый базовый фон
    'surface-dim': '#cfddd9',    // Деликатные разделители и бордеры
    'surface-card': '#ffffff',   // Белоснежные приподнятые карточки
    'surface-subtle': '#e9f5f2', // Вложенные панели и плашки
    brass: '#d19a5b',           // Янтарь / благородная латунь (акцент ROI и люкса)
    'brass-hover': '#b88244',
    'brass-light': '#fdf6ee',
  },
  navy: {
    deep: '#081713',            // Сайдбар PMS и SuperAdmin Command OS
    card: '#0f241e',            // Темные карточки консолей
    hover: '#18382f',           // Наведение в темном режиме
    border: '#1d4237',          // Границы в темных консолях
  },
  status: {
    success: '#10b981',         // Clean / Confirmed / TM.30 OK
    warning: '#f59e0b',         // Pending Audit / Inspection Needed
    danger: '#ef4444',          // Out of Order (OOD) / Срочный наряд
    info: '#0284c7',             // Информационные бейджи / OTA Sync
  }
}
```

### 3.2. Типографика и шрифты
- **Заголовки (Hero, Section, Card, Metrics):** `Outfit` (`font-display`, `sans-serif`)
- **Интерфейс (Body, Forms, Tables, Badges):** `Manrope` (`font-sans`, `sans-serif`)
- **Финансовые таблицы и таймлайны:** утилита `.font-tabular` (`font-variant-numeric: tabular-nums`)
- **Технические идентификаторы (Фолио, Salto PIN):** `ui-monospace`, `Menlo`, `Monaco`

### 3.3. Стандарт скруглений (Roundness)
- Стандарт `ROUND_EIGHT`: базовые кнопки и инпуты `rounded-lg` (8px).
- Карточки и модальные окна: `rounded-2xl` (16px) или `rounded-3xl` (24px).
- Статусные индикаторы и аватары: `rounded-full` (pill).

---

## 4. Сводный реестр всех экранов проекта (Design Artifacts Inventory)

| Раздел экосистемы | Устройство | Название экрана в проекте | Placeholder ID |
|---|---|---|---|
| **Главная витрина** | Desktop | Главная страница myUNO — Пхукет | `{{DATA:SCREEN:SCREEN_116}}` |
| **Главная витрина** | Mobile | Главная страница myUNO — Пхукет (Mobile) | `{{DATA:SCREEN:SCREEN_114}}` |
| **Резиденция** | Desktop | The Title Legendary — Портал резиденции и каталог апартаментов | `{{DATA:SCREEN:SCREEN_110}}` |
| **Детали объекта** | Mobile | Детали апартаментов и расчет стоимости — The Title Legendary #F-302 | `{{DATA:SCREEN:SCREEN_112}}` |
| **Чекаут и оплата** | Desktop | Оформление бронирования и оплата — The Title Legendary #F-302 | `{{DATA:SCREEN:SCREEN_108}}` |
| **Чекаут и оплата** | Mobile | Оформление бронирования и оплата — The Title Legendary #F-302 (Mobile) | `{{DATA:SCREEN:SCREEN_104}}` |
| **Ваучер заселения** | Mobile | Цифровой ваучер и подтверждение бронирования — The Title Legendary #F-302 | `{{DATA:SCREEN:SCREEN_102}}` |
| **Кабинет гостя** | Mobile | Мой UNO — Активная поездка (The Title Legendary #F-302) | `{{DATA:SCREEN:SCREEN_100}}` |
| **Маркетплейс услуг** | Desktop | Услуги и консьерж-маркетплейс — myUNO (Desktop) | `{{DATA:SCREEN:SCREEN_94}}` |
| **Маркетплейс услуг** | Mobile | Услуги и консьерж-маркетплейс — myUNO (Mobile) | `{{DATA:SCREEN:SCREEN_98}}` |
| **Детали услуги** | Desktop | Детали услуги: Персональный шеф-повар на виллу — myUNO (Desktop) | `{{DATA:SCREEN:SCREEN_92}}` |
| **Детали услуги** | Mobile | Детали услуги: Персональный шеф-повар на виллу (Mobile) | `{{DATA:SCREEN:SCREEN_90}}` |
| **Детали услуги** | Mobile | Детали услуги: Аренда авто без залога паспорта (Mobile) | `{{DATA:SCREEN:SCREEN_96}}` |
| **Live трекинг услуги** | Mobile | Статус заказа услуги в реальном времени — Шеф-повар (#SRV-9042) | `{{DATA:SCREEN:SCREEN_10}}` |
| **Долгосрочная аренда**| Desktop | myUNO — Премиальный каталог долгосрочной аренды (Long-term Living) | `{{DATA:SCREEN:SCREEN_28}}` |
| **Покупка / Инвестиции**| Desktop | myUNO Недвижимость — Каталог покупки, инвестиции и расчет ROI | `{{DATA:SCREEN:SCREEN_58}}` |
| **Лендинг владельцев** | Desktop | myUNO для собственников — Доверительное управление и калькулятор | `{{DATA:SCREEN:SCREEN_60}}` |
| **Кабинет инвестора** | Desktop | myUNO Owner Portal — Аналитика доходности P&L и календарь (#F-302) | `{{DATA:SCREEN:SCREEN_62}}` |
| **Онбординг объекта** | Desktop | myUNO — Выбор комплекса и добавление объекта собственником (Шаг 1) | `{{DATA:SCREEN:SCREEN_22}}` |
| **Онбординг объекта** | Desktop | myUNO — Мастер добавления объекта (Оптимизированный визард) | `{{DATA:SCREEN:SCREEN_26}}` |
| **Agent Hub** | Desktop | myUNO Agent Hub — Премиальный и чистый пульт брокера | `{{DATA:SCREEN:SCREEN_30}}` |
| **Agent Hub** | Desktop | myUNO Agent Hub — Оптимизированный пульт агента и воронка сделок | `{{DATA:SCREEN:SCREEN_32}}` |
| **Agent Hub** | Desktop | myUNO Agent Hub — Инвентарь и White-label витрина для клиентов | `{{DATA:SCREEN:SCREEN_36}}` |
| **Agent Hub** | Desktop | myUNO Agent Hub — Финансовый клиринг, сплит комиссий и реестр выплат | `{{DATA:SCREEN:SCREEN_34}}` |
| **Vendor Hub** | Desktop | myUNO Vendor Hub — Оптимизированный пульт партнера и нарядов | `{{DATA:SCREEN:SCREEN_24}}` |
| **PMS: Шахматка** | Desktop | myUNO PMS — Интерактивная шахматка бронирований (Tape Chart) | `{{DATA:SCREEN:SCREEN_76}}` |
| **PMS: Front Desk** | Desktop | myUNO PMS — Операционный пульт Front Desk & Экспресс-заселение | `{{DATA:SCREEN:SCREEN_14}}` |
| **PMS: Фолио гостя** | Desktop | myUNO PMS — Карточка бронирования и фолио гостя (#UN-84920) | `{{DATA:SCREEN:SCREEN_88}}` |
| **PMS: Тарифы и OTA** | Desktop | myUNO PMS — Номерной фонд, динамические тарифы и каналы продаж | `{{DATA:SCREEN:SCREEN_82}}` |
| **PMS: Хаускипинг** | Desktop | myUNO PMS — Диспетчерский пульт хаускипинга и myUNO Clean | `{{DATA:SCREEN:SCREEN_86}}` |
| **PMS: Инженерия** | Desktop | myUNO PMS — Инженерная служба, инциденты и наряды на ремонт | `{{DATA:SCREEN:SCREEN_12}}` |
| **PMS: Ночной аудит** | Desktop | myUNO PMS — Ночной аудит и финансовое закрытие дня | `{{DATA:SCREEN:SCREEN_8}}` |
| **PWA Clean** | Mobile | myUNO Clean — PWA супервайзера хаускипинга и инспекция (#F-302) | `{{DATA:SCREEN:SCREEN_56}}` |
| **SuperAdmin: Hub** | Desktop | myUNO SuperAdmin — Executive Hub (Глобальный дашборд экосистемы) | `{{DATA:SCREEN:SCREEN_74}}` |
| **SuperAdmin: Portfolio**| Desktop | myUNO SuperAdmin — Portfolio & Projects (Управление комплексами) | `{{DATA:SCREEN:SCREEN_72}}` |
| **SuperAdmin: Онбординг**| Desktop | myUNO — Онбординг жилого комплекса и скоуп мандата | `{{DATA:SCREEN:SCREEN_52}}` |
| **SuperAdmin: Верификация**| Desktop | myUNO — Онбординг и верификация юнита (#F-302) | `{{DATA:SCREEN:SCREEN_54}}` |
| **SuperAdmin: Заявки** | Desktop | myUNO — Пульт согласования заявок собственников и мандатов | `{{DATA:SCREEN:SCREEN_50}}` |
| **SuperAdmin: Экспансия**| Desktop | myUNO SuperAdmin — Направления & Экспансия (Алгарве, Барселона) | `{{DATA:SCREEN:SCREEN_20}}` |
| **SuperAdmin: Импорт** | Desktop | myUNO SuperAdmin — Экспресс-импорт и оцифровка недвижимости | `{{DATA:SCREEN:SCREEN_18}}` |
| **SuperAdmin: Ledger** | Desktop | myUNO SuperAdmin — Ledger, Split Engine & Payouts (Клиринг 80/20) | `{{DATA:SCREEN:SCREEN_70}}` |
| **SuperAdmin: IAM** | Desktop | myUNO SuperAdmin — IAM, RBAC & Audit Trail (Аудит-лог) | `{{DATA:SCREEN:SCREEN_68}}` |
| **SuperAdmin: Vendors**| Desktop | myUNO SuperAdmin — Services & Vendor Hub (Маркетплейс и вендоры) | `{{DATA:SCREEN:SCREEN_66}}` |
| **SuperAdmin: Cloud** | Desktop | myUNO SuperAdmin — Инфраструктура, API-шлюзы & Cloud Clusters | `{{DATA:SCREEN:SCREEN_64}}` |
| **Команда & Культура** | Desktop | myUNO Homespace — Манифест, культура и стратегия команды | `{{DATA:SCREEN:SCREEN_4}}` |
| **Авторизация** | Desktop | myUNO — Единый вход и авторизация (Unified Auth & Role Gateway) | `{{DATA:SCREEN:SCREEN_40}}` |

---

## 5. Пошаговые инструкции для Claude Code & Cursor

### Шаг 1: Настройка Tailwind и шрифтов
1. Скопируйте конфигурацию из документа `{{DATA:DOCUMENT:DOCUMENT_3}}` в `tailwind.config.ts`.
2. Подключите шрифты в `src/app/layout.tsx`:
   ```tsx
   import { Outfit, Manrope } from 'next/font/google';

   const outfit = Outfit({
     subsets: ['latin'],
     variable: '--font-outfit',
     display: 'swap',
   });

   const manrope = Manrope({
     subsets: ['latin', 'cyrillic'],
     variable: '--font-manrope',
     display: 'swap',
   });

   export default function RootLayout({ children }: { children: React.ReactNode }) {
     return (
       <html lang="ru" className={`${outfit.variable} ${manrope.variable}`}>
         <body className="font-sans bg-brand-surface text-brand-primary min-h-screen">
           {children}
         </body>
       </html>
     );
   }
   ```

### Шаг 2: Создание базовых шеллов (App Shells)
Создайте унифицированные Layout-компоненты:
- `StandardPublicLayout` (`src/app/(public)/layout.tsx`) — верхняя навигация с логотипом `{{DATA:IMAGE:IMAGE_118}}`, меню (Аренда, Купить, Комплексы, Услуги, Собственникам) и подвал.
- `DarkConsoleLayout` (`src/app/(pms)/layout.tsx` и `src/app/(admin)/layout.tsx`) — сайдбар `navy-deep` (`#081713`), статус смены и телеметрия.
- `PwaMobileLayout` (`src/app/(guest-app)/layout.tsx` и `src/app/(pwa-clean)/layout.tsx`) — мобильный вьюпорт с фиксированным нижним таб-баром либо стэк-заголовком.

### Шаг 3: Реализация Server Components & Client Boundaries
- Для каталогов инвентаря и карточек объектов используйте **React Server Components (RSC)** для прямой выборки из базы данных.
- Для поискового виджета, интерактивной шахматки Tape Chart, формы чекаута и визарда онбординга добавьте директиву `'use client'`.
- Сохраняйте состояние поиска (`destination`, `intent`, `dates`, `guests`) в URL Query Params для бесшовного переноса между страницами.

### Шаг 4: Подключение Middleware и RBAC
Внедрите `src/middleware.ts` из документа `{{DATA:DOCUMENT:DOCUMENT_2}}` для безопасного разграничения доступа по ролям.

---

*Спецификация сгенерирована и сохранена в проект. Все эталонные экраны доступны для визуального референса на холсте Stitch.*
