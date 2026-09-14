# myUNO Canonical Specification Pack v3

This package is the implementation constitution for `pavel949/myUNO-final`.

It is vendor-neutral and may be used by ChatGPT/Codex, Claude Code, Cursor, Gemini or an engineering team.

## Mandatory read order

1. `/PROJECT.md`
2. `docs/canonical/PRODUCT.md`
3. `docs/canonical/DESIGN.md`
4. `docs/canonical/ARCHITECTURE.md`
5. `docs/canonical/DATA_MODEL.md`
6. `docs/canonical/SERVICES_MARKETPLACE.md`
7. `docs/canonical/CRM_SPEC.md`
8. `docs/canonical/PROCESS_MAP.md`
9. `docs/canonical/ROLE_WORKSPACES.md`
10. `docs/canonical/MIGRATION_DELIVERY.md`
11. `docs/canonical/AI_AGENT_RULES.md`
12. `docs/canonical/QA_ACCEPTANCE.md`
13. `docs/canonical/READINESS_ACCEPTANCE.md`
14. `docs/canonical/ROADMAP.md`
15. `docs/canonical/RECONCILIATION.md`
16. `docs/canonical/DECISIONS_CHANGELOG.md`

Existing repository instructions (`CLAUDE.md`, `AGENTS.md`, Cursor rules, etc.) must point to this hierarchy and must not compete with it.

The pack intentionally separates product intent, design, architecture, data, marketplace, CRM, processes, roles, migration, agent behavior and acceptance evidence. This reduces implementation drift while keeping `PROJECT.md` readable enough to remain the top-level canonical document.
