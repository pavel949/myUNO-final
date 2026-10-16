# 03 · Roles & Permissions

**What this document is.** Every role in the system, what it can see and do, and where — as an explicit matrix builders implement directly. The mechanism is `RoleAssignment` rows (doc 02 §2.8): **roles are data, scoped to projects and units**; permission checks read those rows through one shared helper. Nothing is visible or doable outside a role's scope.

---

## 1. Principles

1. **Deny by default.** No role row covering the scope → no access. Public pages (doc 08) are the only anonymous surface.
2. **Scope is part of the permission.** "Owner" means nothing platform-wide; it means *owner of unit X*. Every check is `can(identity, action, resource)` where the resource carries its project/unit.
3. **Roles compose.** A person holds many rows; their access is the union. The owner staying in their own unit holds `owner`(unit) + a guest-context stay — both render (v3 §23).
4. **Enforcement lives server-side** in every query/mutation (ownership-scoped `where` clauses, the pattern proven in the legacy clone) — the UI merely hides what the server would refuse.
5. **Any role consumes services.** Ordering from the marketplace requires only *some* active role in the project (or an active stay) — it is never gated to guests.
6. **Privileged actions are audit-logged** (doc 02 §10.2).

## 2. The roles

| Role | Granted how | Scope | Who this is |
|---|---|---|---|
| `admin` | `Identity.is_admin` flag, set by another admin | platform | The founder / platform operator. Full access + the admin panel. |
| `staff_ops` | Granted by admin | project(s) | Operations staff: housekeeping/maintenance coordination, check-ins, TM30 filing, tickets. |
| `onsite_host` | Granted by admin | project | The on-site host/concierge: guest-facing subset of staff powers. |
| `owner` | Granted at mobilization (mandate) | unit(s) | The title-holder of a unit under any engagement type. |
| `guest` | Created automatically with a first booking; persists | project (of the stay) | A person who books/booked stays. |
| `resident` | Granted by staff, MC, or juristic person | project (+ optional unit) | Long-term tenant or owner-occupier living in the project. |
| `buyer` | Flag-role granted by admin/staff when a buyer journey starts | platform | A nurtured buyer lead (mostly informational in loop one; the transaction is Capital-led). |
| `provider_member` | Granted when a provider is activated | provider (via `provider_id`) | A person acting for a vetted provider. |
| `mc_member` | Granted by admin when an MC is onboarded | project + `organization_id` | A person acting for a management company. |
| `juristic_member` | Granted by admin | project + `organization_id` | A person acting for the project's juristic person. |

## 3. The permission matrix

Legend: ✅ allowed within scope · 👁 read-only within scope · — no access. "Own" = rows the identity created or that reference it. All actions are within the role's scoped project/unit unless marked *(platform)*.

| Capability | admin | staff_ops | onsite_host | owner | guest | resident | mc_member | juristic_member | provider_member | buyer |
|---|---|---|---|---|---|---|---|---|---|---|
| **Projects & units** |
| Create/edit projects, set live | ✅ | — | — | — | — | — | — | — | — | — |
| Create units, run mobilization checklist | ✅ | ✅ | — | — | — | — | ✅ (their units) | — | — | — |
| Edit unit listing (photos, description, pricing base) | ✅ | ✅ | — | 👁 (own units) | — | — | ✅ (their units) | — | — | — |
| Manage availability blocks & pricing rules | ✅ | ✅ | — | 👁 (own units) | — | — | ✅ (their units) | — | — | — |
| View unit full record (condition, compliance, history) | ✅ | ✅ | 👁 | ✅ (own units) | — | — | ✅ (their units) | — | — | — |
| **Stays** |
| Search & view live listings *(public)* | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Book a stay / pay | ✅ | ✅ (manual/agent booking) | ✅ (manual) | ✅ (any unit; own unit → owner-stay) | ✅ | ✅ | — | — | ✅ (as a person) | ✅ |
| View a booking | ✅ | ✅ | ✅ | ✅ (bookings of own units) | ✅ (own) | ✅ (own) | ✅ (their units') | — | — | ✅ (own) |
| Approve/decline booking requests | ✅ | ✅ | ✅ | — | — | — | ✅ (their units) | — | — | — |
| Modify/cancel a booking | ✅ | ✅ | ✅ | — | ✅ (own, per policy) | ✅ (own) | ✅ (their units', ops-side) | — | — | ✅ (own) |
| Record check-in/out, condition reports | ✅ | ✅ | ✅ | 👁 (own units) | 👁 (own stay's reports) | — | ✅ (their units) | — | — | — |
| Book an owner-stay in own unit | ✅ (for owner) | ✅ (for owner) | — | ✅ | — | — | — | — | — | — |
| **Compliance** |
| View/complete TM30 queue, file & record receipts | ✅ | ✅ | ✅ | — | — | — | ✅ (their units' stays) | — | — | — |
| Manage compliance records (permitted use, licenses) | ✅ | ✅ | — | 👁 (own units) | — | — | 👁 (their units) | — | — | — |
| Submit own passport data pre-arrival | n/a | n/a | n/a | ✅ | ✅ | ✅ | n/a | n/a | n/a | ✅ |
| View passport data / 🔒 fields | ✅ | ✅ (while operationally needed) | ✅ (arrivals only) | — | own only | own only | ✅ (their units' arrivals) | — | — | own only |
| **Services** |
| Browse catalog & order services | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manage own service orders (cancel/reschedule per policy) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Accept/decline/fulfil orders | ✅ | — | — | — | — | — | — | — | ✅ (their provider's) | — |
| Edit provider profile & services | ✅ | — | — | — | — | — | — | — | ✅ (their provider's) | — |
| Vet/activate/suspend providers | ✅ | — | — | — | — | — | — | — | — | — |
| **Money** |
| View own statements & payouts | n/a | — | — | ✅ (own units) | — | — | ✅ (their org's fee reports) | — | ✅ (their remittances) | — |
| Generate/publish owner statements | ✅ | — | — | — | — | — | — | — | — | — |
| Record costs (ledger entries) on units | ✅ | ✅ | — | — | — | — | ✅ (their units) | — | — | — |
| Record payouts, reconcile | ✅ | — | — | — | — | — | — | — | — | — |
| Issue refunds outside policy (goodwill/dispute) | ✅ | — | — | — | — | — | — | — | — | — |
| **Communication** |
| Message in own threads | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Open a thread with staff/host/MC | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Raise a ticket; view own tickets' status/history | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View all project tickets; assign; change status | ✅ | ✅ | ✅ (guest-facing cats) | — | — | — | ✅ (their units'/org's) | 👁 (project stats) | — | — |
| **Post announcements** | ✅ (any project, as myUNO) | ✅ (their projects, as myUNO) | — | — | — | — | ✅ (as MC, their projects) | ✅ (as juristic person, their project) | — | — |
| Read announcements | per `audience` field, evaluated against role rows — everyone in scope | | | | | | | | | |
| **Reviews** |
| Review own completed stay/order | n/a | — | — | ✅ | ✅ | ✅ | — | — | — | ✅ |
| Reply publicly (host/provider side) | ✅ | ✅ | ✅ | — | — | — | ✅ (their units) | — | ✅ (their services) | — |
| Hide a review (moderation) | ✅ | — | — | — | — | — | — | — | — | — |
| **Admin panel** |
| Edit content keys (RU/EN/TH) | ✅ | — | — | — | — | — | — | — | — | — |
| Edit configuration (+ per-project overrides) | ✅ | — | — | — | — | — | — | — | — | — |
| Grant/revoke roles | ✅ | ✅ (guest/resident only, own projects) | — | — | — | — | ✅ (resident, their project) | ✅ (resident, their project) | — | — |
| View analytics dashboards & buyer signals | ✅ | 👁 (ops metrics, own projects) | — | — | — | — | 👁 (their units' occupancy) | 👁 (project-level stats) | — | — |
| View audit log | ✅ | — | — | — | — | — | — | — | — | — |

## 4. Rules the matrix can't show

- **Ticket assignment.** Tickets are assigned to identities holding `staff_ops` or `onsite_host` in the ticket's project — or `mc_member` when the unit's engagement is `via_management_company` and the category is operational. Auto-assignment default per config `tickets.default_assignee` (doc 09 §3). The **reporter always sees status and history** regardless of assignee — that is the remote-owner transparency promise.
- **Announcement voices.** `posted_as` must match the poster's role: admins/staff post as `myuno`; `mc_member` as `management_company`; `juristic_member` as `juristic_person`. The audience selector never lets a poster reach beyond their project scope.
- **Owner read-only on operations.** Owners see everything about their unit (bookings with guest names redacted to first name + country per PDPA minimization, costs, condition, tickets, statements) but operate nothing — operations belong to staff/MC. This is deliberate: the product promise is "fully handled, and you always know how."
- **Guests and 🔒 data.** A guest sees and edits only their own party's passport data, pre-check-out. Staff access to passport fields is logged (doc 12 §5).
- **Provider blindness.** Providers see only their own services, their orders (with contact/address details exposed only between `accepted` and `fulfilled`), their reviews, and their remittance reports. They never see platform analytics, other providers, or unit records.
- **MC boundary.** An MC manages *their engaged units'* listings, availability, tickets, and ops-side bookings, and sees fee reports — but owner statements for MC-engaged units go to the **owner**; the MC sees its own fee line, not the owner's economics, unless the engagement's mandate says otherwise (config flag `engagement.via_mc.mc_sees_owner_statement`, default `false`).
- **Buyer is thin by design.** In loop one `buyer` unlocks nothing beyond what guest already has except being visible to admin in the signals funnel. It exists so the *identity* carries the state (Q1).
- **Suspension.** `Identity.status=blocked` kills all sessions and role rows' effect at the permission helper — one switch, everywhere.

## 5. Implementation contract

Scoped property capability additions are defined in [Canonical Workspaces](canonical/ROLE_WORKSPACES.md#property-capability-roles-2026-10-16): `pricing_editor` and `booking_mode_editor`. These narrowly scoped grants supplement the matrix; they do not broaden the owner role or confer administrative/financial authority.

One helper, used by every action and route: `can(identity, action, resource) → boolean`, backed by a static `PERMISSIONS` table (action → roles → scope rule) mirroring §3 exactly, plus the special rules of §4 as named predicates. The matrix above is the test fixture: doc 16 includes a task that encodes §3 as a table-driven test suite so the matrix in code and the matrix in this document cannot drift.
