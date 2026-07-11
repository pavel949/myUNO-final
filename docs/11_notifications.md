# 11 · Notifications & Messaging Channels

**What this document is.** Every notification the platform sends: trigger, recipients, channels, timing, and content keys. The mechanism: one `createNotification(type, identity, params)` call per event — **best-effort, never failing the primary action** — which writes the `Notification` row (in-app) and fans out `NotificationDelivery` rows per enabled channel.

**Channels & the seam.** `in_app` (the bell + feed, live via SSE) and `email` are delivered in loop one. `whatsapp` and `telegram` are fully specified here but ship **disabled** (`[cfg] notify.channel.*.enabled`, ⚠ Q9) until the WhatsApp Business number / Telegram bot exist — enabling them is a config flip, not a build. Channel adapters sit behind one `deliver(channel, identity, rendered)` seam (email = Resend-compatible with console fallback, the legacy-proven pattern).

**Routing rules.** Every type has a default channel set (table below); users can mute non-essential types per channel in account settings (`/app/account`); **transactional-critical** types (marked ●) ignore mutes. Rendering: `notify.<type>.title/body` and `email.<type>.subject/preheader/body` content keys in the **recipient's locale**, ICU params. Quiet hours (`22:00–08:00` project time) delay non-critical messenger/email sends; in-app always lands. Every send is recorded (`NotificationDelivery`) — no ghost messages.

Channel shorthand: **A** in-app · **E** email · **W** WhatsApp · **T** Telegram (W/T = "when enabled").

---

## Catalog

### Identity & access

| ID | Type key | Trigger → recipients | Channels | Timing |
|---|---|---|---|---|
| N-01 ● | `auth.verify_email` | Registration → the person | E | Instant |
| N-01b ● | `auth.password_reset` | Reset request → the person | E | Instant |
| N-01c ● | `auth.account_claim` | Staff/channel-created identity → the person | E, W | Instant |

### Stays — guest side

| ID | Type key | Trigger → recipients | Channels | Timing |
|---|---|---|---|---|
| N-02 ● | `stay.confirmed` | Payment confirmed → guest | A, E, W | Instant. Includes dates, unit, breakdown, policy, home-space link. |
| N-33 | `stay.request_placed` | Request-to-book created → guest | A, E | Instant ("we'll answer within {hours}h") |
| N-05 ● | `stay.request_approved` | Host approves → guest | A, E, W | Instant, with pay link + hold countdown |
| N-06 | `stay.request_declined` | Decline or auto-decline → guest | A, E | Instant, with re-search CTA |
| N-04 | `stay.hold_expired` | Unpaid hold expires → guest | A, E | Instant |
| N-07 ● | `stay.prearrival_passports` | T-`[cfg] compliance.passport_required_hours_before_checkin` and unmet → guest | A, E, W | Scheduled; repeat once at T-6h |
| N-07b | `stay.checkin_instructions` | Verification complete, T-24h → guest | A, E, W | Scheduled |
| N-12 | `stay.checkout_reminder` | Departure day 08:00 → guest | A, W | Scheduled |
| N-09 ● | `stay.cancelled` | Cancellation → guest **and** ops/owner-visible feed | A, E | Instant, refund math included |
| N-13 | `stay.review_prompt` | Check-out + 24h, no review → guest | A, E | Scheduled, once |
| N-14 | `stay.post_stay` | Check-out + 7d → guest | E | Scheduled ("book direct next time") |

### Stays — ops/owner side

| ID | Type key | Trigger → recipients | Channels | Timing |
|---|---|---|---|---|
| N-03 ● | `stay.new_booking_ops` | Confirmation → project ops lead (+MC if via-MC unit) | A, E | Instant |
| N-34 ● | `stay.request_received` | Request-to-book → ops/host responders | A, E, W | Instant; reminder at half-SLA if unanswered |
| N-11 | `stay.modified_ops` | Guest modification applied → ops (+owner feed) | A | Instant |
| N-08 ● | `stay.verification_failed` | Passport deadline missed → ops lead | A, E | Instant |
| N-17 | `stay.owner_stay_booked` | Owner books own unit → ops lead | A, E | Instant (turnover scheduling) |
| N-25 ● | `ops.ical_conflict` | iCal import overlaps platform booking → ops lead + admin | A, E | Instant |
| N-24 ● | `compliance.tm30_escalation` | TM30 unfiled at escalation threshold → admin + ops lead | A, E, W | Scheduled per `[cfg]`; repeats hourly until filed |

### Services

| ID | Type key | Trigger → recipients | Channels | Timing |
|---|---|---|---|---|
| N-26 ● | `order.new` | Order paid → provider members | A, E, W | Instant; reminder at half accept-SLA |
| N-21 ● | `order.accepted` | Provider accepts → orderer | A, E, W | Instant |
| N-22 ● | `order.declined` | Decline / accept-SLA lapse → orderer | A, E | Instant, refund noted + alternatives |
| N-22b ● | `order.failed_no_show` | No-show confirmed → orderer (+admin) | A, E | Instant, full-refund noted |
| N-27 | `order.review_prompt` | Fulfilled + 12h → orderer | A | Scheduled, once |
| N-23 | `provider.remittance` | Remittance recorded → provider members | A, E | Per payout cadence |
| N-18 / N-19 | `provider.approved / .rejected` | Vetting outcome → applicant | E | Instant |
| N-20 | `provider.application_reminder` | Draft application idle 72h → applicant | E | Once |

### Money & owner

| ID | Type key | Trigger → recipients | Channels | Timing |
|---|---|---|---|---|
| N-16 ● | `owner.statement_published` | Statement published → owner | A, E | Instant, PDF attached/linked |
| N-16b | `owner.payout_recorded` | Payout recorded → owner | A, E | Instant |
| N-15 | `owner.unit_live` | Unit goes live → owner | A, E | Instant (welcome + dashboard tour) |
| N-10 ● | `finance.refund_failed` | Provider refund failure → admin | A, E | Instant; repeats daily until cleared |
| N-28 ● | `stay.damage_claim` | Damage claim opened → guest | A, E | Instant, evidence + 48h window stated |

### Communication layer

| ID | Type key | Trigger → recipients | Channels | Timing |
|---|---|---|---|---|
| N-30 | `message.new` | New thread message → other participants (offline ones) | A, E-digest, W | A instant; E digest ≥ 15 min unread batch; per-thread mute respected |
| N-35 | `ticket.status_changed` | Any status transition → reporter | A, E | Instant — the transparency promise |
| N-36 | `ticket.assigned` | Assignment → assignee | A, E | Instant |
| N-31 ● | `ticket.sla_escalation` | SLA breach/imminent → assignee + admin | A, E | At threshold; repeats at breach |
| N-32 | `announcement.published` | Publication → audience members | A (+E if poster marks "important") | Instant |
| N-37 | `review.reply` | Host/provider reply → reviewer | A | Instant |
| N-29 ● | `lead.received` | Public lead form → admin | A, E | Instant |

## Digest & anti-noise rules

One event, one notification — dedupe by `(type, target, recipient)` within 10 minutes. Message emails batch as digests; announcement emails only when flagged important; owners get **no** per-booking emails (their feed shows activity; the monthly statement is the owner's rhythm — N-03 goes to ops, not owners). WhatsApp/Telegram carry only ● types plus check-in logistics — messengers are for what matters, per the calm-brand voice.

## Content keys

Every type above requires `notify.<type>.title` + `.body` (+ `email.<type>.subject/preheader/body` where E is listed) in RU/EN/TH, created `needs_review` per doc 05 §1. Params available per type are the obvious entity fields (booking dates/unit/project/amounts/deadlines) — builders document the exact param set in the key description field.
