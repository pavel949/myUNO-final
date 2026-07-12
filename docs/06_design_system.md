# 06 · Design System — the one look

**What this document is.** The brand (`docs/brand/`) expanded into a complete design system: tokens, a component library with every state, UX principles, and screen-level compositions. **Agents build UI only from this system** — no invented colors, type, spacing, or components. The Tailwind theme is generated from §2's tokens, so out-of-system values are physically unavailable.

Personality to preserve in every screen: *warm but trustworthy, personal but institutional, simple but premium. Calm confidence. Never loud, never tropical-kitsch, never a cheap startup look.*

---

## 1. UX principles (the constitution's five, made operational)

1. **Mobile-first.** Every screen is designed at 390px first and enhanced upward (breakpoints §2.6). Owners check from phones in Moscow; guests live on phones in villas. Desktop is the enhancement, not the target.
2. **Trust made visible.** Verification, the condition record, SLA countdowns, statement math, and "handled by" attribution are *surfaced*, not buried: the `VerifiedBadge`, `TrustFooter`, `StatusTimeline`, and money-breakdown components exist to show the machinery working. Never a black box.
3. **Progressive complexity.** The single-unit owner sees no switcher, no portfolio, no clutter; complexity appears only when the person's roles demand it (v3 §23's adaptive landing). Components render *down* gracefully: one project = no tabs.
4. **A feed, not a form.** Living surfaces (project space, activity, inbox) lead with a live, chronological stream and act in-place. Forms appear at the moment of commitment, never as the front door.
5. **Friction scaled to stakes.** Low stakes = zero ceremony (one tap, optimistic UI). High stakes (paying, cancelling, granting access) = deliberate steps, explicit confirmation with consequences stated (`ConfirmDialog` with the "what happens" list). Match safeguards to what is at risk — in both directions.

## 2. Tokens

Builders reference tokens by name; raw hex values appear **only** in the token file.

### 2.1 Color

| Token | Value | Use |
|---|---|---|
| `brand.andaman` | `#0E4F4B` | Primary: buttons, links, active states, the wordmark. |
| `brand.deep` | `#0A3733` | Dark surfaces: footer, hero blocks, dark cards, the admin sidebar. |
| `brand.sun` | `#D69A3A` | The accent: the mark's center point, highlights, primary CTAs on dark, star ratings. Use sparingly — gold is precious. |
| `brand.sun-soft` | `#E7C079` | Sun's tint for hovers/soft highlights on dark. |
| `surface.ivory` | `#F5EFE4` | The page background (light). |
| `surface.paper` | `#FBF8F1` | Cards and raised surfaces on ivory. |
| `text.ink` | `#16211F` | Primary text. |
| `text.stone` | `#7E8C88` | Secondary/muted text. |
| `text.stone-2` | `#A7B2AE` | Tertiary, placeholders, disabled text. |
| `border.line` | `#E6DFD1` | Default hairlines/card borders. |
| `border.line-2` | `#DAD1BF` | Stronger dividers, section rules. |
| `on-dark.text` | `#EAF2F0` | Primary text on `deep`. |
| `on-dark.muted` | `#7FA39D` | Muted text on `deep`. |

**Functional states** (expanded from the brand — "functional states tuned to the palette": muted, warm, never neon):

| Token | Value | Use |
|---|---|---|
| `state.success` | `#2F7A57` (+ `state.success-soft` `#E4EFE7` bg) | Confirmations, paid, filed, resolved. |
| `state.warning` | `#B97F1F` (+ `state.warning-soft` `#F6ECD8` bg) | Holds expiring, SLA approaching, needs-review. |
| `state.error` | `#AE4E38` (+ `state.error-soft` `#F5E4DF` bg) | Failures, breaches, destructive actions. A terracotta red — urgent without alarm-panel harshness. |
| `state.info` | `brand.andaman` (+ `state.info-soft` `#E3ECEA` bg) | Neutral notices. |

Rules: text on ivory/paper uses ink/stone only; `brand.sun` is never body-text color (contrast); every `*-soft` background pairs with its full-strength foreground; all pairings above meet WCAG AA at their intended sizes.

### 2.2 Typography

Display **Outfit**, body **Manrope** (self-hosted, `font-display: swap`; both cover Cyrillic — Thai renders via `Noto Sans Thai` fallback, declared in the font stack).

| Token | Spec | Use |
|---|---|---|
| `type.display-xl` | Outfit 600, 40/44, −1% | Page heroes (public pages). |
| `type.display` | Outfit 600, 28/34 | Screen titles. |
| `type.title` | Outfit 600, 20/26 | Card/section titles. |
| `type.subtitle` | Outfit 500, 16/24 | Sub-headers, emphasized rows. |
| `type.kicker` | Outfit 500, 12/16, +24% tracking, uppercase, usually `brand.sun` | Section labels (the brand's kicker style). |
| `type.body` | Manrope 400, 15/23 | Default text. |
| `type.body-strong` | Manrope 600, 15/23 | Inline emphasis, values. |
| `type.small` | Manrope 400, 13/19 | Captions, meta, timestamps. |
| `type.num` | Outfit 500, tabular-nums | Money, dates, counters — anywhere digits align. |

### 2.3 Spacing, radius, elevation, motion

- **Spacing scale:** 4-based — `4, 8, 12, 16, 20, 24, 32, 40, 56, 80`. Screen gutter: 16 (mobile) / 24 (desktop). Card padding: 16–24.
- **Radius:** `r.sm 8` (inputs, chips), `r.md 12` (buttons), `r.lg 16` (cards, modals — the brand's card radius), `r.full` (pills, avatars, the mark).
- **Elevation:** flat-by-default. `shadow.card` `0 1px 2px rgba(22,33,31,.06)` + 1px `border.line`; `shadow.float` `0 8px 24px rgba(14,79,75,.16)` for modals/popovers only. Depth comes from warm borders, not heavy shadows.
- **Motion:** 150ms ease-out micro (hover, press), 250ms ease-in-out structural (modals, drawers, accordion). Skeletons pulse at 1.2s. Nothing bounces; calm confidence.
- **Iconography:** one outline icon set (Lucide), 1.5px stroke, 20px default, `text.stone` at rest / `brand.andaman` active. The ring-and-point mark is reserved for brand moments (logo, favicon, loading) — never used as a generic icon.

### 2.4 The wordmark & mark in product

Header logo: the `my`+`UNO`+ring lockup per brand rules ("my" Outfit 300 andaman at 62% opacity; "UN" Outfit 600 andaman; the O is the ring-mark SVG with gold center). On `deep`, the on-dark variant. Project co-branding follows "endorsed, not absorbed": project name leads in `type.title`, `on myUNO` lockup trails in `type.small` (the brand's lockup row).

### 2.5 Theming

Loop one ships **light only** (ivory). Tokens are CSS variables so a dark theme can land later without component changes. The admin panel uses the same tokens with a `deep` sidebar.

### 2.6 Breakpoints & layout

`sm 640 · md 768 · lg 1024 · xl 1280`; content max-width 1080px (the brand board's measure). App screens: single column to `md`, then sidebar-plus-content (240px nav rail). Public pages: centered column with full-bleed `deep`/image bands.

## 3. Component library

Every component ships with **all** its states: default, hover/press, focus-visible (2px `brand.andaman` offset ring), disabled, loading, error — plus **empty, loading, and error patterns** for every data surface. States are not optional extras; a component PR without them fails review.

### 3.1 Primitives

| Component | Spec |
|---|---|
| `Button` | Variants: `primary` (andaman fill, ivory text), `secondary` (paper fill, line border, ink text), `ghost` (text-only andaman), `destructive` (error fill), `sun` (gold fill, deep text — dark surfaces/hero CTAs only). Sizes 40/48px; full-width default on mobile. Loading = inline spinner replacing label, width preserved. |
| `Input`, `Textarea` | Paper bg, line border, `r.sm`; focus border andaman; error border + `FieldError` line below (`state.error`, `type.small`). Label above (`type.small`, stone); required marker; disabled = stone-2 text. |
| `Select`, `Combobox` | Same chrome; popover uses `shadow.float`. |
| `Checkbox`, `Radio`, `Switch` | Andaman checked states; 44px touch targets. |
| `Chip` | Pill `r.full`; filter chips (selectable, andaman when active — SALA's proven scroll-row pattern) and status chips (soft-bg + strong-fg per `state.*` or booking/order status mapping §3.4). |
| `Avatar` | `r.full`, initials fallback on `line` bg; sizes 24/32/40/64. |
| `Badge` / `VerifiedBadge` | VerifiedBadge = ring-mark micro-icon + label ("Verified owner", "Vetted provider", keys `common.badge.*`) in success colors — **the** trust signal, used consistently and only when the underlying record exists. |
| `Counter` | − value + steppers (guests, quantity); 44px targets. |
| `Calendar` / `DateRangePicker` | Month grid; unavailable dates struck in stone-2, selected range andaman, check-in/out endpoints filled; legend row. Mobile: full-screen sheet. |
| `MoneyAmount` | `type.num`, `฿` prefix, thousands-spaced; negative in `state.error`; always satang-rounded per doc 02 money rules. |
| `Modal` / `Sheet` / `Drawer` | Modal (desktop) becomes bottom-sheet (mobile) automatically; `r.lg` top corners; scrim `rgba(10,55,51,.5)`. One global manager (legacy clone's proven pattern). |
| `ConfirmDialog` | Title, consequence list ("what happens" bullets), optional typed-confirmation for irreversible acts; destructive button right. |
| `Toast` | Bottom (mobile)/top-right (desktop); success/info/error; 4s auto-dismiss, action slot. |
| `Tabs`, `Accordion`, `Tooltip`, `Popover`, `Pagination`, `Breadcrumbs` | Standard, tokened. |
| `SkeletonBlock` | Line/card/avatar shapes on `line` at 60% opacity, 1.2s pulse. |

### 3.2 Data & state surfaces

| Component | Spec |
|---|---|
| `EmptyState` | Centered: muted ring-mark illustration (the mark, stone, 48px), `type.subtitle` heading, one-line body, optional CTA. Every list/table/feed uses it with its own `common.state.empty.*`/feature key — no blank screens, ever. |
| `ErrorState` | Same layout, `state.error` icon, retry button, support link. Global error boundary + per-surface. |
| `LoadingState` | Skeleton compositions per surface (card grid, table rows, thread). Full-screen loads: centered pulsing ring-mark. |
| `DataTable` | Paper card, line row rules, sortable headers, sticky header ≥ `md`; mobile collapses to key-value cards. |
| `StatTile` | Kicker label + `type.display` number (`type.num`) + delta chip. Dashboard currency. |
| `StatusTimeline` | Vertical event list (dot + line + timestamp + text) for booking/ticket/order histories — trust made visible. |
| `FeedList` | Reverse-chronological cards with real-time insert animation (150ms fade-slide), unread markers, date separators. Used by inbox, activity, notifications. |
| `PriceBreakdown` | Line items + rule attributions ("3 nights × ฿4,500 · high season") + total row; expandable detail. Always shows the same server-computed numbers everywhere. |
| `SlaCountdown` | Live countdown chip; > buffer `info`, inside warning window `warning`, breached `error`. TM30 and ticket surfaces. |

### 3.3 Domain components

| Component | Spec |
|---|---|
| `UnitCard` | Cover 4:3 (`r.lg` top), project + `on myUNO` line, unit name (`type.title`), beds/guests meta row, nightly `MoneyAmount`, rating star (sun) — grid 1-col mobile / 2 `md` / 3 `lg`. |
| `ProjectHeader` | Cover band, project name, area kicker, amenity chips, the co-brand lockup. |
| `BookingWidget` | Sticky card (mobile: fixed bottom bar expanding to sheet): date range, guests counter, `PriceBreakdown`, policy line + link, CTA. All states: available / dates-conflict / below-min-nights / hold-expiring banner. |
| `ServiceCard` | Image, provider + `VerifiedBadge`, price-from, duration chip, category chip. |
| `OrderSlotPicker` | Date + time-slot grid honoring `advance_notice_hours`. |
| `ThreadView` | Bubbles (own = andaman-tinted paper right, other = paper left), sender caption, day separators, read receipt ("Seen" `type.small` stone), photo attachments grid, `system` messages centered in stone. Composer: input + photo attach + send. |
| `TicketCard` | Category icon, title, status chip, SLA countdown, assignee avatar, unit/project meta. |
| `AnnouncementCard` | Posted-as identity (org name + "official" badge), title, body, pinned marker, read state. |
| `StatementView` | Period header, revenue/costs/NOI sections as `DataTable`, split math callout ("Your share = MIN(NOI, cap)…" rendered with real numbers), PDF download, status chip. |
| `ConditionReportViewer` | Photo grid with captions + before/after pairing for check-in/out. |
| `ProjectSwitcher` | Header menu (only when >1 project): "All projects" (portfolio) + project rows with role captions. |
| `RoleContextBanner` | Slim banner when acting in a secondary role ("You're viewing as owner of B-707") — how composed roles stay legible. |
| `NotificationBell` | Badge count, dropdown `FeedList`, per-type icons, live via SSE. |
| `PassportCapture` | Camera/file capture per party member, encrypted-upload notice (`checkin.tm30.explainer`), per-guest done states. |
| `MapView` | Single-pin and multi-pin (Leaflet, OSM tiles); pins = ring-mark in andaman. |

### 3.4 Status → color mapping (single source)

`confirmed/paid/filed/resolved/active → success` · `pending_payment/requested/vetting/in_progress/needs_review → warning` · `cancelled/declined/failed/expired/breached → error` · `draft/completed/closed/not_required → neutral (stone)` · `checked_in/accepted/published → info`. Builders never choose status colors ad hoc.

## 4. Screen compositions

Field-level detail lives in doc 07 (flows) and doc 08 (pages); these are the layout skeletons every implementation follows. All are mobile-first; desktop notes in parentheses.

**S1 · Public: master landing** — `deep` hero band: wordmark, `landing.hero.title` (`display-xl`, on-dark), search entry card (project/dates/guests) floating over the fold; then audience door cards (grid2), how-trust-works band (three `VerifiedBadge`-anchored steps), featured projects (`ProjectHeader` cards), footer on `deep` with legal/trust links.

**S2 · Public: project landing** — `ProjectHeader` hero; sticky availability bar (dates/guests → search within project); unit grid (`UnitCard`); project story (`project_page.*` rich content); amenities; map; trust band; FAQ accordion.

**S3 · Search results** — top filter bar (chips: dates, guests, project, type, price — sheet editors); results grid ⇄ map toggle (`MapView` with "search this area"); `EmptyState` with filter-loosening CTA; infinite scroll with skeleton page-two.

**S4 · Unit detail** — gallery (swipe carousel + thumbnails ≥ `md`); title row (unit name, project lockup, rating, `VerifiedBadge`); meta chips; description; amenities grid; `Calendar` availability; reviews (average + list); house rules + policies block (policy name + human schedule from config); host/ops contact row (`MessageHostButton`); map; sticky `BookingWidget`.

**S5 · Booking review & pay** — steps: dates/party recap card → `PriceBreakdown` → policy consent line → contact/verification note → pay CTA (provider checkout redirect or mock page); unhappy states inline (payment failed banner + retry, hold countdown chip).

**S6 · The home space (in-stay guest)** — the digital front desk: header = project brand + stay dates; hero card = *your stay* (unit, dates, check-in state, door/arrival info CTA); quick actions row (message host, order service, raise issue, extend stay); services rail (`ServiceCard` scroll); announcements; handbook link; active orders list with status chips.

**S7 · Owner: adaptive landing** — one unit: unit dashboard directly — occupancy `StatTile`s (this month nights, revenue-to-date, next arrival), bookings list, latest statement card, tickets on my unit, "book my stay" action. Multi: portfolio home — combined `StatTile`s, per-unit rows (occupancy sparkline, status), alerts feed, `ProjectSwitcher` prominent.

**S8 · Owner: statement detail** — `StatementView` full page; "question this statement" → thread creation pre-linked to the statement.

**S9 · Messages** — inbox `FeedList` (avatar, context caption e.g. "B-707 · stay Jan 4–12", unread badge, last message preview) → `ThreadView` full-screen (mobile) / split-pane (`lg`).

**S10 · Tickets** — list with status filter chips; raise flow (category grid → title/description/photos → unit/project confirm); detail = `TicketCard` header + `StatusTimeline` + thread. Reporter sees the same timeline staff see (transparency).

**S11 · Services marketplace** — category chip row; `ServiceCard` grid; service detail (gallery, provider card + badge, price model explainer, `OrderSlotPicker`, order CTA → pay); my-orders list.

**S12 · Staff ops board** — today columns: arrivals (check-in cards with verification state), departures (inspection cards), **TM30 queue** (`SlaCountdown` sorted, file/record-receipt actions), open tickets by SLA; mobilization checklists per unit.

**S13 · Provider portal** — order queue (accept/decline with countdown), calendar of accepted slots, services editor, remittance report table.

**S14 · Admin panel** — `deep` sidebar nav: Dashboard · Projects & Units · Bookings · Services & Providers · People & Roles · Finance (ledger, statements, payouts) · Tickets · Announcements · **Content** (the three-column editor, doc 05 §5) · **Configuration** (grouped registry editor, doc 04 §1) · Signals (buyer funnel) · Audit log. Content area: paper on ivory, `DataTable`-heavy, every list with its empty/loading/error states.

## 5. Accessibility & quality bar

AA contrast throughout (§2.1 pairings are pre-checked); focus-visible on everything interactive; 44px minimum touch targets; full keyboard paths for desktop; `lang` attributes per locale (mixed-script correctness for RU/TH); reduced-motion respected (skeletons static, transitions off); form errors announced (`aria-live`). Screens ship only with their empty/loading/error states implemented — the definition of done in every doc-16 UI task.
