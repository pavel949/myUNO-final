# Workspace navigation increment — 2026-10-15

> **Исторический отчёт / evidence прежнего среза.** Не является текущим статусом main или production. Актуальное [описание системы](current/SYSTEM.md) и [реализация / остаток](current/IMPLEMENTATION_STATUS.md) сверены 2026-10-16. Команды и результаты ниже относятся только к исходному контексту отчёта.

## Scope and base

This isolated increment follows the composed employee candidate identified by source-manifest SHA256 `9344b0748f6b254012609e54f0a9679ef590170676560e8ead7e0e1fdbedc30f` (PR289 base `78439150ac94f3e10197f3ce998162090dc6b526`). It adds explicit Personal / Property / Services navigation. No role, database schema, reservation, fee, or publication authority changes are included.

## Behavior

- Personal has stable Explore / Saved / My / Messages / Profile tabs.
- Property has stable Today / Calendar / Properties / Messages / More slots. Unsupported sections open an explanation with an authorized next step; creation-only employees retain their real draft-entry route.
- Services appears only for the existing provider-scoped workspace. Its destinations are the current order queue, services, remittances, participant-authorized Messages, and More.
- The control plane and denied workspace routes show the explicit switch without consumer or operational lower tabs. Existing operational/admin menus remain available.
- Public property discovery and ordinary personal pages do not inherit a previous work preference. An active stay does not override an explicit owner/work choice.
- More is a real menu; common Profile and explicitly authorized Administration links prevent empty sheets.

## Authority and scope

The server projection rechecks an active identity, structurally valid current role assignments, real scoped records, operational departments, effective operating-space access, existing narrow property capabilities, current employee creation grants, and existing provider membership. It reuses canonical landing precedence only after these checks. Local storage contains a per-identity display preference, never a permission or resource grant. Existing destination/server read and write authorization remains authoritative.

The client requests server refresh on focus and route changes. Refreshed context removes unavailable selections and revalidates already-open sheets. This is not an instantaneous revocation push guarantee; server routes still enforce revocation even while navigation is stale.

Project, organization, space and unit filters are intersected with the server projection. Calendar-specific unit/project authority is separate from a broader Today scope. Existing board date/range and safe return paths are retained. Staff/space URLs never acquire an organization filter that would accidentally activate MC mode. MC calendar links use the canonical board directly because the compatibility redirect drops operating-space context.

Messages remains the same participant-authorized inbox. The workspace hint changes navigation only; it does not filter conversations or grant staff access. Inbox/thread/back links preserve validated work scope, or an explicit Personal hint.

## Existing-route limitations

| Context | Available destinations | Deliberate limitation |
| --- | --- | --- |
| Guest / buyer | Personal tabs, existing trip/buying links | No work workspace inferred from browsing |
| Resident | Existing residence surface and personal links | No operational calendar permission inferred |
| Owner | Existing owner dashboard and statements | No dedicated owner calendar route exists |
| Scoped staff | Existing operations and department-eligible calendar | Out-of-department calendar projects/units excluded |
| Operating-space member | Existing effective-space overview and supported capabilities | Creation-only membership does not grant operations |
| MC member | Real project/organization portfolio and canonical MC board | New More menu does not link to aggregate MC Tasks, whose existing reader ignores portfolio filters |
| MC plus selected operating space | Exact compatible calendar and shared navigation context | Today/Properties do not pretend a broader portfolio is the selected space |
| Content/pricing/booking delegate | Existing exact property tools | No operational calendar or private guest data inferred |
| Creation-only employee | Existing draft creation | Historical retained intake alone is not current creation authority |
| Provider | Current provider workspace routes | No invented provider calendar or arbitrary provider switch |
| Admin | Own control plane and explicitly selected work/personal modes | Stored preferences never choose administration |

## Accessibility, localization and integration

Controls use keyboard focus states, selected-state semantics, dialog focus management and Escape/close return focus. Layout reserves measured switcher and tab heights, mobile safe-area padding, and offsets existing sticky actions/rails/section anchors. EN/RU/TH/ZH copy is registered as reviewable content drafts; no locale is auto-approved.

## Verification and release gates

The artifact includes reproducible mocked policy/server/DOM tests and a synthetic component-browser harness. No production identities or property data are used. Production TypeScript and full repository lint are run against the actual locked dependencies and generated Prisma client.

Actual browser rendering is unverified: local Chromium launch is prohibited by a socket restriction; the supported cloud browser cannot reach this execution workspace's localhost server. No alternative tunnel or transport was introduced. No screenshot is presented as completed. Full app authentication, actual PostgreSQL, real storage, deployment and runtime revocation remain release gates.

Apply only after the exact composed employee candidate, inspect preimages, run full exact-head CI and isolated PostgreSQL/browser acceptance, review locale drafts, then follow the existing release/rollback procedure. Reverting this isolated increment restores the previous navigation without changing permissions or stored business data.
