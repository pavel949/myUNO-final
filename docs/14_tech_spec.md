# 14 · Technical Specification — the modular monolith

**What this document is.** The concrete technical shape: stack, repository layout, module boundaries and the core interface, how legacy pieces fit, integrations, and the system-of-record map. Decisions justified in doc 01; this is the how.

---

## 1. Stack (locked, doc 01 D2)

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router, RSC) — one app: UI + API |
| Language | TypeScript, `strict` |
| Database | PostgreSQL 16 |
| ORM | Prisma (schema-first; **migration files from day one** — unlike the legacy clone's db-push, because config/content seeds and money tables need reproducible history) |
| Styling | Tailwind, theme generated from doc 06 tokens |
| Auth | NextAuth-pattern JWT-session auth (credentials + optional OAuth), custom claim/verify flows |
| Realtime | SSE + in-process pub/sub bus seams (Redis-swappable, legacy-proven) |
| Jobs | A scheduler process (cron-style: holds expiry, request auto-decline, statements, retention, digests, iCal sync, rollups) — one `jobs/` registry, each job idempotent |
| Storage | S3-compatible object storage behind the media seam |
| Email | Resend-compatible adapter with console fallback |
| Tests | Vitest: unit + API/integration (dedicated test DB) + component (jsdom/RTL) — the legacy clone's proven three-tier setup |

## 2. Repository layout

```
src/
  app/                      # Next.js routes: pages + api route handlers (thin)
    (public)/               # localized public pages (doc 08)
    app/                    # authenticated app surfaces
    app/admin/              # admin panel
    api/                    # route handlers → call module services only
  modules/                  # THE architecture (this doc §3)
    core/                   #   identity, projects, units, roles, permissions
    booking/                #   stays: availability, pricing, lifecycle
    services/               #   providers, services, orders
    finance/                #   payments seam, ledger, statements, payouts, refunds
    compliance/             #   TM30, compliance records, condition reports, retention
    comms/                  #   threads, tickets, announcements, notifications
    content/                #   content keys, translations, t()
    config/                 #   parameters, overrides, getConfig()
    analytics/              #   track(), detectors, rollups
    integrations/           #   ical, payment adapters, messenger adapters, crm
  components/               # design-system components (doc 06)
  lib/                      # cross-cutting: db client, auth, seams (bus, email, media), errors
  jobs/                     # scheduled job registry
prisma/                     # schema + migrations + seeds (config registry, content keys, catalogs)
docs/                       # this suite
```

## 3. Module boundaries — the three rules, enforced

Each module exposes **one public interface** (`modules/<name>/index.ts` — typed service functions); everything else in the module is private. The constitution's rules, mechanically:

1. **A module never owns the customer.** Only `core` writes `Identity`/`RoleAssignment`. Other modules reference identities by id and ask `core` (e.g. `core.ensureIdentityForChannelGuest()` used by OTA import).
2. **Modules connect only through the core** (and the shared seams in `lib/`). `booking` never imports from `services`; when a service order relates to a booking it holds the id and asks `booking`'s interface. Enforced by an ESLint boundary rule (`import` paths across `modules/*` allowed only from another module's `index.ts`, with a dependency whitelist: everything may depend on `core`, `config`, `content`; `finance` may be called by `booking`/`services`; `comms`/`analytics` are called by anyone but call only `core`).
3. **Common → core; specific → module.** Scope checks, money helpers, the `Safe*` serialization live centrally; a stay's hold logic lives in `booking` alone.

**The core interface (illustrative signatures builders extend, not reinvent):**
```ts
core.can(identityId, action, resource): Promise<boolean>          // doc 03 §5
core.getIdentity / ensureIdentity / mergeIdentities
core.grantRole / revokeRole / rolesOf(identityId)
core.projects.get/list; core.units.get/listByProject               // read models
config.get(key, {unitId?, projectId?})                             // doc 04 resolver
content.t(key, params, locale)                                     // doc 05 helper
comms.notify(typeKey, identityId, params)                          // doc 11 fan-out
comms.systemMessage(threadContext, key, params)
finance.createCheckout / confirmBySession / refund / preauth      // doc 10 seam
finance.ledger.record(entry)                                       // append-only
analytics.track(eventKey, dims)                                    // doc 13
```

**Server/client split** (legacy-proven): reads via server components calling module read functions directly; writes via route handlers → module services; every boundary crossing returns `Safe*` serialized types (dates → ISO strings, 🔒 fields stripped centrally).

## 4. System-of-record map (v3 §20, made concrete)

| Truth | Owner module | External copies (channels, never sources) |
|---|---|---|
| People & roles | `core` | CRM (HubSpot) gets lead copies |
| Projects & units | `core` | OTA listings mirror unit data |
| Calendar & bookings | `booking` | OTA calendars via iCal export; imports become records here |
| Services & orders | `services` | — |
| Money (payments, ledger, statements) | `finance` | Provider settlement reports reconcile against it |
| Compliance (TM30, permits, condition) | `compliance` | Government portal receipts stored back here |
| Conversations, tickets, announcements | `comms` | Messenger deliveries are copies |
| Words | `content` | — |
| Rules | `config` | — |
| Behavior & signals | `analytics` | — |

## 5. Integrations (all behind `IntegrationAccount` registries, doc 02 §10.3)

| Integration | Loop-one shape |
|---|---|
| **Payment provider** (⚠ Q8) | One adapter implementing the finance seam; `mock` adapter ships first; webhook endpoint signature-verified |
| **OTA calendars** | Per-unit iCal: export URL (our bookings+blocks) + import poller (job, 15-min) creating `BlockedDate(reason=ota_import)` or external bookings; conflict → N-25 (doc 01 D8) |
| **WhatsApp Business / Telegram bot** (⚠ Q9) | `deliver()` channel adapters, config-disabled until provisioned |
| **Resend (email)** | Adapter + console fallback |
| **HubSpot CRM** | Outbound lead push (audience forms) — phase 2, seam reserved |
| **Licensed FX partner** | **Information/routing only** — a content block, never an API that moves money |
| **TM30 portal** | No integration (Q10): deep link + receipt upload |

## 6. Cross-cutting standards

Errors: typed domain errors → unified handler → correct HTTP codes + content-keyed user messages; never leak internals. Validation: zod schemas at every route boundary. Idempotency: payment confirm, webhook, iCal import, job runs. Time: UTC storage, project-timezone display; nights are dates, not instants. Money: satang ints; one `Money` helper for formatting/rounding. IDs: UUIDv7. Logging: structured, PII-scrubbed. Rate limiting: auth + public form endpoints. Feature flags: config parameters (`feature.*`) — no separate system.

## 7. Legacy fit (from doc 00, operationally)

Builders may **read** the sibling legacy repos for the patterns doc 00 marks "take" (hold expiry, overlap math, payment confirm idempotency, SSE bus, notification catalog shape, upload guard) and must re-implement in `modules/*` idiomatically — **never import or copy files wholesale**, never inherit legacy schema or visuals. condo remains reference reading for RBAC/ticket/split design; SALA for feed UX and TH strings.

## 8. Testing contract

Every module ships: unit tests for pure logic (pricing, refund math, cap split, policy resolution, detectors); integration tests over route handlers with mocked auth + test DB (booking races, webhook idempotency, permission matrix table-driven from doc 03, config resolution order); component tests for design-system primitives. CI runs all three + typecheck + the boundary lint + the `no-literal-ui-text` lint (doc 05 §6). The doc-16 tasks each name their required tests — a task without green tests is not done.
