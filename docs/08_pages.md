# 08 · Pages & Admin — every public page and the founder's panel

**What this document is.** Every public page (sections, content keys, calls to action), the authenticated app's page map, and the admin panel. Layouts come from doc 06 (screen compositions referenced as S-numbers); flows entered from pages are doc 07 F-IDs. All public copy lives in the namespaces shown — no inline text.

URL scheme: public site under `/{locale}/…` (`ru` default, `hreflang` alternates); the app under `/app/…` (locale from identity). All pages responsive per doc 06; public pages server-rendered for SEO.

---

## 1. Public page map

| Path | Page | Keys | Primary CTA |
|---|---|---|---|
| `/` | Master landing (S1) | `landing.*` | Search stays; audience doors |
| `/projects/{slug}` | Project landing (S2) | `project_page.*` + project content keys | Check availability |
| `/search` | Search results (S3) | `search.*` | Book (F-GUEST-2) |
| `/units/{id}` | Unit detail (S4) | `listing.*` | Book / Request (F-GUEST-3/4) |
| `/owners` | Owners audience page | `audience.owners.*` | "Entrust your unit" → lead form |
| `/guests` | Guests audience page | `audience.guests.*` | Search stays |
| `/developers` | Developers audience page | `audience.developers.*` | "Talk to us" → lead form |
| `/buyers` | Buyers audience page | `audience.buyers.*` | "Start the conversation" → lead form |
| `/management-companies` | MC audience page | `audience.mc.*` | Lead form |
| `/providers` | Providers audience page | `audience.providers.*` | Apply (F-PROV-1) |
| `/trust` | How trust works | `trust.*` | — |
| `/trust/ombudsman` | The credential (⚠ Q15 content) | `trust.ombudsman.*` | — |
| `/legal/terms`, `/legal/privacy` | Legal (Q16 facts below) | `legal.*` | — |
| `/auth/*` | Register/login/reset/claim | `auth.*` | F-AUTH |

## 2. Master landing `/`

Sections in order (S1 composition):
1. **Hero** (`deep` band): `landing.hero.kicker` ("Serviced living in Phuket"), `landing.hero.title`, `landing.hero.subtitle`; the search entry card (project select · dates · guests → `/search`). Tagline anchors: **"Your one place."** (`landing.hero.tagline`).
2. **The one-place promise** — three columns `landing.promise.stay/live/own` (title + body each): stay, live, own.
3. **Audience doors** — six cards (`landing.doors.<audience>.title/body/cta`) linking the audience pages.
4. **Trust, made visible** — `landing.trust.title` + three steps (`landing.trust.verified/handled/protected`) with `VerifiedBadge` iconography; link to `/trust`.
5. **Featured projects** — live projects as `ProjectHeader` cards ("{name} · on myUNO"), from data.
6. **Services taste** — a `ServiceCard` rail + `landing.services.title/body` ("everything around the stay, vetted").
7. **Footer** (`deep`): nav, locale switcher, legal/trust links, entity details (`legal.entity.*` — seeded from the facts below, Q16).

**Entity & contact facts (Q16 — seed values for the `legal.*` content keys; the strings still live in the content layer per doc 05):** operating entity **Ignatev Estate Co., Ltd** · DBD registration **083-5-56602358-7** · registered address **Plaza Del Mar, No.1 Pasak-Koktanod Rd, office 115–116, Cherngtalay, Thalang, Phuket 83110** · director **Pavel Ignatev** · email **pavel@ignatevestate.com** · phone **+66 92 240 7355**. These populate the footer, `/legal/terms`, and `/legal/privacy` (the PDPA controller line, doc 12). *Still pending (Q16):* a dedicated public support/WhatsApp line and privacy mailbox if different from the above; Ignatev Capital's entity details if named publicly; the Ombudsman credential text (Q15).

## 3. Audience pages (one template, six voices)

Template sections: hero (kicker/title/sub), "how it works" numbered steps (3–5), value bullets (from positioning.md's per-audience promises), proof band (trust links; real numbers appear when the operating dataset exists — placeholders never fake data), FAQ accordion, CTA band.
Per audience, the content mirrors the model's §5 value propositions: owners (peace of mind, `MIN(NOI,cap)` explained plainly, dashboard/statement screenshots), guests (hotel-grade + one-stop trust), developers (class uplift, reputation control, the six demo views of v3 §34 as a promise list), buyers (safety, operating data, Capital hand-off), MCs (demand + rails), providers (steady clients, the badge, how orders pay).
Lead forms (owners/developers/buyers/MC): name, contact (phone/WhatsApp/email), project/unit context free-text, consent line → stored as a thread to admin + N-29 alert (no CRM dependency in loop one; HubSpot connects later per D1).

## 4. Per-project landing `/projects/{slug}`

S2 composition: hero (project cover, name, `area_label_key`, the endorsed lockup), availability bar, units grid (live units), project story (`description_key` rich), amenities, services available here, location map, the project handbook teaser (public subset), trust band, FAQ. This page is the future "home space's public face" and the developer-pitch artifact (v3 §34.2).

## 5. The authenticated app (`/app`)

| Path | Surface | Composition |
|---|---|---|
| `/app` | Adaptive landing: role-driven (owner → S7; guest with active stay → S6; staff → S12; provider → S13; mc → their board; multiple hats → the strongest context + `ProjectSwitcher`) | doc 06 §1.3 progressive complexity |
| `/app/trips` | Guest bookings list + detail (pay-pending holds, modify/cancel entries) | F-GUEST-3/8/9 |
| `/app/stay/{bookingId}` | In-stay home space | S6 |
| `/app/portfolio`, `/app/units/{id}` | Owner surfaces | S7/S8 |
| `/app/messages`, `/app/messages/{threadId}` | Inbox/thread | S9 |
| `/app/tickets`, `/app/tickets/{id}` | Tickets | S10 |
| `/app/services`, `/app/services/{id}`, `/app/orders` | Marketplace + orders | S11 |
| `/app/ops/*` | Staff board: arrivals, departures, tm30, tickets, calendar, costs, mobilization | S12 |
| `/app/provider/*` | Provider portal: orders, services, remittances | S13 |
| `/app/mc/*` | MC portal | F-MC-2 |
| `/app/account` | Profile, locale, password, notification preferences | `auth.*`, `notify.*` |

## 6. The admin panel (`/app/admin`) — the founder's cockpit

S14 composition, admin-only (doc 03). Sections:

1. **Dashboard** — platform `StatTile`s (occupancy, revenue MTD, bookings, open tickets, TM30 at-risk count, signals new), recent activity feed.
2. **Projects & Units** — CRUD projects; unit list with status/mobilization progress; unit detail tabs (listing, calendar, pricing, engagement, compliance, condition, ledger). Go-live gate visible as a checklist.
3. **Content** — the three-column RU/EN/TH editor (doc 05 §5): namespace tree, search, status filters, placeholder validation, CSV round-trip.
4. **Configuration** — the registry editor (doc 04 §1): groups, per-project/per-unit override tables, schedule editors (season calendar, cancellation policies), change history per parameter.
5. **People & Roles** — identity search; role grant/revoke with scope pickers; org management (MCs, juristic persons); blocked identities.
6. **Bookings** — all bookings with filters; manual booking creation (agent/phone bookings); request queue oversight.
7. **Services & Providers** — provider vetting queue (F-PROV-1), service approval (`services.require_admin_approval`), order oversight, no-show offender view.
8. **Finance** — ledger browser (filters by unit/type/period), statement queue (draft → publish sign-off, F-FIN-1), payouts recording, reconciliation board (F-FIN-2), refund failures.
9. **Tickets & Announcements** — cross-project ticket board; announcement composer (posted-as myUNO) + org posts oversight.
10. **Signals** — the buyer funnel (F-BUY): signal rows, strength, evidence links, status actions.
11. **Compliance** — TM30 ledger (all filings + escalations), per-unit compliance records, retention job status (passport auto-deletion, doc 12).
12. **Audit log** — the append-only record, filterable by actor/entity.

Every list ships empty/loading/error states; every destructive action uses `ConfirmDialog`; every edit writes audit rows.

## 7. SEO & discoverability

Public pages carry: per-locale meta (`landing.meta.title/description` etc.), OpenGraph images (brand-tokened template), JSON-LD structured data — `Organization` (myUNO), `LodgingBusiness`/`Accommodation` per project/unit page, `Product`+`Offer` on units, `FAQPage` on audience FAQs (templates adapted from the geo-seo-claude parts bin per audit §6), `llms.txt` at root, XML sitemap per locale, canonical + `hreflang` triplets. Suspended/draft entities never render (404).
