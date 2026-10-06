# PMS Completion Audit + Founder Governance — 2026-10-06

## Scope
Code/schema audit of `pavel949/myUNO-final` current `main` plus the founder-governance implementation branch created from it. This document distinguishes implemented code from production/runtime proof.

## Governance conclusion
Founder / Super Admin is canonically represented by `Identity.isAdmin=true`. This is platform-wide root authority and must not be modeled as another scoped `RoleType`.

Delegated access is layered:
1. `RoleAssignment` — relationship and project/unit scope.
2. `ProjectStaffPermission` — departmental restriction.
3. `OperatingSpaceMember.capabilities` — portfolio/resort operating authority.
4. `OperatingTeam` / `OperatingTeamMember` — assignment grouping.
5. Unit engagements continue to constrain external management-company access.

The founder control plane at `/app/admin/access` is the canonical management surface for portfolio/resort delegation. It reuses these records rather than introducing a parallel RBAC system.

## Founder invariants
- Admin can see and operate every platform domain.
- Operating-space scopes never restrict an admin.
- Founder can create an operating space, choose its exact managed units, and assign/revoke delegated operators.
- Founder can grant capabilities granularly or by responsibility preset.
- Privileged mutations are audit logged.
- Current root identity cannot block itself.
- The last active Super Admin cannot be blocked.

## Delegated management presets
Presets are UI policy over canonical capabilities, not new global roles.

| Preset | Purpose |
| --- | --- |
| Portfolio manager | Full delegated Operating Space authority |
| Resort manager | Full day-to-day resort authority; no owner-report generation by default |
| Reservations lead | Calendar, reservations, availability |
| Housekeeping lead | Calendar, work queue, assignment, housekeeping |
| Maintenance lead | Calendar, work queue, assignment, maintenance |
| Revenue & distribution | Calendar, pricing, availability, channels |
| Finance & owner reporting | Finance view, expense entry, owner reporting |
| Custom | Founder-selected capabilities |

## Current platform workspaces
- Founder / Super Admin: `/app/admin`
- Founder access governance: `/app/admin/access`
- Staff operations: `/ops`
- Operating spaces: `/ops/spaces`
- Operating space home: `/ops/spaces/[spaceId]`
- Management company: `/mc`
- Owner: `/owner`
- Guest: `/trips`, active stay Home Space
- Resident: `/residence`
- Provider: `/provider`
- Juristic: `/juristic`
- Buyer: `/buying`

## PMS completion audit

### P0 — required before calling PMS production-operational

| Item | State | Required resolution |
| --- | --- | --- |
| Founder root visibility and mutation authority | Implemented | Runtime smoke with founder account |
| Unified founder access/governance surface | Implemented in governance branch | Merge and smoke |
| Portfolio/resort manager delegation | Implemented in governance branch | Configure actual Layantara and condo spaces and real people |
| Cross-project/unit scope enforcement | Implemented structurally | Runtime test with two disjoint managers |
| Prevent founder self-lockout / last-admin lockout | Implemented in governance branch | API regression test |
| Canonical Booking lifecycle | Implemented | Full runtime request→pay→check-in→checkout→complete smoke |
| No-overlap / inventory authority | Implemented | Concurrency production-like test |
| Unified calendar over Booking + BlockedDate | Implemented | Browser smoke in all role contexts |
| Check-in readiness gate | Implemented | Runtime dirty-unit denial test |
| Checkout→cleaning→inspection | Implemented | Runtime turnover smoke |
| Task state machine and assignment | Implemented | Runtime assignee/team test |
| Housekeeping readiness board | Implemented | Mobile staff smoke |
| Maintenance + preventive maintenance | Implemented | Scheduled-generation smoke |
| Payment/ledger integrity | Implemented architecturally | Real reconciliation smoke |
| Owner isolation | Implemented structurally | Two-owner runtime denial test |
| MC managed-unit boundary | Implemented structurally | Two-MC runtime denial test |
| Passport/TM30 sensitive scope | Implemented | Runtime audit/access test |
| Full OTA ARI | Not complete | Connect a real ARI adapter/provider; iCal alone is not sufficient |
| Production data assignment | Not proven | Assign real operators, scopes and departments in production DB |

### P1 — required for a strong daily operating product

| Item | State | Required resolution |
| --- | --- | --- |
| Human-readable booking reference | Schema/application support exists in current main; verify all surfaces use it | PMS/folio/search consistency |
| Guest folio surface | Canonical financial rows exist | Build read model/UI, no second ledger |
| Structured zone inspection checklist | Partial | Add structured checklist over OperationalTask/ConditionReport |
| Personal Housekeeper “My Shift” | Partial | Mobile assigned-work queue on canonical tasks |
| Personal Technician “My Jobs” | Partial | Mobile assigned-work queue with blockers/cost approval |
| Front Desk focused home | Partial | Reduce generic navigation; arrival/departure-first UI |
| Revenue Manager focused home | Partial | Effective rate/restriction/channel-exception workspace |
| Finance focused home | Partial | Exception-first reconciliation/obligations workspace |
| Manager staffing view | Implemented at founder level + project team pieces | Add operating-space team roster/coverage view |
| SLA/escalation | Partial | Expand from tickets into overdue operational work |
| Notifications for task assignment/due/blocker | Partial | Wire canonical notification jobs |
| Mobile offline/draft completion | Target only | Implement server acknowledgement/draft state |

### P2 — product maturity / scale

| Item | State | Required resolution |
| --- | --- | --- |
| Live service dispatch | Gap | Assigned provider staff, ETA, en-route/in-service/done |
| Workforce scheduling / shifts | Gap | Shift roster layered over Identity/OperatingTeam |
| Parts/assets maintenance register | Gap | Asset-level maintenance history where justified |
| Advanced housekeeping QA analytics | Gap | Re-clean rate, inspection failure, turnaround SLA |
| Multi-destination ops timezones | Architecture ready | Validate with second real destination |
| Demand/revenue automation | Partial | Keep canonical quote engine as writer |
| Full channel health automation | Partial | Real external channel adapter evidence |

## Existing Stitch SuperAdmin references
The repository includes Stitch source screens for:
- `myuno_superadmin_executive_hub`
- `myuno_superadmin_portfolio_projects`
- `myuno_superadmin_iam_rbac_audit_trail`
- `myuno_superadmin_ledger_split_engine_payouts`
- `myuno_superadmin_services_vendor_hub`
- `myuno_superadmin_api_cloud_clusters`
- `myuno_superadmin_web_files_ota`

These remain visual/product references. Canonical myUNO schema and permission services remain authoritative. Invented Stitch facts, hard-coded revenue shares, plaintext secrets and unsupported payment types must not be copied into production.

## Immediate production configuration target
Create/verify at least two disjoint Operating Spaces:
1. Layantara — exact Layantara units; operational leader Rea; resort-manager preset, then tune finance/pricing/channel rights as required.
2. Managed Condominiums — exact managed condo units only; operational leader Olya Ignateva; portfolio-manager preset, then tune responsibilities.

Acceptance: Rea cannot see or mutate condo portfolio data; Olya cannot see or mutate Layantara data unless founder explicitly grants a second scope. Founder can see and operate both.

## Release acceptance
Do not mark governance or PMS complete from a green build alone. Required runtime proof:
- founder login and global visibility;
- create/update Operating Space;
- assign and revoke one manager;
- cross-scope denial for two managers;
- reservation lifecycle;
- turnover lifecycle;
- payment/reconciliation;
- owner isolation;
- MC isolation;
- responsive/mobile operational surfaces.
