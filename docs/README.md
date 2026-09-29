# docs — project documentation

## Target architecture — read first

**`../PROJECT.md` + `canonical/` is the target architecture** (founder ruling, 2026-09-29). Read order is defined in `canonical/README.md`. `../CLAUDE.md` and `../AGENTS.md` both point here and must never compete with it.

- `architecture/` — deep-dive specs for pieces of the canonical build already underway (`CANONICAL_PROPERTY_DATA_ARCHITECTURE.md`, `CANONICAL_STAY_DOMAIN_CONTRACT.md`, `ERD_CORE_DOMAIN.md`, and others) — read alongside `canonical/ARCHITECTURE.md` and `canonical/DATA_MODEL.md`, not instead of them.

## Original suite — current shipped behavior, not forward direction

The numbered 00–18 suite below was generated to spec and build the platform's first loop, and that build is complete (`16_build_plan.md`, through T-043). It remains **accurate evidence of current, shipped behavior** — real mechanics for content i18n, the permissions matrix, the notification catalog, and other detail the canonical pack states at a higher level. Where it conflicts with `canonical/`, the canonical pack wins; the disagreement gets recorded in `canonical/RECONCILIATION.md` or `open_questions.md`, never silently picked one way.

- `business/Ignatev_Estate_Business_and_Operating_Model_v3.md` — the operating model.
- `business/positioning.md` — what myUNO is and how it wins.
- `business/user_journey_audit.md` — the coverage checklist: every role's journey and every flow.
- `brand/brand_direction.md` (+ boards) — brand and art direction.
- 00 legacy_audit · 01 architecture_decisions · 02 data_model · 03 roles_and_permissions · 04 configuration · 05 content_i18n · 06 design_system · 07 flows · 08 pages · 09 communication_and_services · 10 payments · 11 notifications · 12 security_privacy · 13 analytics · 14 tech_spec (module list is stale — 17 modules exist today, not the 10 originally listed) · 15 deployment · 16 build_plan (complete; forward work follows `canonical/ROADMAP.md` instead) · 17 crm_and_commercial_system · 18 platform_architecture.

## Maintained throughout

- `open_questions.md` — the running register of gaps found by walking every journey end to end, and now also the founder's decision log for reconciling the original suite against the canonical pack. Keep it current — a closed item must actually say so, not sit stale.
