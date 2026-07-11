# 09 · Communication & Services — the living-environment layer

**What this document is.** The shared layer that makes the platform feel *operated*: messaging, tickets, announcements, and the services marketplace — one layer across **all roles**, never locked to guest↔host. Data shapes are doc 02 §§4, 7; flows referenced are doc 07; permissions doc 03. The design rule everywhere: **attach to the identity and its role** — a message from "Anna" is from Anna-the-owner-of-B-707 or Anna-the-guest-of-stay-#123, and the UI says so.

---

## 1. Messaging — unified participant threads

**What a thread is.** Any set of participants around a context: guest↔host/ops (per booking), owner↔myUNO (per unit or statement), owner↔MC, orderer↔provider (per order, incl. quote negotiation), participant↔admin (leads, disputes). `Thread.context_type/context_id` renders the header ("About: B-707 · stay Jan 4–12") so no conversation floats contextless.

**Creation rules (find-or-create, idempotent):** booking confirmation auto-creates the stay thread (guest + project ops/host); "Message host" on a unit page creates/opens the unit inquiry thread; "Question this statement" creates the statement thread (owner + admin); a `quote` service request creates the order thread (orderer + provider); tickets carry their own thread (§3). Participants are fixed by the context; staff of the scoped project can join per the doc 03 matrix; nobody else can even see the thread exists (participant-only enforcement in **every** query — the legacy clone's proven posture).

**Behavior.** Real-time via SSE (one stream per open thread + the inbox counter stream); messages support text + photo attachments (upload seam); **read receipts** via `ThreadParticipant.last_read_at` ("Seen" under your last read message; unread badges in the inbox); `system` messages carry booking/order/ticket events into the same stream so the thread is the full story. Response-time expectation for ops surfaces as an SLA chip (`[cfg] messaging.response_sla_hours`) on staff inboxes only. Notifications fan out per doc 11 (N-30 new message) respecting per-thread mute.

**Unhappy paths.** Attachment too large/wrong type → inline error, message not sent. Recipient identity blocked → thread read-only with notice. SSE drop → silent reconnect + missed-message fetch (no user action).

## 2. Tickets & complaints — the light tracker

**Scope (loop one).** Create → assign → status → SLA → resolution → history. Full service-desk (escalation matrices, shift routing, CSAT) is phase 2 by design.

**Create** (any role, F-COM-3 pattern in doc 07): category (`[cfg] catalog.ticket_categories`), title, description, photos, unit/project context (auto from role where unambiguous). Complaints are tickets with `category=complaint` — one system, so nothing falls between "request" and "complaint".

**Assign.** Default assignee per `[cfg] tickets.default_assignee` (the project's ops lead); staff can reassign to any `staff_ops`/`onsite_host` in the project — or to `mc_member` when the unit's engagement is via-MC and the category is operational. Provider no-show auto-tickets assign to the ops lead with the provider referenced.

**Status chart** (doc 02 §7.2): `open → acknowledged → in_progress → waiting_reporter ⇄ in_progress → resolved → closed` (+ `cancelled` by reporter). Every transition writes a `TicketEvent`; the reporter-visible `StatusTimeline` shows all of it — **the remote-owner transparency promise is this screen**.

**SLA.** `sla_due_at` from `[cfg] tickets.sla_hours.<priority>`; breach or imminent breach fires escalation events + admin notification (N-31); the ops board sorts by SLA. Resolution requires a `resolution_note` (visible to reporter); `resolved` auto-closes after `[cfg] tickets.auto_close_resolved_days` unless the reporter reopens.

**Unhappy paths.** No assignee available (empty project staffing) → falls to admin, flagged on dashboard. Reporter disputes resolution → reopen (once) or escalate to dispute (F-DIS-2).

## 3. Announcements — the official voice

Project-scoped posts by **myUNO (admin/staff)** or the **juristic person / management company** (`posted_as` + org attribution rendered as "Official · {org name}"). Composer: title, body, audience (`everyone / owners / residents / guests_in_stay / staff`), pin toggle, optional expiry. Delivery: appears in the project home space + audience members' notification fan-out (N-32, channel rules doc 11). Read tracking per identity (badge until read). Draft state until published; author org can edit/unpublish its own; admin can unpublish anything (moderation backstop). This replaces the Telegram group's "pinned photo of the rules" failure mode: announcements are persistent, attributed, and reach exactly their audience.

## 4. The services marketplace — for any role

**Supply.** Vetted `Provider`s with the badge (vetting = F-PROV-1; the badge renders only from the `vetted_at` record — trust made visible, never decorative). Services per provider with price models (`fixed / per_hour / per_person / quote`), project scoping, advance-notice windows, `fulfilment_mode` (`referred` default / `operated` — Q3).

**Demand: any role.** Guests (in-stay or pre-arrival upsell), owners (repairs/cleaning for their unit — F-OWN-4), residents, MCs/juristic persons (common-area work), staff (on behalf of a unit), buyers. The order form derives its context from the **role wearing the order** (`orderer_role` + unit/booking links) so fulfilment knows where to go and money knows where to land (an owner-unit repair can be statement-charged; a guest transfer is paid directly).

**The order flow** (authoritative spec F-SVC-1…4, doc 07 §6): select service → schedule slot → pay through the seam → provider confirms (SLA-bound) → fulfil → rate. Cancellation/refund/modification per `[cfg] service.*` policies; provider no-show = automatic full refund + auto-ticket + offender tracking. Money mechanics (take-rate, remittance) are doc 10 §5.

**Quality loop.** Ratings per fulfilled order roll up to provider averages (shown on cards); repeated no-shows/declines surface on the admin offender view; suspension kills visibility instantly (`Provider.status`).

**Concentration effect (why this wins).** Because orders cluster in projects, the provider's day is dense (v3 §5.4) — the order queue groups by project+date to make that visible to providers.

## 5. Notifications

The fan-out rules, channel seam, and full catalog (N-numbers used throughout this suite) live in doc 11. Contract from this layer: every event named in §§1–4 emits exactly one typed notification through `createNotification` — best-effort, never failing the primary action (legacy-proven posture).

## 6. What this layer deliberately defers

The community feed/marketplace (secondhand, events, social threads), message pagination at scale, live-pushed typing indicators, and the full service-desk — phase 2+ per v3 §30.4 ("do not build the retention glue before you have won a single switch"). The shapes here (threads, announcements, catalogs) are their foundation; nothing will need re-architecture.
