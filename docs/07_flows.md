# 07 · Flows & Onboarding — every journey, screen by screen

**What this document is.** Every flow in the first loop, screen by screen and field by field. Each screen names its **design-system components** (doc 06), its **content-key namespace** (doc 05 §4 — every visible string on a screen belongs to the namespace given; builders create the specific keys inside it), the **configuration** it reads (doc 04), and the data it touches (doc 02). **Every flow includes its unhappy paths.** Coverage is checked against `docs/business/user_journey_audit.md` in §12.

Flow IDs are stable references used by docs 08–16. Notation: `→` screen transition; `⚠` unhappy path; `[cfg]` config read; `[keys]` content namespace.

---

## 1. Identity & access (F-AUTH)

### F-AUTH-1 · Register
`[keys] auth.*` · Modal/page: first name, last name, email, password, locale selector (defaults `[cfg] i18n.default_locale`), consent checkbox linking `legal.privacy`. Submit → creates `Identity`, sends verify email (doc 11 N-01), signs in, shows `VerifyEmailBanner` until verified.
⚠ Email exists → inline `FieldError` with sign-in + reset links. ⚠ Weak password → inline rule list.

### F-AUTH-2 · Login / F-AUTH-3 · Password reset
Standard credential login (+OAuth buttons when configured). Reset: request form (always success-toned response — never leaks existence), emailed single-use link (`OneTimeToken`, `[cfg] auth.token_ttl_minutes.password_reset`) → new-password screen → all sessions invalidated except current.
⚠ Expired/used token → `ErrorState` with re-request CTA.

### F-AUTH-4 · Account claim (channel-created identities)
Staff/OTA import creates `Identity(status=invited)`. Claim link (email/WhatsApp) → screen shows what exists ("your stay at {project}") → set password → `status=active`, roles already attached.
⚠ Link expired → re-send from the same screen (rate-limited).

## 2. Guest journey (F-GUEST)

### F-GUEST-1 · Discover & search
`[keys] search.*` · Screens S1/S3 (doc 06 §4). Entry from landing search card or nav. **Fields:** project (optional select of live projects), date range (`DateRangePicker`), guests (`Counter` adults/children). Filter sheet adds: unit type chips, bedrooms min, price range, amenity chips (`[cfg] catalog.amenities`). Results = `UnitCard` grid ⇄ `MapView` toggle; sort select (price/rating/newest). Availability excludes overlapping bookings/blocks server-side (doc 02 §3.1 rule).
⚠ No results → `EmptyState` with loosen-filters CTA (clears price/amenities first). ⚠ Dates invalid (past, > `[cfg] booking.max_advance_days`) → inline correction.

### F-GUEST-2 · View unit & start booking
Screen S4. `BookingWidget` recomputes `PriceBreakdown` on every change via the pricing endpoint (rules: doc 02 §3.4 resolution, `[cfg] pricing.*`); party validated ≤ `max_guests`; nights ≥ `min_nights` (rule/unit). Policy line shows the unit's cancellation policy name + human schedule. CTA: **Instant Book** (`instant_book=true`) or **Request to book**.
⚠ Selected dates conflict (someone booked meanwhile) → widget error state + calendar refresh.

### F-GUEST-3 · Book & pay (instant)
`[keys] booking.*, payments.*` · Screen S5. Requires auth (inline register/login without losing state). Review screen fields: dates/party recap, breakdown, `guest_note` textarea, **payment method** (from `[cfg] booking.payment.methods_enabled` — cash-only in loop one, so this collapses to a single "Reserve · pay in cash" choice), policy consent check.

**Cash path** (`cash`, the loop-one default and primary rail for RU clients, Q8) → server creates `Booking(status=pending_payment, hold_expires_at=null)` — the reservation **blocks the dates but has no card-hold expiry**; the guest pays in person (on arrival or by agreement). A staff/host records the money via **F-OPS-6**, creating `Payment(method=cash, status=succeeded, received_by, received_at, receipt_ref)` and flipping the booking to `confirmed` (ledger revenue entry, N-02/N-03, system message into the stay thread). Check-in is gated on cash collected when `[cfg] booking.cash_due_blocks_checkin=true`.

**Card path** (`card_provider`, when the provider is switched on) → server creates `Booking(status=pending_payment, hold_expires_at=now+[cfg] booking.hold_minutes)`, `Payment(purpose=stay, method=card_provider)`, redirects to provider checkout (or mock page). Success URL / webhook → idempotent confirm → `status=confirmed`, ledger entry, N-02/N-03, system message.

⚠ **Cash never collected** (guest no-show / doesn't pay) → staff cancel the reservation from the ops board (reason `no_show`), dates freed — no auto-expiry for cash. ⚠ **Card payment fails/abandoned** → booking stays `pending_payment`; trips page shows hold countdown + "complete payment" CTA; expiry → `expired`, dates free, N-04. ⚠ Dates taken between review and reserve → 409 screen with re-search CTA, nothing charged. ⚠ Deposit pre-auth declined (`[cfg] booking.deposit.mode=preauth`) → treated as payment failure with specific message.

### F-GUEST-4 · Request to book (non-instant)
Same review screen; CTA creates `Booking(status=requested, requested_expires_at=now+[cfg] booking.request_hours)` — **no payment yet**. Host/ops respond (F-OPS-5). Approve → `pending_payment` + notification N-05 with pay link (hold clock starts); decline or timeout → `declined` + N-06 (auto-decline by the scheduler).
⚠ Guest tries to pay after expiry → expired state screen, re-request CTA.

### F-GUEST-5 · Pre-arrival & verification
`[keys] checkin.*` · Triggered at confirmation + reminder (N-07, `[cfg] compliance.passport_required_hours_before_checkin`). Home-space card "Prepare your arrival": `PassportCapture` per party member (full name, nationality, passport number, DOB, passport photo → `BookingGuest` 🔒), arrival time select, transfer upsell rail (services). Completion → `verification_status=passports_received`.
⚠ **Verification fails** (not provided by deadline) → `verification_status=failed`: self-check-in instructions withheld, ops alerted (N-08), host contacts guest; check-in proceeds only after capture (staff can capture at door).

### F-GUEST-6 · Check-in (with F-OPS-2 TM30)
Staff confirm arrival on the ops board (or self-check-in when the unit supports it and verification is complete): sets `checked_in_at`, creates check-in `ConditionReport`, spawns `Tm30Filing` rows (due +24h), home space flips to in-stay mode (S6).

### F-GUEST-7 · In-stay
Home space S6: message host (F-COM-1), order services (F-SVC-2), raise issue (F-COM-3), see announcements, handbook. **Extend stay:** date extension via F-GUEST-9 (modification) — availability-checked, priced as a new breakdown for added nights, paid as `stay_balance`.

### F-GUEST-8 · Cancel stay
Trips → booking detail → "Cancel booking" → `ConfirmDialog` shows **the refund math live**: policy schedule, days-to-check-in, computed refund (`cancellation_policy_snapshot`). Confirm → `status=cancelled`, `Refund(reason=cancellation)` issued via provider, dates freed, N-09 both sides, ledger reversal.
⚠ Refund provider-side failure → refund `status=failed`, admin alerted (N-10), guest sees "refund processing" with support link — money state never silently wrong.

### F-GUEST-9 · Modify stay (dates/party)
Booking detail → "Change dates": new `DateRangePicker` (availability excludes own booking), party counters. Server re-validates + reprices; delta shown before confirm. Increase → `balance_due_thb` + checkout for difference (unpaid balance blocks check-in past `[cfg]` grace); decrease → `refund_accrued_thb` + auto-refund. Writes `BookingChange`, notifies ops (N-11).
⚠ New dates unavailable → inline conflict calendar. ⚠ Balance payment fails → change **not applied** (change applies only on payment success — atomic).

### F-GUEST-10 · Check-out, review, re-engage
Departure day: checkout instructions card + N-12. Staff inspection → check-out `ConditionReport`; deposit pre-auth released (or claim flow F-DIS-1). Review prompt N-13 → `Review(target=stay)` 1–5 + comment (eligibility: completed stay, one per stay). Re-engage: N-14 (post-stay thank-you + direct-booking nudge) and the guest's home-space access persists (role remains) — the identity is the relationship.

## 3. Owner journey (F-OWN)

### F-OWN-1 · Owner onboarding & mobilization (= listing creation)
`[keys] staff.*, owner.*` · Actor: admin/staff with the owner. Sequence (mirrors v3 Process A; checklist = `MobilizationChecklistItem`):
1. **Qualify** — staff create `Project` (if new, admin) + `Unit(status=draft)` + owner `Identity(status=invited)`; checklist `qualify` done.
2. **Mandate** — record `UnitEngagement` (type, `noi_cap_annual_thb` for direct — **required field, no default**, Q14; fee overrides; mandate PDF upload). Gate: no further steps until `active`.
3. **Legal audit** — `ComplianceRecord(permitted_use)` + title docs; gate for go-live.
4. **Condition survey** — baseline `ConditionReport` + asset notes.
5. **Standards uplift** — checklist item with notes/photos (human process, recorded).
6. **Pricing setup** — `base_nightly_thb`, `min_nights`, cleaning fee, policy choice, `PricingRule`s; photos, `description_key` content, amenities.
7. **Go-live** — checklist complete + permitted-use confirmed → `status=live`; owner gets claim invite (F-AUTH-4) + `owner` role; N-15 welcome.
⚠ Legal audit fails → unit stays `mobilizing` with blocked item + reason; owner informed by staff (recorded in thread).

### F-OWN-2 · Owner dashboard (remote-owner transparency)
Screen S7 (adaptive). Single-unit: occupancy/revenue `StatTile`s, bookings list (guest first-name + country only), upcoming arrivals, latest statement, open tickets **with status** — everything read-only, everything visible. Portfolio (multi-unit/project): combined tiles, per-unit rows, `ProjectSwitcher`.

### F-OWN-3 · Statements & payouts
N-16 on publish → statement list → `StatementView` (S8): revenue lines (each booking), cost lines (each ledger entry with description/photo link), NOI, split math with the cap shown, payout record when executed. "Question this statement" → thread linked to statement (F-COM-1).

### F-OWN-4 · Owner raises ticket / books service for own unit
Ticket: F-COM-3 with role=owner, unit preselected from their units. Service order: F-SVC-2 (e.g. repair, deep clean) — cost, if charged to the unit, appears as a ledger entry on the next statement (take-rate applies per config).

### F-OWN-5 · Decide to sell
Owner dashboard "Thinking of selling?" card → expression of interest → `BuyerSignal`-mirror on the sell side is **not** built in loop one; the action opens a thread with admin (Capital handles it off-platform, Q1). Recorded so the loop's exit exists visibly.

### F-OWN-6 · Owner stay (resident-guest, Q7 ⚠ provisional)
Owner dashboard → "Stay in my unit": `DateRangePicker` (their unit; availability-checked; ≥ `[cfg] owner_stay.notice_hours` ahead) → creates `Booking(booking_type=owner_stay, total=0, status=confirmed)`; blocks dates; ops notified (N-17; turnover clean scheduled, charged per `[cfg] owner_stay.charge_cleaning`). During the stay the owner's home space shows the guest in-stay card layered over owner views (`RoleContextBanner`). Occupancy reports flag these nights `owner_stay`, excluded from revenue-occupancy.

## 4. Provider journey (F-PROV)

### F-PROV-1 · Apply & get vetted
`[keys] provider.*` · Public providers page (doc 08) → application form: business name, categories (`[cfg] catalog.service_categories`), contact, description, documents upload. Creates `Provider(status=applied)` + applicant identity. Admin vetting (checklist: docs, references, terms) → `active` + `vetted_at` (**the badge**) + `provider_member` role → N-18 welcome; or rejected with reason (N-19).
⚠ Incomplete application → saved draft state, reminder N-20.

### F-PROV-2 · Define services
Provider portal → services editor: title, description (per-language fields optional), category, price model (`fixed/per_hour/per_person/quote`), base price, duration, advance notice, project scope, photos → `Service(status=active)` after admin spot-check (config flag `services.require_admin_approval`, default `true` — **new parameter, doc 04 group 6**).

### F-PROV-3 · Receive & fulfil orders
Order queue (S13): new paid orders with `SlaCountdown` (`[cfg] service.accept_sla_hours`). **Accept** → guest notified N-21, address details revealed. **Decline** → auto full refund + N-22 + suggestion rail of alternatives to orderer. Fulfil at slot → provider marks fulfilled (orderer can confirm/dispute within 48h window before auto-close). Rated via F-SVC-4.
⚠ **No response by SLA** → auto-decline path. ⚠ **Provider no-show** (orderer reports from order detail) → order `failed`, full refund (`[cfg] service.provider_no_show_refund_pct`), auto-ticket raised against provider, admin sees repeat-offender count.

### F-PROV-4 · Get paid
Remittance report per `[cfg] services.payout_period`: fulfilled orders, gross, take-rate, net; `Payout(payee=provider)` recorded on execution (manual rails loop one, Q18) → N-23.

## 5. Management company & staff (F-MC, F-STAFF)

### F-MC-1 · MC onboarding
Admin creates `Organization(management_company)` + invites members (`mc_member` roles scoped to project+org). MC lists units: same mobilization flow F-OWN-1 but engagement `via_management_company` (`[cfg] engagement.via_mc.platform_fee_pct`); the MC operates their units (doc 03 matrix); owner still gets statements unless config says otherwise.

### F-MC-2 · MC operates
Their portal = staff-shaped views scoped to their units: bookings, tickets on their units, announcements (posted-as MC), service orders for common areas (F-SVC-2 with role=mc_member). Fee report: platform-fee lines per period.

### F-STAFF-1 · Staff onboarding
Admin grants `staff_ops`/`onsite_host` per project → invite → staff land on the ops board (S12).

### F-OPS-1 · Daily ops board
Arrivals (verification state, check-in action → condition report camera flow), departures (inspection checklist → check-out report), TM30 queue, tickets by SLA, today's service orders in their projects.

### F-OPS-2 · TM30 filing (the 24h rail) ⚠ provisional Q10
Check-in confirmation spawns `Tm30Filing` per foreign `BookingGuest` (`due_at = checked_in_at + [cfg] compliance.tm30_sla_hours`). Queue item shows passport data (access-logged), address block ready to copy, deep link to the official portal. Staff file → mark `filed` + upload receipt.
⚠ **Portal won't accept / down** → mark `failed` + `failure_note` → status `escalated` at `due_at − [cfg] compliance.tm30_escalation_hours_before` → admin N-24 (urgent); the queue keeps the item red until `filed`. The record proves diligence either way.

### F-OPS-3 · Record costs
Unit → "record cost": type (ledger entry enum subset), amount, date, description, receipt photo → `LedgerEntry` (feeds the statement). ⚠ Wrong entry → reversal entry via admin only (append-only ledger).

### F-OPS-4 · Availability & pricing upkeep
Unit calendar: add/remove `BlockedDate` (reason required), add/remove `PricingRule`. iCal sync status visible per unit (`IntegrationAccount` health); import conflicts (OTA booking overlaps platform booking) → conflict banner + admin alert N-25 — **the platform calendar wins; the OTA side is corrected manually** (loop-one rule, doc 01 D8).

### F-OPS-5 · Respond to booking request
Requests inbox: party, dates, guest history chip, breakdown → Approve / Decline (reason select) → F-GUEST-4 continues.

### F-OPS-6 · Record a cash payment (the loop-one primary rail)
`[keys] payments.*` · From the ops board or the booking/order detail, a staff/host with scope records cash received: amount (defaults to the outstanding total), **receipt/чек reference** (required when `[cfg] booking.payment.cash_receipt_required=true`), optional receipt photo → creates `Payment(method=cash, status=succeeded, received_by=self, received_at=now)`; a stay flips `pending_payment → confirmed`, a service order `placed → paid`; a `LedgerEntry(rental_revenue|service_commission …)` is written the same day (doc 10 §2–3). Cash **refunds** are the mirror: staff record `Refund(method=cash, paid_back_by=self)`. Same-day cash is reconciled against bank deposits into the Krungsri account (doc 10 §9).
⚠ Amount recorded ≠ outstanding total → allowed (partial cash) but the booking stays with a visible balance until fully settled; check-in gate (if on) requires full settlement.

## 6. Service orders — any role (F-SVC)

### F-SVC-1 · Browse catalog
`[keys] services.*` · Entry: home space rail, nav "Services", owner/MC dashboards. S11: category chips → `ServiceCard` grid (filtered to the viewer's project context; project switcher applies). Service detail: gallery, provider card + badge + rating, price model explainer, policy line (`[cfg] service.cancel_window_hours`).

### F-SVC-2 · Order & pay
`OrderSlotPicker` (honors `advance_notice_hours`) + quantity + unit/address context (auto from role: guest → their stay's unit; owner → their unit picker; MC → common area free-text) + note. Review → breakdown (base × qty, take-rate embedded — orderer sees the total) → pay via seam → `ServiceOrder(paid)` → provider N-26.
`quote` model: request → provider quotes in-thread → orderer accepts → pay against the quote.
⚠ Payment fails → order `expired` after hold window, slot freed. ⚠ Slot taken meanwhile → re-pick screen, nothing charged.

### F-SVC-3 · Modify / cancel order
Order detail → reschedule (new slot, provider re-confirms) or cancel: inside window → full refund; past window → no refund (dialog states it plainly); provider-side cancel/decline → always full refund + alternatives rail.

### F-SVC-4 · Rate
After `fulfilled`: N-27 prompt → `Review(target=service_order)` stars + comment → provider average updates.

## 7. Money flows (F-FIN) — detail in doc 10

### F-FIN-1 · Statement generation (monthly)
Scheduler on `[cfg] finance.statement.day_of_month`: for each unit with an active engagement, sweep unswept period ledger entries → compute per engagement type → `OwnerStatement(draft)` → admin review queue → publish (sign-off) → N-16 + PDF render.
⚠ Missing `noi_cap_annual_thb` on a direct-managed unit → generation for that unit refuses with an admin task, never guesses.

### F-FIN-2 · Reconciliation
Admin finance board: provider settlement report vs `Payment` rows; unmatched items flagged; refunds `failed` listed; payouts `recorded` → `reconciled` tick against bank statement (manual loop one).

## 8. Disputes (F-DIS)

### F-DIS-1 · Damage claim (deposit path, Q6 ⚠ provisional)
Check-out inspection finds damage → staff attach photos to check-out `ConditionReport` + estimated cost → guest notified with evidence (N-28) → if pre-auth active: capture up to authorized amount after a 48h response window; else invoice via provider link. Guest may dispute → F-DIS-2.

### F-DIS-2 · Neutral-arbiter dispute
Any party from a booking/order/statement → "raise a dispute" → creates a `Ticket(category=complaint, priority=high)` + thread with **the record attached** (condition reports, breakdowns, thread history, timeline). Admin resolves with a written decision recorded on the ticket; money consequences = refunds/adjustment ledger entries with the decision reference. The platform's single record *is* the arbiter's file (v3 §3).

## 9. Buyer journey (F-BUY)

Loop one, deliberately thin (Q1): signal detection is automatic (doc 13 §4); admin's Signals funnel (S14) shows `BuyerSignal` rows → admin/staff mark `reviewed / handed_to_capital / dismissed` with notes; hand-off to Capital happens outside the platform. The buyer-facing browse/diligence surfaces are phase-2 (journey audit defers them). The buyer identity keeps the `buyer` role so re-entry as owner (Process H close-the-loop) is one role grant.

## 10. Resident journey (F-RES)

Resident = `resident` role (granted by staff/MC/juristic). Home space (S6 without stay card): announcements, handbook, services, tickets. Their journey is a subset of guest + ticket flows; the community feed itself is phase 2 (v3 §30.4).

## 11. Admin/founder journey (F-ADM)

Covered by doc 08 §6: edit config (per-project overrides), edit content (RU/EN/TH), manage roles/people, review statements, vet providers, moderate reviews, watch signals, read the audit log. Every F-flow above has its admin-side surface in S14.

## 12. Coverage check against `user_journey_audit.md`

| Audit journey | Flows |
|---|---|
| Guest end-to-end | F-GUEST-1…10, F-SVC, F-COM (doc 09), F-DIS |
| Owner (incl. remote, multi-project) | F-OWN-1…6, S7 adaptive/switcher, F-COM |
| Buyer | F-BUY (signal→handoff; rest Capital-led/deferred per audit §5) |
| Provider | F-PROV-1…4 |
| Management company / juristic person | F-MC-1…2, announcements F-COM-4 |
| Resident | F-RES |
| Staff / ops / on-site host | F-STAFF-1, F-OPS-1…5 |
| Developer | doc 08 developer page (Process G = phase 2 per audit §5) |
| Admin / founder | F-ADM + doc 08 §6 |
| Stay booking / service booking / rental listing→booking | F-GUEST-3/4, F-SVC-1…4, F-OWN-1 |
| Cancellation / refund / modification (stays & services) | F-GUEST-8/9, F-SVC-3, refunds doc 10 |
| Search & discovery | F-GUEST-1 |
| Check-in + TM30, payment, listing creation, owner statements, disputes | F-GUEST-6, F-OPS-2, F-GUEST-3, F-OWN-1, F-FIN-1, F-DIS-1/2 |
| Unhappy paths: payment fails / verification fails / TM30 can't file / provider no-show | F-GUEST-3⚠, F-GUEST-5⚠, F-OPS-2⚠, F-PROV-3⚠ |

Gaps found while walking these journeys are logged in `open_questions.md` (Q6–Q20). One addition made here: `services.require_admin_approval` (F-PROV-2) — added to doc 04 group 6 by this reference.
