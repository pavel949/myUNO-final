# CLAUDE.md — compatibility entry point for myUNO

This repository is no longer governed by a Claude-specific specification hierarchy.

The canonical, vendor-neutral implementation constitution is:

1. `/PROJECT.md`
2. `/docs/canonical/PRODUCT.md`
3. `/docs/canonical/DESIGN.md`
4. `/docs/canonical/ARCHITECTURE.md`
5. `/docs/canonical/DATA_MODEL.md`
6. `/docs/canonical/SERVICES_MARKETPLACE.md`
7. `/docs/canonical/CRM_SPEC.md`
8. `/docs/canonical/PROCESS_MAP.md`
9. `/docs/canonical/ROLE_WORKSPACES.md`
10. `/docs/canonical/MIGRATION_DELIVERY.md`
11. `/docs/canonical/AI_AGENT_RULES.md`
12. `/docs/canonical/QA_ACCEPTANCE.md`
13. `/docs/canonical/READINESS_ACCEPTANCE.md`
14. `/docs/canonical/ROADMAP.md`
15. `/docs/canonical/RECONCILIATION.md`
16. `/docs/canonical/DECISIONS_CHANGELOG.md`

Read those files first and follow them in that order.

The existing `docs/00_*` through `docs/18_*`, business, brand and historical architecture documents remain valuable evidence of existing implementation, prior decisions and current behavior. They must be reconciled rather than ignored, but where they conflict with the canonical v3 target, the v3 pack defines the target state unless doing so would create unsafe data loss, financial inconsistency, authorization regression or production outage.

Important compatibility rules:

- Preserve the existing modular-monolith stack unless a measured reason justifies change.
- Preserve mature Identity, CRM, Project/Unit, booking, finance, communications, services and design primitives and evolve them rather than duplicating them.
- Do not execute the old `docs/16_build_plan.md` mechanically when it conflicts with `docs/canonical/ROADMAP.md` or current HEAD.
- Do not treat old D1–D10 as immutable if `PROJECT.md` explicitly supersedes them; record reconciliation/ADR instead.
- Content/i18n, configuration, design tokens, money/PII/security protections and append-only/audited financial principles remain binding where compatible with the canonical pack.
- Never invent business facts, prices, authority, ownership, supply or legal claims.
- Before touching a domain, inspect current HEAD and open PRs so already-fixed work is not duplicated.
- Completion requires implementation + data/schema + authorization + tests + deployment/runtime evidence as applicable.

This file exists so Claude-based tooling reaches the same canonical specification as ChatGPT/Codex, Cursor, Gemini and other engineering agents. It is not a separate constitution.
