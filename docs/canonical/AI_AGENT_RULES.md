# AI_AGENT_RULES.md — Vendor-Neutral Coding Agent Protocol

These rules apply to ChatGPT/Codex, Claude Code, Cursor, Gemini or equivalent.

## 1. Read order
Read the canonical pack in the order defined by `PROJECT.md`, then current repository instructions and implementation docs. Repository-specific agent files must point to the canonical pack instead of competing with it.

## 2. Inspect before changing
Mandatory: current HEAD, open PRs touching domain, schema/migrations, relevant modules/routes, tests, deployment hooks, production migration state when accessible, safe data counts/invariants and current UI for design work. Return reconciliation: `preserve / extend / fix / migrate / already fixed / not checked`.

## 3. Do not invent
Never invent management authority, ownership, inventory, rates/taxes/fees, provider verification, supply availability, legal claims, performance statistics, 24/7 promises, partner counts or ROI. Missing truth becomes draft/disabled/unknown/validation blocker/config requirement.

## 4. Process-level implementation
A route/page/table is not a feature. Implement vertical process:
`input → authority → state → money → communication → failure → evidence → handover → UI`.

## 5. Canonical data check
Before adding data ask: what fact, classification, writer, scope, stable ID, constraint, sensitivity, lifecycle, event and migration? Critical rights/money/state do not live in uncontrolled JSON.

## 6. Safe migration
Use `expand → backfill → parity → cutover → observe → contract later`. No production `db push`. No migration-history mutation from build/install.

## 7. Permissions
UI hiding is not authorization. Every read/write/export/search/media/aggregate path is scoped. Effective permission = identity + org membership + role + resource + operating authority + state.

## 8. UI
Every screen has one primary job plus mobile, loading, empty, error, stale where relevant, forbidden and disabled-with-reason states. No dead CTAs, no client-authoritative money, no design-token drift, and major public UI requires visual inspection.

## 9. Money
No current config applied retroactively to accepted historical transaction. No payout twice. No financial period based on generic mutable timestamps.

## 10. Integrations
No table mirroring. Use mapping/event/command/checkpoint. Timeout does not mean success. Projection does not grant command authority.

## 11. AI features
AI may search, summarize, recommend from canonical data, draft and create intents for confirmation. AI cannot by free text grant consent, merge identities, change roles, confirm fulfillment, move money, release access or promise availability.

## 12. Change/PR contract
Every substantial change states requirement/process IDs, evidence/current finding, user outcome, modules/files, data/permission/money effects, migration, tests, rollout, rollback/recovery, runtime verification and remaining gaps.

## 13. Completion evidence
Do not say done without `code + schema + data/config + auth + UX + tests + deploy + runtime verification` as applicable. If runtime credentials are unavailable, mark `not checked`.

## 14. Questions
Ask the founder only for genuine commercial/legal/irreversible decisions. Do not ask for table names, patterns, routine bug fixes or permission to preserve canonical integrity. For commercial uncertainty, gather evidence, present concrete options, implement reversible structure and keep unapproved capability disabled.
