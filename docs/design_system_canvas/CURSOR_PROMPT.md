# Cursor task: bring myUNO into line with the design system

You have the design canvas (`myUNO Design System.html`, 21 boards) and this repository. The canvas is the specification. Where the two disagree, **the canvas wins** — except where this document says otherwise.

Do not do this in one pass. Work through the phases below in order, opening a separate PR per phase. Phase 1 must land before anything else, because every later phase depends on the tokens existing.

---

## Ground rules

1. **No hex codes, font names, or raw px outside the token file.** Every colour is a Tailwind theme token; every type step is a named class; every space value is on the 4-based scale. If you find yourself typing `#0E4F4B`, stop and use `brand-andaman`.
2. **No new components.** The canvas defines about sixty. If a screen needs something not on the canvas, that is a design question, not an implementation decision — leave a `TODO(design):` comment and move on.
3. **Do not redesign anything the canvas does not cover.** Recreate exactly. Restraint is the job.
4. **Every enum reaches the screen through one mapping.** Never render a raw enum value.
5. **Every list, table and detail view ships loading, empty and error together.** A PR that adds a data surface without all three is incomplete.
6. **Server computes, client displays.** Prices, totals, fees, SLA deadlines, hold countdowns — all server-side. The browser formats; it does not calculate.
7. Read `docs/06_design_system.md` before you start. Where doc 06 and the canvas differ, the canvas is newer.

---

## Phase 1 — Tokens and primitives

**Goal: make it impossible to write off-system code.**

- Set the Tailwind theme from canvas board 01. Colours: `brand.andaman #0E4F4B`, `brand.deep #0A3733`, `brand.sun #D69A3A`, `brand.sun-soft #E7C079`, `surface.ivory #F5EFE4`, `surface.paper #FBF8F1`, `text.ink #16211F`, `text.stone #7E8C88`, `text.stone-2 #A7B2AE`, `border.line #E6DFD1`, `border.line-2 #DAD1BF`, `on-dark.text #EAF2F0`. Functional: `success #2F7A57` on `#E4EFE7`, `warning #B97F1F` on `#F6ECD8`, `error #AE4E38` on `#F5E4DF`, `info #0E4F4B` on `#E3ECEA`.
- Chart series, in fixed order, never cycled: `#00937F`, `#D69A3A`, `#C05840`, `#4477CC`. Sequential ramp: `#DCEEEB`, `#9CCFC8`, `#5BA79E`, `#2E7B74`, `#0E4F4B`. Status colours are never series colours.
- Type scale as named classes: `display-xl` Outfit 600 40/44 −1%; `display` Outfit 600 28/34; `title` Outfit 600 20/26; `subtitle` Outfit 500 16/24; `kicker` Outfit 500 12/16 +24% uppercase in sun; `body` Manrope 400 15/23; `body-strong` Manrope 600 15/23; `small` Manrope 400 13/19; `num` Outfit 500 tabular. **Delete `text-xsmall`** — it is referenced in the juristic board and never defined. 13px is the floor.
- Spacing 4/8/12/16/20/24/32/40/56/80. Radius: inputs and chips 8, buttons 12, cards and modals 16, pills and avatars full. Shadows: `card 0 1px 2px rgba(22,33,31,.06)`, `float 0 8px 24px rgba(14,79,75,.16)` — float on modals and popovers only.
- **Remove the Tailwind dark-mode body rule in `globals.css`.** The product ships one light mode. The CRM's dark variant goes with it.
- Motion: 150ms ease-out micro, 250ms ease-in-out structural, skeleton pulse 1.2s, all disabled under `prefers-reduced-motion`. Nothing bounces.

Then rebuild the primitives against those tokens: `Button` (primary/secondary/ghost/destructive/sun, sizes 40/48/56, loading spinner that preserves width, disabled at 50%), `Input`/`Textarea`/`Select` (48px, radius 8, error and hint slots), `Chip`, `StatusChip`, `Badge`, `Avatar` (24/32/40/64), `Counter` (44px targets), `StatTile`, `MoneyAmount`, `SlaCountdown`, `StatusTimeline`, `PriceBreakdown`, `DataTable`, `ConfirmDialog`, `EmptyState`, `Skeleton`, `ErrorState`.

**Two rules that come from the Russian pass (board 21) and must be built into the primitives now, not retrofitted:**

- Buttons size from content plus padding with a `min-width`. Never a fixed width measured off the English label. `Забронировать` is 86% longer than `Reserve`.
- Every label-and-amount pair is a flex row with `flex-shrink: 0` on the figure, so the label wraps and the number never does. Status chips wrap to a new row; they never truncate.

**Done when:** a grep for hex codes outside the theme file returns nothing, and `/design` renders every primitive in every state.

---

## Phase 2 — Shell, menus and roles

- Header per board 03. The menu and the `/app` landing must read the **same server-side role resolver** — they cannot be allowed to drift. Personal links (trips, messages, requests, orders, account) appear for anyone signed in, whatever their roles.
- Add `RoleContextBanner`: a slim info band when a person acts in a secondary role. Specified in doc 06 §3.3, rendered nowhere.
- **Group the admin sidebar.** It is one flat list of twenty destinations. Four named sections: Grow (crm, signals) · Inventory (projects, units, people, bookings, config) · Supply & content (providers, services, announcements, content) · Money & record (ledger, statements, payouts, reconciliation, claims, disputes, audit, integrations).
- Move `/admin/finance/reconciliation` inside the `(admin)` route group. It currently renders with no sidebar.
- Enforce the permission matrix on **board 19** server-side. The UI hides what a person cannot do; the server refuses it. Both read the same table. Note the three that are absolute: owners, providers and MC/juristic may **never** open a guest passport; ops and admin may, and it writes an audit entry with a name and a stated reason.

---

## Phase 3 — Auth

Board 18. Four screens: login, register, verify, reset.

- **Google sign-in, offered first, above the divider.** Link identities by *verified* email: a Google account whose verified address matches an existing identity signs into that identity and inherits its bookings and roles; a new address creates an identity exactly as the email path does; an **unverified** Google address is refused, because that link is the entire mechanism.
- **Password reveal.** A 44px eye toggle inside every password field, revealing in place and re-hiding after 15 seconds. Registration shows strength as four segments.
- Register links to *claim your existing account* — most guests already exist in the database from a booking.
- No social login other than Google.

---

## Phase 4 — Personal account surfaces

These routes are in the sitemap and have no screens. Build them from the canvas patterns:

`/trips` and `/trips/[id]` · `/account` (profile, password, notification preferences, language, connected Google account, data export, delete) · `/tickets` and `/tickets/new` · `/services/orders` and `/services/orders/[orderId]` · `/bookings/[id]/passports` · `/handbook` · `/messages` and `/messages/[threadId]`.

`/account` is the one to get right — it is where a person changes their language, and where PDPA obligations are met.

---

## Phase 5 — The CRM

Board 10 is the specification and carries a change table naming every substitution. This is the largest single piece of drift in the product.

- Ground and surfaces: ivory ground, paper cards, `border.line` hairlines. Delete the dark-mode variant.
- Stage labels: Outfit 600 16px, count as a neutral pill, weighted total beneath the rule. **Remove the emoji prefixes.**
- Pipeline bars: the sequential andaman ramp, dark reads as late stage. Won is success, lost is stone. Not Tailwind blue.
- Opportunity type: a chip from the §3.4 mapping — info for rental, warning for purchase, outline for advisory.
- Money and probability: `MoneyAmount`, Outfit tabular, so columns align down the board.
- Activity types: 20px outline icons at stroke 1.5 in `text.stone`. **Remove the emoji glyphs.**
- Overdue next action: the error token, on the card and again as a chip on the detail header.

---

## Phase 6 — Remaining screens

Public marketing (`/projects`, `/projects/[slug]`, `/trust`, `/trust/ombudsman`, `/about`, the six audience doors) and the eight admin lists that sit in the sidebar with no screen of their own (projects, units, bookings, provider vetting, service submissions, statements, claims, disputes).

Also on the landing: the ground is white and should be ivory, and the trust points use a plain `✓` glyph where the canvas specifies the 48px ring-and-point mark.

---

## Phase 7 — Mobile

Board 20. Eight surfaces were desktop-only. The rules:

- Tables become key-value cards. Never a horizontal scroller for data a person must act on.
- Row actions move inside the card at full width, 48px tall, with the **disabled reason printed underneath** rather than left to a tooltip.
- Typed input opens as a sheet — cash receipt, dispute, order note. A 160px field wedged into a row is how mistakes get typed.
- Kanban becomes a filtered list with the stage as a select. Tabs become a chip scroller.
- One chart, single-letter axis labels, table toggle kept. Six bars is the most that reads at 390.
- The admin sidebar becomes an index leading with what is waiting on a person; empty groups collapse.
- The one primary action pins to a fixed bottom bar when the page scrolls past it.

Ops and owner first — staff work on a phone with one hand.

---

## Phase 8 — Locale

Board 21. Every user-facing string is a content key; **no literal copy in a component**. That is what makes RU and TH a translation pass rather than a rebuild.

- Dates stored UTC, displayed Asia/Bangkok, formatted per locale. Never an ISO string on screen.
- Money is integer satang, suffixed `_satang`, divided once inside `MoneyAmount`. ฿ is kept in every locale — owners bank in baht whatever they read in.
- Never translated: unit codes (B-707), project names, policy codes (flex-7), rule IDs (RS-2026-HI), TM30. A guest reads these aloud to staff.
- The kicker drops its 2.88px tracking below `md` in RU and TH, and line-height goes 16 → 18.
- An untranslated key falls back to EN **and is visibly flagged** — never silently English. No locale ships partially.

---

## Phase 9 — States

Board 19's coverage matrix lists twenty-two missing states, surface by surface. Work down it. Copy differs every time; none of these is a copy-paste.

Beyond the three basics, two states the product currently lacks anywhere: **partial/stale** (search prices out of date, a chart with no history) and **forbidden** (a stay that has ended, a statement belonging to another owner).

---

## Verifying

A change is done when:

- No hex, font name, or raw px outside the theme file.
- No raw enum reaches the DOM.
- Loading, empty and error exist for every data surface.
- Every figure shown to an owner opens to the rows behind it.
- Every destructive confirmation states its consequence **in numbers** before the person commits.
- Unknown renders as absent, not zero. A unit nobody has reviewed shows no rating.
- Keyboard focus is visible on every interactive element; hit targets are 44px minimum on mobile.
- The page renders correctly in EN and RU at 390 and 1280.
