# 05 · Content & Internationalization

**What this document is.** How every word a user reads becomes an editable, three-language **content key** — the model, the founder's editing workflow, and the initial key namespaces builders must use. The storage shape is doc 02 §8.1 (`ContentKey` + `Translation`); the editor is part of the admin panel (doc 08 §6.3).

---

## 1. The rule

**Agents never write user-facing copy inline.** Every string a person can read — button labels, headings, emails, notification texts, error messages, empty states, page sections — is a key like `booking.widget.cta`, resolved at render time to the viewer's locale. A builder who needs a string that doesn't exist creates the key with a **plain, unstyled English draft value marked `needs_review`** in all three locales and lists it in the task's output — the founder polishes wording in the editor; the builder never blocks on copy, and never ships invented brand voice.

What is **content** (keys) vs **data** (rows): platform copy is content; things users type — messages, ticket text, announcements, provider service descriptions, reviews — are data and are shown as written. Project *names* are proper nouns (data); project *descriptions and handbooks* are content keys so the founder can edit and localize them.

## 2. Locales

- **`ru` — Russian.** The clientele's language and the platform default (`i18n.default_locale`, ⚠ Q19).
- **`en` — English.** Complete at launch; the fallback language.
- **`th` — Thai.** Required from day one for staff/provider/juristic surfaces and public trust; may lag editorially (Q19 — who translates).

**Fallback chain per key:** requested locale → `en` → `ru` → the key name rendered in a visible warning style (dev/staging) or the `en` empty-state dash (production) — a missing translation must be *findable*, never silently blank. The user's locale comes from `Identity.preferred_locale`; anonymous visitors get the default with a language switcher in the header (doc 06).

## 3. The key model

- **Key format:** dot-path, lowercase snake segments: `namespace.area.element[.variant]`. Examples: `booking.widget.cta`, `email.booking_confirmed.subject`, `catalog.amenities.pool.label`.
- **Placeholders:** ICU-style named variables — `Ваше бронирование в {project} подтверждено` with `{project}`, `{date}`, `{amount}` etc. The render helper formats dates/money per locale (THB always shown as `฿1,234` regardless of locale). Translations must keep the same placeholder set; the editor validates this on save.
- **Plurals:** ICU plural syntax where counts appear (`{nights, plural, one {...} few {...} many {...} other {...}}`) — Russian needs `few/many`; builders must use plural syntax for any counted noun.
- **Rich text:** keys with `supports_rich=true` (handbook pages, email bodies, legal pages) allow a safe markup subset (bold, links, lists); everything else is plain text.
- **One string, one home:** the same words used in two places are still two keys if they could ever need to differ (a button vs a heading); shared *vocabulary* (e.g. status labels) lives once under `common.*`.

## 4. Initial namespaces

Builders create keys **only inside these namespaces** (new namespaces = an entry in this doc via PR). Per doc 08/07, each screen spec references its exact keys; this is the map:

| Namespace | Covers |
|---|---|
| `common.*` | Shared vocabulary: actions (`common.action.save/cancel/confirm/back`), statuses (`common.status.booking.confirmed` …every enum label from doc 02), roles, dates ("night(s)"), empty/loading/error state texts (`common.state.empty/error/loading.*`). |
| `nav.*` | Navigation: menu items, the project switcher, portfolio, footer links. |
| `landing.*` | The master landing page sections (doc 08 §2). |
| `audience.*` | The audience pages: `audience.owners.*`, `audience.guests.*`, `audience.developers.*`, `audience.buyers.*`, `audience.mc.*`, `audience.providers.*`. |
| `project_page.*` | The per-project public landing template ("{Project} on myUNO"). |
| `trust.*` | Trust pages: how-it-works, verification, the Ombudsman credential (`trust.ombudsman.*` — reserved, ⚠ Q15), dispute handling. |
| `legal.*` | Terms, privacy, PDPA notices, entity/contact details (Q16 facts seeded — see doc 08). |
| `auth.*` | Register, login, verify, reset, claim-account flows. |
| `search.*` | Search & discovery UI (filters, availability, results, map). |
| `listing.*` | Unit/listing detail page (amenities heading, policies block, house rules). |
| `booking.*` | The stay flow end-to-end: widget, review step, payment, confirmation, holds, request-to-book, modification, cancellation dialogs (incl. every unhappy-path message: `booking.error.payment_failed`, `booking.error.dates_taken`, `booking.hold.expired` …). |
| `checkin.*` | Pre-arrival & check-in: passport capture, TM30 notice (`checkin.tm30.explainer` — why we ask), instructions. |
| `services.*` | Marketplace: catalog UI, service card, order flow, provider confirmation states, cancellation/refund dialogs, no-show apology. |
| `tickets.*` | Raise-ticket form, status labels, SLA texts, resolution view. |
| `messages.*` | Inbox, thread UI, read receipts, system-message templates (`messages.system.booking_confirmed` …). |
| `announcements.*` | Composer + display chrome (posted-as labels, audience names). |
| `owner.*` | Owner surfaces: portfolio, unit dashboard, statements (`owner.statement.*` line labels), owner-stay booking, payout history. |
| `provider.*` | Provider portal: onboarding, order queue, remittance reports. |
| `mc.*` | Management-company portal surfaces. |
| `staff.*` | Ops surfaces: mobilization checklist labels, TM30 queue, arrivals board, condition reports. |
| `admin.*` | Admin panel chrome (the editor itself, config groups' display names — yes, the editor is itself keyed). |
| `email.*` | Every email: `email.<type>.subject/preheader/body` per doc 11's catalog. |
| `notify.*` | In-app/WhatsApp/Telegram notification templates per doc 11: `notify.<type>.title/body`. |
| `catalog.*` | Labels for config catalogs (doc 04 §8): `catalog.<name>.<key>.label`. |
| `reviews.*` | Review forms, eligibility notices, reply UI. |
| `payments.*` | Checkout page, mock-checkout notice, receipts, refund status texts. |

## 5. The founder's editing workflow

In **Admin → Content** (doc 08 §6.3): a tree by namespace with search; each key opens a three-column editor (RU / EN / TH side by side) showing the description ("where this appears"), placeholder legend, and status per locale (`ok / needs_review / missing`). Filters: "needs review", "missing in TH", "recently added". Saving validates placeholders and writes the audit row. A **"preview in place"** link opens the screen the key appears on (where the screen is previewable). Bulk export/import as CSV for working with a translator (Q19). Seeding: the build plan's content tasks create all keys of §4 with `needs_review` drafts; the SALA repo's EN/RU/TH strings (legacy audit §3) may seed matching keys — marked `needs_review` like everything else.

## 6. Builder contract

One helper everywhere: `t(key, params?, locale?)` server-side and the equivalent hook client-side; both resolve through the fallback chain and log unknown keys. Hardcoded user-facing literals fail review — doc 16 includes a lint task (`no-literal-ui-text`) enforcing this mechanically. Locale routing: the public site serves `/{locale}/…` paths with `ru` default and correct `hreflang` (doc 08 §8); the app uses the identity's preference.
