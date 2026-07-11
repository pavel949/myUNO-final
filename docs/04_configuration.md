# 04 · Configuration & Business Rules

**What this document is.** The complete registry of editable business rules. Every commission, fee, cap, markup, SLA, window, and the cancellation policy lives here as a **typed parameter with a default and a scope** — never hardcoded. Builders create these as `ConfigParameter` seed rows (doc 02 §8.2); the founder edits them in the admin panel (doc 08 §6) without code.

**How resolution works.** Reading a parameter always goes through one resolver: `getConfig(key, {unitId?, projectId?})` → unit override → project override → global default. `scopeable_to` says how deep overrides may go. Every edit writes a `ConfigChange` audit row. Parameters marked **⚠ provisional** carry defaults awaiting the founder's confirmation — each is cross-referenced to `open_questions.md`.

**Types** are from doc 02: `percent` (decimal, e.g. `12` = 12%), `money_thb` (satang int, shown as THB in the editor), `schedule` (JSON validated against a named schema), etc.

---

## 1. How the founder edits configuration

The admin panel's **Settings** section (doc 08 §6.4) renders this registry grouped by the `group_key`s below. Each parameter shows: its plain-language description, its current global value, and — where scopeable — a per-project (and per-unit) override table with add/remove. Money fields edit in THB; percent fields as numbers with a `%` suffix; schedules (season calendar, cancellation policies) get purpose-built editors described in §4/§5. Nothing here requires a developer; every change takes effect on the next read (config is cached ≤ 60 seconds).

## 2. Group `booking` — stay rules

| Key | Type | Scope | Default | Meaning |
|---|---|---|---|---|
| `booking.hold_minutes` | int | project | `30` | How long an unpaid `pending_payment` booking blocks the calendar before expiring. |
| `booking.request_hours` | int | project | `24` | Request-to-book: hours the host/ops side has to approve before auto-decline (guest notified). |
| `booking.requests_block_calendar` | boolean | project | `false` | Whether un-answered requests block availability. |
| `booking.min_nights_default` | int | unit | `2` | Default minimum stay for new units (each unit stores its own). |
| `booking.max_advance_days` | int | project | `365` | How far ahead stays can be booked. |
| `booking.same_day_cutoff_hour` | int (0–23) | project | `16` | Latest hour (project timezone) a same-day check-in can be booked. |
| `booking.deposit.mode` | enum `off, preauth` | unit | `off` ⚠ Q6 | Security deposit handling. `preauth` = card pre-authorization via the licensed provider, released after check-out inspection. Funds are never held by myUNO. |
| `booking.deposit.amount_thb` | money_thb | unit | `0` ⚠ Q6 | Pre-auth amount when mode is `preauth`. |
| `booking.checkin_hour` / `booking.checkout_hour` | int | unit | `15` / `11` | Standard times shown everywhere and used by ops scheduling. |
| `owner_stay.charge_cleaning` | boolean | project | `true` ⚠ Q7 | Whether the post-owner-stay turnover clean is charged to the owner's statement. |
| `owner_stay.notice_hours` | int | project | `48` | Minimum notice for an owner to book their own unit (lets ops clear conflicts). |

## 3. Group `engagement` — commissions by engagement type

The economics selector (doc 02 §2.6; money flows doc 10 §4). Per-mandate values on `UnitEngagement` beat these.

| Key | Type | Scope | Default | Meaning |
|---|---|---|---|---|
| `engagement.direct.noi_cap_annual_thb` | money_thb | — | **no default** ⚠ Q14 | The owner's annual NOI cap for direct-managed units: `owner = MIN(NOI, cap)`, `estate = MAX(0, NOI − cap)`. A negotiated term — **must** be entered per unit at mobilization; the statement generator refuses to run without it. |
| `engagement.direct.setup_fee_thb` | money_thb | project | `0` ⚠ Q14 | One-time mobilization/setup fee (0 = not charged). |
| `engagement.via_mc.platform_fee_pct` | percent | project | `12` ⚠ Q14 | myUNO's platform fee on rental revenue of MC-listed units (the "10–15%" of the model; default mid-range). |
| `engagement.via_mc.mc_sees_owner_statement` | boolean | project | `false` | Whether MC staff can view owner statements of their engaged units (doc 03 §4). |
| `engagement.owner_direct.booking_fee_pct` | percent | project | `10` ⚠ Q14 | myUNO's fee on bookings of owner-direct listings. |
| `engagement.seasonal_markup_share_pct` | percent | project | `100` | What share of the season markup revenue is treated as Estate's before the NOI split (v3: "plus a seasonal markup on peak demand"; 100 = markup accrues to Estate, 0 = markup flows into NOI). ⚠ Q14 — confirm intent. |
| `complex.*` | — | — | *reserved* | Group reserved for the complex commercial model — parameters land here when Q2 is decided; nothing reads them in loop one. |

## 4. Group `pricing` — seasons and rates

The season calendar is a `schedule` parameter edited with a dedicated calendar editor; per-unit `PricingRule` rows (doc 02 §3.4) beat it.

| Key | Type | Scope | Default | Meaning |
|---|---|---|---|---|
| `pricing.season.calendar` | schedule | project | `[{season:"peak", from:"12-15", to:"01-15"}, {season:"high", from:"11-01", to:"04-30"}, {season:"low", from:"05-01", to:"10-31"}]` ⚠ Q13 | Month-day ranges → season names; more specific ranges win (peak sits inside high). |
| `pricing.season.markup_pct.high` | percent | project | `25` ⚠ Q13 | Markup over base rate for `high` nights. |
| `pricing.season.markup_pct.peak` | percent | project | `60` ⚠ Q13 | Markup for `peak` nights. |
| `pricing.season.markup_pct.low` | percent | project | `0` | Markup (or discount, negative allowed) for `low` nights. |
| `pricing.los_discount.weekly_pct` | percent | unit | `5` | Length-of-stay discount, ≥ 7 nights. |
| `pricing.los_discount.monthly_pct` | percent | unit | `20` | Length-of-stay discount, ≥ 28 nights (beats weekly). |
| `pricing.cleaning_fee_thb` | money_thb | unit | `0` | Per-stay cleaning fee added to the breakdown (0 = folded into rate). |
| `pricing.guest_service_fee_pct` | percent | project | `0` | Optional guest-facing service fee line (0 = none; kept for parity decisions later). |

Night price resolution (doc 02 §3.4): `PricingRule` → `base_nightly_thb × (1 + season markup)` → `base_nightly_thb`.

## 5. Group `cancellation` — the policies

Named policies are `schedule` parameters: an ordered list of `{days_before_checkin: N, refund_pct: P}` steps — the refund is the first step whose threshold the cancellation moment still satisfies. Snapshotted onto every booking at creation (doc 02 §3.1), so edits never touch existing bookings. Defaults ⚠ Q12:

| Key | Type | Scope | Default schedule |
|---|---|---|---|
| `cancellation.policy.flexible` | schedule | global | `[{days:1, pct:100}, {days:0, pct:0}]` — full refund until 24h before check-in. |
| `cancellation.policy.moderate` | schedule | global | `[{days:5, pct:100}, {days:0, pct:50}]` — full to 5 days out, then 50%. |
| `cancellation.policy.strict` | schedule | global | `[{days:14, pct:50}, {days:0, pct:0}]` — 50% to 14 days out, then none. |
| `cancellation.default_policy` | enum of policy names | unit | `moderate` | Which policy new units get. |
| `cancellation.host_cancel_full_refund` | boolean | global | `true` | Platform/host-side cancellation always refunds 100% regardless of policy. |
| `cancellation.no_show_treated_as` | enum `late_cancel, forfeit` | project | `late_cancel` | No-show refund treatment (late_cancel = the `days:0` step applies). |
| `service.cancel_window_hours` | int | project | `24` ⚠ Q12 | Service orders: full refund until this many hours before the slot; none after. |
| `service.provider_no_show_refund_pct` | percent | global | `100` | Always full refund on provider no-show (also auto-raises a ticket). |
| `service.accept_sla_hours` | int | project | `12` | Hours a provider has to accept a paid order before auto-decline + full refund. |

## 6. Group `services` & `tickets` — marketplace and SLAs

| Key | Type | Scope | Default | Meaning |
|---|---|---|---|---|
| `services.take_rate_pct` | percent | project, per-category via key suffix `services.take_rate_pct.<category_key>` | `15` ⚠ Q14 | myUNO's commission on service orders; category-specific keys beat the general one. |
| `services.advance_notice_hours_default` | int | project | `24` | Default earliest bookable slot for new services. |
| `services.payout_period` | enum `weekly, biweekly, monthly` | global | `weekly` | Provider remittance cadence (doc 10 §5). |
| `tickets.sla_hours.urgent` / `.high` / `.normal` / `.low` | int | project | `4` / `24` / `72` / `168` | Response SLA per priority — sets `sla_due_at`; breach fires escalation (doc 09 §3). |
| `tickets.default_assignee` | enum `unassigned, project_ops_lead` | project | `project_ops_lead` | Auto-assignment target on creation (the project's designated lead staff identity, set in project admin). |
| `tickets.auto_close_resolved_days` | int | global | `7` | Days after `resolved` with no reporter reply before auto-`closed`. |
| `messaging.response_sla_hours` | int | project | `4` | The guest-inquiry response SLA surfaced on ops dashboards (v3 §11 "respond within a response SLA"). |

## 7. Group `finance`, `compliance`, `notify`, `auth`, `i18n`

| Key | Type | Scope | Default | Meaning |
|---|---|---|---|---|
| `finance.statement.day_of_month` | int | global | `5` ⚠ Q17 | Day statements for the previous month are generated as drafts. |
| `finance.statement.requires_admin_signoff` | boolean | global | `true` | Draft → published requires admin action (the v3 sign-off gate). |
| `finance.occupancy_tax_pct` | percent | project | `0` | Occupancy/local tax line if applicable (0 until counsel says otherwise; the breakdown supports it from day one). |
| `compliance.tm30_sla_hours` | int | global | `24` | **The legal deadline.** Editable only to be *stricter*; the editor refuses values > 24. |
| `compliance.tm30_escalation_hours_before` | int | global | `6` | How long before `due_at` an unfiled TM30 escalates to admin. |
| `compliance.passport_required_hours_before_checkin` | int | project | `24` | Pre-arrival passport deadline; unmet → `verification_status=failed` path (Q11). |
| `retention.passport_media_days_after_checkout` | int | global | `30` | Auto-deletion deadline for passport images (doc 12 §6). |
| `notify.channel.email.enabled` | boolean | global | `true` | Master switches for the channel seam (doc 11). |
| `notify.channel.whatsapp.enabled` | boolean | global | `false` ⚠ Q9 | Off until a WABA number exists. |
| `notify.channel.telegram.enabled` | boolean | global | `false` ⚠ Q9 | Off until the bot exists. |
| `auth.token_ttl_minutes.password_reset` / `.email_verify` / `.account_claim` | int | global | `60` / `1440` / `10080` | One-time token validity. |
| `i18n.default_locale` | enum `ru,en,th` | global | `ru` ⚠ Q19 | New-visitor default language. |
| `analytics.buyer_signal.repeat_stay_threshold` | int | global | `2` | Completed stays after which a `repeat_stay` signal fires (doc 13 §4). |
| `analytics.buyer_signal.long_stay_nights` | int | global | `28` | Nights that make a stay a `long_stay` signal. |

## 8. Catalogs — taxonomies as editable data

These are list-shaped configuration: each catalog is a `json` parameter holding an ordered array of `{key, icon}` entries whose **labels live in the content layer** (`catalog.<name>.<key>.label` keys, doc 05), so adding an entry = one config edit + three translations, no code. (The define-once pattern from the legacy audit, moved from code into data.)

| Key | Seeded entries (keys) |
|---|---|
| `catalog.amenities` | `pool, sea_view, gym, parking, wifi, aircon, kitchen, washer, workspace, kids_friendly, pets_allowed, security_24h` |
| `catalog.service_categories` | `transfer, car_hire, cleaning, chef, tours, yacht, flowers, water_delivery, laundry, babysitting, massage_spa, repairs, emergency_medical` |
| `catalog.ticket_categories` | `maintenance, housekeeping, complaint, billing_question, access, noise, common_area, other` |
| `catalog.unit_types` | `villa, condo, townhouse` (mirrors the enum; labels editable) |
| `catalog.cancellation_policies` | `flexible, moderate, strict` (names shown to guests; schedules in §5) |

## 9. Rules that are **not** configuration (on purpose)

Legal non-negotiables are constants, not parameters: the no-fund-holding rule, the FX routing-only rule, permitted-use-before-live gate, PDPA handling, and the 24h TM30 ceiling (only tightenable, §7). Ledger entry types and role names are schema, not config — money and permission vocabulary changes deserve a migration and a human review, not a settings edit.

*Every parameter above must exist as a seed row with exactly these keys — flows (doc 07), money (doc 10), and notifications (doc 11) reference them by key. ⚠ items trace to `open_questions.md` and ship with these defaults until the founder rules.*
