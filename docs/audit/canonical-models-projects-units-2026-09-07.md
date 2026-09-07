# Canonical Models · Project & Unit — Maturity, Usability, and the Project↔Unit Link

**Date:** 2026-09-07 · **Head:** `10cb75b` · **Scope:** `Project`, `Area`, `Unit` and every place
the two are joined. Read against the running code and the schema, not against the specification.

Prior art this supersedes on the project/unit question: `docs/architecture/PLATFORM_MATURITY.md`
and `docs/architecture/PRODUCTION_READINESS.md` (both 2026-08-18). Their structural verdicts still
hold. What follows adds the **link integrity** findings those two did not cover.

---

## 1. Verdict in one paragraph

**The canonical models are real and they are correctly shaped.** `Unit.project_id` is a non-null
FK with `onDelete: Cascade`, `@@unique([projectId, name])`, and an index on
`[projectId, categoryKey]`; 17 tables carry `project_id` and 23 carry `unit_id`. The spine is
schema-enforced where it matters most, and 77 models hang off it without a rival property model
anywhere in the repo — the CRM binds to `Project`/`Unit` by FK rather than duplicating them, which
is the single most important thing to get right and it is right.

**The models were mature; the joins were not.** The weakness was never the entities, it was the
wire between them: in four places the platform accepted a `project_id` from a caller and never
checked it against the unit's actual project, and nothing in the database stopped the two from
disagreeing. That was the answer to "can they be connected" — structurally yes, trustworthily no.
**All four are now fixed** (§4), and the invariant sits in the database rather than in each
writer's good intentions.

**Usability verdict: an operator can create a project and a unit without code, and cannot place
that project on the map of the business without code.** `Area` — the canonical location entity —
has a service, a cycle guard, an inclusive tree walk, and no admin route and no admin UI at all.

---

## 2. Maturity by dimension

| Dimension | Level | Evidence |
|---|---|---|
| Entity existence & shape | **L4** | `Project`, `Area`, `Unit`, `UnitEngagement`, `OwnershipPeriod` all exist with documented fields; `Area` cycles blocked by CHECK **and** by `wouldFormCycle` on write |
| Unit → Project reference | **L4** | Non-null FK, cascade delete, `@@unique([projectId, name])`, indexed |
| Referential integrity of *derived* project ids | **L1** | No constraint, no service check — see §4.1, §4.2 |
| Public status coherence | **L2** | Unit detail refuses a unit whose project is not live; **search does not** — §4.3 |
| Attribute ownership / inheritance | **L2** | Amenities are two independent `String[]`, catalog-validated but with no inheritance and no provenance |
| Structural hierarchy inside a project | **L0** | No building, wing, zone or floor entity. `Unit.floor` is free text |
| Sellable class | **L2** | `category_key String?` validated against the project's config catalog. Not an entity — nowhere to hold a category's name, photos or standard occupancy |
| Location model (`Area`) | **L2** | Schema and service are L4-quality; unreachable from any interface — §5 |
| Ownership over time | **L4** | `OwnershipPeriod` with a GiST overlap exclusion; `setUnitOwner` writes period and scalar in one transaction |

---

## 3. What is genuinely good (do not redesign this)

1. **One property model.** No shadow inventory table. `CrmOpportunity.project_id`/`unit_id`,
   `ManagementContract`, `ComplianceRecord`, `ConditionReport`, `OperationalKpi`, `IncidentLog`,
   `IntegrationAccount` and `MetricDaily` all point at the same two rows. This is what makes the
   "enter a unit once, it appears everywhere" claim true rather than aspirational.
2. **The legal gate is on the create path, not only the update path.** `createUnit` refuses
   `status: 'live'` outright, because `POST /api/admin/units` spreads the request body — a unit has
   to become live through the transition that checks `permitted_use_confirmed_at`.
3. **Taxonomy is config-owned.** `assertCatalogKeys` validates amenities, cancellation policies and
   unit categories, and unit categories are validated **project-scoped**. This closes the
   "untyped `String[]`" finding in the 2026-08-18 scorecard, which is now stale on that point.
4. **Location is inherited deliberately.** A unit has no coordinates; map-bounds search filters
   through `project: { latitude, longitude }`. That is the correct direction of inheritance and it
   is implemented.
5. **`Area` refuses to fail wide.** An unknown area slug matches nothing rather than everything, and
   an empty area reports null occupancy rather than 0%.

---

## 4. Link-integrity defects (new findings) — **all four FIXED 2026-09-07**

> Fixed in the same branch as this audit. Each fix carries a test that fails
> without it, and the invariant now sits in the database as well as the
> services (doc 02 §2.5.2, migration `20260907001000_unit_project_coherence`).
> §4.3 turned out to have **three** sites, not one: the guest unit-detail API
> had the same defect and was found while fixing the others.

### 4.1 `POST /api/bookings` trusts a client-supplied `projectId` — FIXED

`src/app/api/bookings/route.ts` reads `projectId` from the request body and, on the
specific-unit path, never compares it with the unit's own project. It then uses that value for:

- `createBooking({ unitId, projectId })` → `booking.project_id` is filed against the wrong project;
- `resolveCancellationPolicy(..., { projectId, unitId })` → **the cancellation terms of the wrong
  project's config override are snapshotted onto the booking**, and that snapshot is immutable by
  trigger. This is a money defect, not a reporting one.

Everything project-scoped downstream then inherits the lie: project ledger rollups, `MetricDaily`,
analytics events, MC dashboards (which scope by project), and any project-scoped role granted off
the booking.

**Fix:** derive `projectId` from the unit inside the booking transaction. Never accept it from the
client on the specific-unit path; on the category path it is a *search* input, not a filing input.

### 4.2 `POST /api/admin/contracts` accepts `unitId` and `projectId` independently — FIXED

`src/app/api/admin/contracts/route.ts` validates that the unit exists and that the project exists,
then writes both. It never asserts `unit.projectId === body.projectId`. A management contract —
the document that decides whether a performance fee is owed — can be filed against a project that
does not contain the unit.

**Fix:** derive it from the unit; drop it from the request contract.

### 4.3 Unit search ignores project status — FIXED (three sites)

`src/app/api/search/units/route.ts` builds `where: { status: 'live', ...projectScope }` with **no
`project: { status: 'live' }`**, while `getPublicUnitById` correctly returns null unless *both* the
unit and its project are live. Archiving a project therefore leaves its units in search results and
bookable, and the detail page 404s when the guest clicks through. Two reads of the same fact
disagree.

**Fix:** add `project: { status: 'live' }` to the search predicate, and pin it with a test that
archives a project and asserts zero results.

**Shipped.** The same defect was in two more places, both found while fixing this one:
`GET /api/units/[unitId]` — the API the guest's booking screen actually reads — checked the unit's
status alone, so an archived project's villa pages stayed live; and
`findAvailableUnitsForCategory` sold them. All three now require a live project. The viewport filter
was merged into the same `project` clause rather than spread beside it, because two `project` keys in
one object literal silently drop the first.

### 4.4 `role_assignment` no longer requires a project for unit-scoped roles — FIXED

Migration `20260904062200_relax_role_assignment_unit_scope_check` dropped the requirement that a
unit-scoped role carries `project_id`, "for compatibility" with seed and test data, and the
replacement constraint is `NOT VALID` (existing rows never checked). Doc 02 §2.8 still states
`project_id` is **required** when scope is `unit`.

This is not cosmetic. `getIdentityRoles(identityId, { projectId })` filters on
`roleAssignment.project_id`, so a unit-scoped role written without one is **invisible to every
project-scoped permission read** — the holder silently loses access they were granted. And nothing
prevents a row where `project_id` names a project that does not contain `unit_id`.

**Fix:** repair the offending seed/test fixtures, restore the constraint, add
`project_id = (SELECT project_id FROM unit …)` coherence, and `VALIDATE CONSTRAINT`. A constraint
relaxed to accommodate fixtures is a fixture bug promoted to a schema decision.

### 4.5 The `amenities` search filter is a documented contract with no implementation — P2

The route header of `/api/search/units` documents `amenities?: comma-separated amenity keys`. The
parameter is never read and never enters the `where` clause. Separately, there is **no inheritance**
from `project.amenity_keys` to `unit.amenity_keys`: a project pool never makes its villas findable
by "pool", and `matchesSavedSearch` matches unit amenities only. Two arrays, one concept, no
resolution order.

**Fix:** implement the filter against a resolved amenity set (unit ∪ project), which forces the
inheritance decision that `docs/architecture/ATTRIBUTE_OWNERSHIP_MATRIX.md` already specifies as
the target.

---

## 5. Usability findings

### 5.1 `Area` is unreachable from any interface — P1 for the editable-without-code rule

`createArea`, `updateArea`, `buildAreaTree` and `getAreaPerformance` are exported from
`src/modules/projects/index.ts`. Nothing imports the write functions: there is no
`/api/admin/areas` route and no admin page. `createProject` and `updateProject` do not accept
`area_id` at all — the only writers of the column are `scripts/seed-three-projects.ts` and
`scripts/seed-real-data.ts`.

Consequence: **area landing pages, area search filters and area-level occupancy reporting cannot be
configured by an operator.** Adding a new development to Bang Tao requires a developer with database
access. This is a direct breach of the constitution's "everything editable without code" layer, and
it is the reason `area_label_key` — explicitly marked legacy and droppable — is still the only
location the admin UI can write (the project form synthesises
`areaLabelKey: project.{slug}.area`, i.e. it re-creates the very per-project divergence `Area` was
introduced to end).

**Fix:** an admin Areas page (tree view, create/rename/re-parent, status) plus `area_id` on the
project create/update contract. Small, self-contained, and it retires a legacy column.

### 5.2 A unit cannot be moved between projects, by design and by omission

`updateUnit` accepts no `projectId`. Given `@@unique([projectId, name])` and the money history
hanging off both ids, a re-parenting operation is genuinely a migration, not an edit — so refusing
it is defensible. It is worth stating explicitly in doc 02 §2.5 rather than leaving it as an
absence, because "a unit belongs to one project **at any time**" reads as though it can change.

### 5.3 The project form is thinner than the model

The admin project form writes name, slug, address, Plus Code / coordinates and status. Amenities,
handbook key, description key, timezone, cover media and gallery exist on the model and in
`updateProject`, but not in the UI. Operators can create a project they cannot finish.

---

## 6. Structural gaps carried forward (unchanged from 2026-08-18, restated for completeness)

- **No space hierarchy.** No building/wing/zone/floor entity. A twelve-building condominium project
  is a flat list of units with free-text `floor`. This blocks per-building announcements,
  per-building housekeeping routing, and per-building reporting.
- **No `UnitType` entity.** `category_key` is a nullable string. A category has no name, no photos,
  no standard occupancy, no price — so the "styles + villa-categories" composition in doc 08 §7
  reads its content from config and content keys rather than from the thing it is describing.
- **Price and min-nights live on `Unit`.** No dated rate plan; `PricingRule` overrides but does not
  own.

None of these blocks the first loop. All three should be decided before the second project
onboards, because each one gets more expensive per unit already in the system.

---

## 7. Recommended order

| # | Action | Why first |
|---|---|---|
| ~~1~~ | ~~Derive `project_id` from the unit in bookings (§4.1)~~ | **DONE** — derived and refused-on-mismatch, 5 tests |
| ~~2~~ | ~~Same for management contracts (§4.2)~~ | **DONE** — 2 tests |
| ~~3~~ | ~~Project status in search (§4.3)~~ | **DONE** — three sites, 8 tests |
| ~~4~~ | ~~Restore and validate the role-assignment scope constraint (§4.4)~~ | **DONE** — plus a coherence trigger on all three tables, 7 tests |
| 5 | Admin Areas page + `area_id` on the project contract (§5.1) | Unblocks browse, area reporting, and retires `area_label_key` |
| 6 | Amenity resolution (unit ∪ project) + implement the documented filter (§4.5) | Forces the inheritance decision the matrix already specifies |
| 7 | `SpaceNode` and `UnitType` as entities | Structural; decide before the second project onboards |

Items 1–4 shipped together as one hardening task (2008 tests green, build and lint clean). Items 5–6
are build tasks, blocked on the rulings below. Item 7 is an architecture decision (doc 01) before it
is code.

---

## 8. Open questions for the founder

- **Q-A:** Is a unit ever re-parented to a different project (a developer re-platting, a strata
  split)? If yes, it needs a designed transfer with money history intact, not an editable field.
- **Q-B:** Should `area_label_key` be dropped once the Areas admin ships, or kept as a per-project
  override? The constitution's answer is drop it; confirming makes the migration writable.
- **Q-C:** Does an amenity inherit from project to unit by default, or only when the unit opts in?
  §4.5 cannot be implemented without this ruling.
