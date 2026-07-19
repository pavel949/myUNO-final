# myUNO Platform — Operating System for Serviced Living

**myUNO** is a comprehensive operating platform designed for serviced residential developments, enabling seamless management of stays, living arrangements, and property ownership. Built for the Russian-speaking clientele in Phuket's Andaman corridor, myUNO serves as the single system of record for all resident interactions, bookings, communications, and financial transactions.

---

## The Platform at a Glance

myUNO powers three interconnected experiences:

- **🏨 Stay** — Guest arrival, accommodation management, TM30 immigration compliance, service ordering
- **🏠 Live** — Resident communication, ticket support, service access, announcements  
- **👥 Own** — Owner dashboards, financial statements, unit management, compliance visibility

All three operate on a unified data model where a person's role determines what they see and can do.

---

## Key Features

### For Residents & Guests
- **Booking & Stay Management** — Search availability, reserve dates, manage reservations, view booking details
- **Service Marketplace** — Browse and book services (housekeeping, repairs, concierge, etc.) from vetted providers
- **Messaging** — Direct communication with management and service providers with read receipts and photo attachments
- **Tickets & Support** — Raise support requests, track status, view resolution history
- **Notifications** — Real-time alerts on bookings, messages, announcements, and system updates
- **Digital Handbook** — Access house rules, amenities, emergency contacts, and community guidelines

### For Owners
- **Portfolio Dashboard** — View all owned units across projects in one unified interface
- **Financial Transparency** — Monthly statements showing revenue, costs, NOI, and owner share (subject to cap)
- **Unit Status** — Monitor occupancy, upcoming arrivals/departures, maintenance alerts
- **Compliance Visibility** — Track TM30 filings, licensing status, mobilization progress
- **Alert Feed** — Real-time alerts on overdue compliance, unit pauses, and critical tickets
- **Earnings History** — View detailed earning reports with per-listing breakdowns and trends

### For Operators/Staff
- **Operations Board** — Today's arrivals/departures, pending payments, service job queue
- **Service Management** — Accept/decline service orders, track fulfillment, record completion
- **Guest Management** — Oversee active stays, guest information, support tickets
- **Financial Records** — Cash payment tracking (receipt/чек-based for RU clientele), deposit recording
- **TM30 Compliance** — File immigration notifications within 24h SLA with escalation tracking
- **Admin Panel** — Content management (RU/EN/TH), configuration, user roles, moderation

### For Management Companies / Third Parties
- **Revenue Sharing** — Configurable platform fees per project, audit-logged transactions
- **Service Commission** — Take-rate on marketplace revenue, automated payout processing
- **Analytics** — Occupancy rates, revenue trends, guest retention, attachment rates

### For Service Providers
- **Provider Portal** — Apply for vetting, manage service listings, accept/decline orders
- **Order Queue** — View pending orders, client details, schedule, and fulfillment tracking
- **Rating & Reviews** — View customer ratings and feedback; reply to reviews
- **Payout Management** — Track earnings, commission deductions, remittance history

---

## Architecture & Technical Approach

### Design Philosophy

**Single Source of Truth:** The platform enforces a canonical data model:
```
Project → Unit → Identity → Roles → Permissions
```

Every person is a singular, global identity. Roles are data (not code branches), scoped to projects and units. A person holds distinct roles at different properties — owner at one, guest at another, provider member at a third. Permissions are table-driven and enforced server-side on every query.

**Everything Editable Without Code:** Three layers keep the platform flexible:
1. **Content / i18n** — All user-facing strings (RU/EN/TH) in the database, edited via admin panel
2. **Configuration** — Every fee, commission, SLA, rate, cap, and policy is a registered parameter, per-project overridable
3. **Design** — One themeable design system drives all UIs; no hardcoded colors or components

**System of Record:** myUNO is the single authoritative source for all transactions. OTAs, Telegram, WhatsApp, and payment processors are channels *onto* the platform, not parallel systems. A unit is entered once; it appears everywhere.

### Technology Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Framework** | Next.js 14 (App Router) | React Server Components for security & performance; client-side rendering opt-in |
| **Language** | TypeScript (strict mode) | Type safety across client/server boundary; catches errors at build time |
| **Database** | PostgreSQL | ACID compliance for financial transactions; JSONB for flexible schemas |
| **ORM** | Prisma | Type-safe DB access; migration files (no db-push); schema introspection |
| **Auth** | NextAuth v4 | JWT-based sessions; multi-provider support (email, OAuth) |
| **Styling** | Tailwind CSS + Design Tokens | Rapid iteration; consistent theming across RU/EN/TH variants |
| **Testing** | Vitest | Fast unit + integration tests; three-tier coverage (unit/API/component) |
| **Payments** | Omise/Opn (Thailand) + Cash Rail | Provider-agnostic seam; card networks + cash-first for RU clientele |
| **Infrastructure** | Vercel + Supabase | Zero-config deployment; serverless functions; managed Postgres |

### Module Architecture

The codebase is organized as a **modular monolith**:

```
src/modules/
  core/              # Identity, roles, permissions (single source)
  booking/           # Stay bookings, reservations, availability
  services/          # Service marketplace, orders, provider management
  finance/           # Ledger, statements, payouts, commission tracking
  compliance/        # TM30, licensing, mobilization checklists
  comms/             # Messaging, tickets, announcements, notifications
  config/            # Business rules (fees, SLAs, policies)
  content/           # i18n keys, translations (RU/EN/TH)
  analytics/         # Events, metrics, rollups, insights
  integrations/      # Payment processor adapters, external APIs
```

Each module:
- Exports one `index.ts` interface (public API)
- Owns its data models (Prisma relations)
- Connects via the core and shared seams (no module-to-module imports)
- Has full test coverage (unit + integration)

**Core Principle:** Only `core` writes identities and role assignments. Modules are stateless consumers of role data; the platform decides visibility.

---

## Legal & Compliance

myUNO is built with Thailand-specific and PDPA requirements embedded:

- **Immigration (TM30)** — 24-hour filing SLA for foreign guest arrivals; escalation tracking
- **Licensing & Permitted Use** — Hard gate on unit go-live; compliance record tracking
- **Payment Regulation** — No FX operations; no guest fund holding without license (deposits are pre-auth only)
- **Data Protection** — PDPA-compliant PII handling; field-level encryption for passports/payment data
- **Financial Auditing** — Append-only ledger; all transactions linked to source rows; statements gate on admin sign-off
- **Receipt Tracking** — Cash payment rail captures receipt/чек number (primary for Russian clients)

---

## Specification & Documentation

The platform is guided by a complete specification suite (16 documents):

- **[Business Model](docs/business/Ignatev_Estate_Business_and_Operating_Model_v3.md)** — Revenue streams, engagement types, unit economics
- **[User Journey Audit](docs/business/user_journey_audit.md)** — End-to-end flows for guests, owners, staff, providers
- **[Architecture Decisions](docs/01_architecture_decisions.md)** — Locked decisions D1–D10 (single monolith, no plugins, module structure)
- **[Data Model](docs/02_data_model.md)** — Schema, relationships, constraints (project → unit → identity → roles)
- **[Roles & Permissions](docs/03_roles_and_permissions.md)** — Table-driven matrix; roles: owner, guest, resident, buyer, provider, MC, staff, admin
- **[Configuration](docs/04_configuration.md)** — Registered parameters (fees, SLAs, caps, policies); per-project overrides
- **[Content & i18n](docs/05_content_i18n.md)** — All user-facing strings as database keys; RU/EN/TH support
- **[Design System](docs/06_design_system.md)** — Components, tokens, compositions; Tailwind-based theming
- **[Flows](docs/07_flows.md)** — Complete interaction paths; error states and unhappy paths
- **[Pages & Routes](docs/08_pages.md)** — All screens; role-based visibility; navigation structure
- **[Communication & Services](docs/09_communication_and_services.md)** — Shared comms layer; service marketplace spec
- **[Payments & Money](docs/10_payments.md)** — Cash rail, payment seams, statement logic, payout rules
- **[Notifications](docs/11_notifications.md)** — Events and notification types; real-time delivery patterns
- **[Security & Privacy](docs/12_security_privacy.md)** — PII handling, encryption, access logs, audit trail
- **[Analytics](docs/13_analytics.md)** — Events, metrics, KPIs, rollups
- **[Tech Specification](docs/14_tech_spec.md)** — Stack, architecture, performance targets, deployment
- **[Deployment](docs/15_deployment.md)** — Production checklist, secrets management, monitoring
- **[Build Plan](docs/16_build_plan.md)** — Phased execution plan; task dependencies; DoD criteria
- **[Open Questions](docs/open_questions.md)** — Founder's question queue; provisional defaults; decisions pending

---

## Getting Started

### Prerequisites
- Node.js 18+ 
- PostgreSQL 14+
- Git

### Local Setup

```bash
# Clone the repository
git clone https://github.com/pavel949/myUNO-final.git
cd myUNO-final

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your database URL and secrets

# Set up database
npm run db:migrate
npm run db:seed

# Start development server
npm run dev
```

Visit `http://localhost:3000`

### Key Commands

```bash
npm run build          # TypeScript compilation + Next.js build
npm run lint           # ESLint + strict checks (no-literal-ui-text)
npm test               # Vitest: unit + integration + component tests
npm run test:watch     # Watch mode
npm run db:studio      # Prisma Studio (database GUI)
npm run db:seed        # Seed demo data (idempotent)
```

### Environment Variables

```env
DATABASE_URL=postgresql://user:password@localhost:5432/myuno
NEXTAUTH_SECRET=<random-secret>
NEXTAUTH_URL=http://localhost:3000
ENCRYPTION_KEY=<32-byte-hex-aes-256-key>  # Never change in production!

# Optional: Payments
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Optional: Email
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@myuno.local

# Optional: OAuth
GITHUB_ID=...
GITHUB_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

---

## Current Status

**Phase:** Active development (Dashboards + Service Marketplace + Compliance)

**Completed:**
- ✅ Core data model (project → unit → identity → roles)
- ✅ Authentication & authorization (role-based access control)
- ✅ Stay booking system (guest reservations, availability, pricing)
- ✅ Service marketplace (provider vetting, order placement, fulfillment)
- ✅ Messaging (real-time conversations, read receipts, file attachments)
- ✅ Ticket system (support queue, SLA tracking, status history)
- ✅ Content management (RU/EN/TH, database-driven)
- ✅ Financial ledger (append-only, audit-logged)
- ✅ Admin panel (user management, moderation, configuration)
- ✅ Design system (tokens, components, responsive layouts)

**In Progress:**
- 🔄 Owner dashboards (financial statements, compliance visibility, KPIs)
- 🔄 Guest home-space portal (handbook, quick actions, folio)
- 🔄 Service fulfillment & ratings (provider queue, reviews, reputation)

**Planned (next phases):**
- 📋 Operations board (TM30 SLA management, staff workflows)
- 📊 Analytics & reporting (KPIs, trends, occupancy heatmaps)
- 🔐 Advanced compliance (license tracking, permitted-use confirmations)
- 💳 Multi-currency & advanced payments (Stripe, Thai banks, FX routing)
- 📱 Mobile app (React Native - content shared with web)

---

## Testing Strategy

myUNO maintains three tiers of automated test coverage:

### 1. Unit Tests
Pure logic: pricing calculations, hold expiry, serializers, email templates.
```bash
npm test -- libs/*.test.ts
```

### 2. Integration / API Tests
Full request/response cycles via route handlers against a dedicated test DB.
Covers: CRUD operations, auth flows, payment workflows, notifications.
```bash
npm test -- api/**/*.integration.test.ts
```

### 3. Component Tests
React Testing Library for UI components (buttons, forms, modals).
```bash
npm test -- components/**/*.test.tsx
```

All tests run in CI on every push. Database is provisioned fresh per run.

---

## Contributing

This repository follows a **specification-first** methodology:

1. **Read the spec.** All features are documented in `docs/` before code is written.
2. **Execute the plan.** `docs/16_build_plan.md` is the task queue; features are completed one at a time.
3. **Keep specs in sync.** Configuration changes go to `docs/04_*.md`; new events to `docs/13_*.md`; new content keys to `docs/05_*.md` — in the same commit as code.
4. **No invention.** Missing details? Log them in `docs/open_questions.md` and stop; the founder decides.
5. **Three rules for code:**
   - Content: use database keys + `t()` (never hardcoded strings)
   - Config: read from database parameters (never hardcoded values)
   - Look: use design system components (never invented UI)

---

## Project Structure

```
myUNO-final/
├── docs/                          # Complete specification suite
│   ├── business/                  # Business model, positioning, journey audit
│   ├── brand/                     # Brand guidelines, art direction
│   ├── 00_legacy_audit.md         # What to take/reuse from legacy repos
│   ├── 01_architecture_decisions.md  # Locked D1–D10
│   ├── 02_data_model.md           # Schema + relationships
│   ├── 03_roles_and_permissions.md  # Access control matrix
│   ├── 04_configuration.md        # Business rules (fees, SLAs, etc.)
│   ├── 05_content_i18n.md         # i18n keys and translation strategy
│   ├── 06_design_system.md        # UI tokens, components, compositions
│   ├── 07_flows.md                # Complete user flows + error paths
│   ├── 08_pages.md                # Screen inventory and navigation
│   ├── 09_communication_and_services.md  # Messaging, tickets, marketplace
│   ├── 10_payments.md             # Money rules, ledger, statements
│   ├── 11_notifications.md        # Events and push delivery
│   ├── 12_security_privacy.md     # PDPA, encryption, audit logs
│   ├── 13_analytics.md            # Metrics, KPIs, rollups
│   ├── 14_tech_spec.md            # Architecture, stack, performance
│   ├── 15_deployment.md           # Production checklist
│   ├── 16_build_plan.md           # Phased execution (current phase)
│   └── open_questions.md          # Founder's decision queue
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── layout.tsx             # Root layout
│   │   ├── page.tsx               # Home
│   │   ├── api/                   # Route handlers (backend)
│   │   ├── owner/                 # Owner dashboard
│   │   ├── services/              # Service marketplace + customer UX
│   │   ├── messages/              # Messaging interface
│   │   ├── tickets/               # Support tickets
│   │   ├── trips/                 # Guest reservations
│   │   ├── app/admin/             # Admin panel
│   │   ├── actions/               # Server-side data fetching
│   │   ├── components/            # UI components
│   │   ├── hooks/                 # React hooks (Zustand stores)
│   │   ├── libs/                  # Utilities (auth, payments, etc.)
│   │   └── types/                 # TypeScript interfaces
│   ├── modules/                   # Modular monolith (business logic)
│   │   ├── core/                  # Identity, roles, permissions
│   │   ├── booking/               # Reservations, stays
│   │   ├── services/              # Service marketplace
│   │   ├── finance/               # Ledger, statements, payouts
│   │   ├── compliance/            # TM30, licensing, checklists
│   │   ├── comms/                 # Messaging, tickets, announcements
│   │   ├── config/                # Configuration engine
│   │   ├── content/               # i18n content management
│   │   ├── analytics/             # Events, metrics, rollups
│   │   └── integrations/          # External APIs, payment processors
│   ├── lib/                       # Shared libraries (Prisma, etc.)
│   └── test/                      # Test utilities, factories, setup
├── prisma/
│   ├── schema.prisma              # Data model
│   ├── seed.ts                    # Seed script
│   └── migrations/                # Migration files
├── public/
│   └── uploads/                   # User-uploaded images (git-ignored)
├── .env.example                   # Environment template
├── .gitignore                     # Git ignore rules
├── CLAUDE.md                      # AI assistant guidelines (read by Claude Code)
├── package.json                   # Dependencies + scripts
├── tsconfig.json                  # TypeScript config (strict mode)
├── tailwind.config.ts             # Tailwind + design tokens
├── vitest.config.ts               # Test configuration
└── README.md                      # This file
```

---

## Performance & Scalability

### Targets
- **Page load:** < 2s (Core Web Vitals)
- **Search/filter:** < 500ms (DB indexed queries)
- **Messaging:** < 100ms latency (WebSocket/SSE)
- **Payments:** < 3s round-trip (via Omise/Stripe)
- **Concurrent users:** 500+ (serverless auto-scaling)

### Optimizations
- **Server components:** Content rendered on server; JS shipped only for interactivity
- **Indexed queries:** All search/filter operations on indexed columns (listing ID, date ranges, status)
- **Caching:** Images cached in CDN; static content versioned
- **Real-time seams:** SSE for messaging/notifications (scales to ~1k concurrent per instance; swap in-process bus for Redis for multi-instance)
- **Background jobs:** Cron tasks (TM30 escalation, hold expiry, payout processing) run on schedule

---

## Security

- **Authentication:** NextAuth with JWT sessions; email + OAuth support
- **Authorization:** Role-based access control; enforced on every query via `core.can()`
- **Data encryption:** PDPA-required PII fields encrypted at rest (AES-256-GCM)
- **Payment data:** Never stored locally; delegated to Omise/Stripe
- **SQL injection:** Prisma parameterized queries (no raw SQL)
- **CSRF:** NextAuth CSRF tokens on all state-changing operations
- **HTTPS only:** All traffic encrypted in transit
- **Secrets:** Environment variables, rotated regularly; PII encryption key never changed in production

---

## License

Proprietary. All rights reserved.

For inquiries, contact pavel@ignatevestate.com.

---

## Support & Feedback

- **Questions?** Check `docs/open_questions.md` — may be answered there
- **Found a bug?** Open an issue with reproduction steps
- **Feature idea?** Log it in `docs/open_questions.md` for founder review
- **Developer docs?** See `CLAUDE.md` (AI assistant guidelines) and individual module READMEs

---

**myUNO** — *Operating platform for serviced living.*

Built with Next.js, PostgreSQL, and TypeScript. Deployed to Vercel. Designed for the Ignatev Estate.
