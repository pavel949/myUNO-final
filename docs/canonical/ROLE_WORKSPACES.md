# ROLE_WORKSPACES.md — Canonical Workspaces

| Role | First screen | Main blocks | Primary action | Scope |
|---|---|---|---|---|
| Founder / platform admin | Needs Attention | money exceptions, readiness, overdue work, supply, pipeline, integrations | open exception and assign action | authorized portfolio |
| Property manager | Today | arrivals, departures, in-house, readiness, tasks, guest requests, staffing | unblock/assign work | delegated property/functions |
| Reservations / guest care | Arrivals & Requests | calendar, quote, booking, guest details, messages, payments | quote/book/resolve | assigned properties |
| CRM / sales | My Next Actions | leads, overdue follow-up, pipeline, proposals, handovers | respond/qualify/set next action | own/team accounts |
| Revenue | Pricing & Restrictions | rate calendar, overrides, occupancy/pace, channel health | preview/apply price change | pricing authority |
| Housekeeper | My Shift | assigned units, priority, checklist, blockers | start/complete/help | assigned work only |
| Technician | My Jobs | issue, asset, priority, instructions, approved budget/parts | diagnose/request/complete | assigned scope |
| Marketplace coordinator | Orders Requiring Action | unanswered, declined, no-show, reschedule, dispute, capacity | assign/replace/resolve | delegated network |
| Finance | Reconciliation & Obligations | receipts, refunds, payouts, statements, discrepancies | reconcile/sign-off/register payment | financial scope |
| Owner | My Homes | bookings, statements, condition, approvals, owner stays, contract | review/approve/request | effective ownership |
| Self-managed owner | My Property | owner blocks + delegated pricing/availability/content | manage permitted functions | own authorized assets |
| Partner manager | My Portfolio | units, onboarding, team, operations, settlement, health | add unit/assign team | own organization |
| Provider manager | My Orders | requests, today, calendar, problems, earned/held/paid | accept/fulfill/report problem | own provider |
| Guest/customer | My Trips & Orders | next action, arrival, services, orders, payments, help | continue trip/order/help | own relationships |
| Buyer/client | My Proposals | requirements, shortlist, viewings, shared docs, next step | select/request/respond | explicitly shared data |

## Rules
- No universal ERP sidebar for every role.
- Every `Today` row contains context, state, due time, responsible owner, blocker and next action.
- KPIs drill into source rows.
- Timezone, currency, last refresh and sync lag appear where decision-relevant.
- Frontline is mobile-first with large controls and minimal mandatory text.
- Offline completion remains draft until server acknowledgment.
- Switching Personal/Work/Partner changes context, not authorization.

## Property capability roles (2026-10-16)

`pricing_editor` permits the canonical tariff editor for the exact assigned project or unit. `booking_mode_editor` permits changing the booking mode for that scope. Neither role grants publishing, finance, team administration or general operational access. Active identity, effective authority and resource-state checks still apply.

Platform administrators may create root grants. A root holder may delegate the same capability only when `can_delegate` is explicitly enabled, within the root scope and expiry. Child grants cannot delegate further. Revoked or expired parents invalidate their children; root revocation revokes active children atomically. Grant provenance is immutable. An owner role alone does not grant either capability.

Employee draft creation is separate from these roles: creating a submission does not publish inventory or assign pricing/booking authority. Workspace switching and navigation never grant permissions.

The additive migrations `20261015080331_pricing_editor_role` and `20261015120347_property_capability_delegation` register roles and delegation metadata only; they create no user assignments. Apply through Prisma's migration ledger before deploying these readers/writers. Production migration and employee handoff require separate runtime evidence.
