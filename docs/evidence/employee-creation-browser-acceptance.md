# Employee property creation: isolated Chromium acceptance

> **Дополнительный справочный материал / спецификация.** Может содержать проектные или прежние решения; не подтверждает текущее поведение или production. Начать с [текущей системы](../current/SYSTEM.md) и [остатка работ](../current/IMPLEMENTATION_STATUS.md), сверенных 2026-10-16.

Status on 2026-10-15: runner authored; syntax, scoped ESLint, and pre-import isolation-denial checks passed. The full PostgreSQL + Next application + Chromium journey has **not been executed** for this slice. No production or publication action was performed. Do not describe source tests or these static checks as browser acceptance.

## Runner and artifacts

- Runner: `scripts/e2e/employee-creation.mjs`
- Result: `browser-results/employee-creation-result.json`
- Screenshots: `browser-results/employee-creation-*.png`
- Traces: `browser-results/trace-employee-creation-*.zip`
- Each result includes `BROWSER_HEAD_SHA` when set, individual step status, browser/page/server errors, synthetic fixture IDs, and limits.
- A passing result must come from actual execution on the exact integrated commit. Traces and screenshots are supporting evidence, not substitutes for the JSON assertions.

## Integration prerequisites

Use the existing disposable browser acceptance job and its seed. Apply the employee-creation service, route, permission, UI, translation, and existing content-proposal integration changes first. The exact-target `/property/content` deep link must be integrated; the runner intentionally does not skip that continuity step or substitute a mock.

The runner imports the existing adjacent `isolation.cjs` and `block-egress.cjs`. It invokes the exact guard before loading Playwright or Prisma. Keep the existing application-side egress block in the job as well. The only accepted application is `http://localhost:3000`; the only accepted DB is `postgresql://test:test@localhost:5432/myuno_browser_test`, matched by `DATABASE_URL_TEST`. Existing synthetic secrets and the explicit isolated opt-in must match that guard; external-service credentials must be absent. Do not weaken the guard to run elsewhere.

Do not reset or reseed between earlier journeys and this runner. It creates three new synthetic identities, a separate organization and verified project relationship, new scoped/hidden inventory, and two separate workspaces. It reuses only the existing fixture password/hash for the new synthetic accounts and the founder's existing isolated login. It snapshots previous inventory, identities, media, translations, roles, permissions, and grants and compares them afterward. Existing production grants are never needed.

The creation grants for the two active creators are saved through `/app/admin/access`, one capability per identity. No staff, content-contributor, management-company, finance, or administrator role is added. An intentionally unsupported third membership is seeded only in a separate empty synthetic workspace to test fail-closed scope behavior. Revocation and restoration use the actual founder access UI.

## Required job append (parent-owned; no workflow edited here)

After the existing browser journeys, inside the already guarded local application lifecycle, append:

```sh
node scripts/e2e/employee-creation.mjs
```

The existing artifact upload should include `browser-results/**`. If it instead uses an explicit allowlist, append these paths under the same upload step:

```text
browser-results/employee-creation-result.json
browser-results/employee-creation-*.png
browser-results/trace-employee-creation-*.zip
```

Do not add a new production/staging target, a reset, a migration workaround, or a deployment command.

## Enforced journey

1. Real founder UI independently grants `create_unit` and `create_complex` to separate creation-only users. Previous identities and permissions remain untouched.
2. Anonymous reads/writes/conversion/content, cross-creator access, unsupported empty scope, foreign parent project, and the opposite creation capability receive exact expected status and body assertions.
3. `/ops/new-unit` redirects to `/property/create?kind=unit&from=operations`, with an explicit review notice and separate authority boundaries.
4. At 390px, the unit creator saves through the UI, reloads the persisted CRM draft, revises it, submits it, and sees a read-only application. The complex-only identity independently completes its editor. No canonical Unit or Project exists before admin review.
5. Scoped duplicate suggestions use exact minimal DTOs and exclude hidden project/unit values. Expiring the separate synthetic verified relationship removes creation scope despite membership.
6. Request-ID replay recovers the same item; changed replay and stale revision fail. Forged provenance, pricing/ownership/publication fields, ordinary intake overwrite, and generic CRM overwrite are rejected.
7. Grant revocation blocks conversion. Active creators retain only their original intake and request receipt, read-only; restoration of the same membership permits review.
8. Administrator UI reviews and converts each application into a canonical draft only. Assertions exclude ownership periods, engagements, operating attachment, offerings, bookings, pricing rules, and new person-level roles. Direct listing, operations, pricing, and delegation remain denied.
9. Actual administrator UI selectors match both an existing unit and an existing complex without mutating either or adding creator content rights; the unit selector contains only the current eligible scoped unit. Newly created exact drafts remain in their creator's list and deep-link to the descriptive proposal editor.
10. Real descriptive proposal and administrator approval persist a Russian description and factual floor change; the canonical draft's protected fields remain unchanged. Revocation before a second approval and before conversion retry fails closed. Revoked readback contains original intake, without later canonical enrichment or a content link.
11. All original rows are compared and the exact new inventory counts are checked. Browser page errors, local 5xx responses, and attempted external browser origins must all be empty.

## Checks performed without runtime claims

- `node --check scripts/e2e/employee-creation.mjs`: passed.
- Scoped repository ESLint configuration: passed with the already available harness dependencies.
- Guard tests: missing isolated opt-in, foreign DB, mismatched fixture DB, foreign application origin, and an external credential all stop before any browser/Prisma import. The exact allowed synthetic environment reaches only an inert browser-import sentinel; no real browser or database was loaded.

Not covered by this runner: actual upload transport, invitation delivery, native booking success, production configuration/migrations/deployment, and full four-language visual parity. Finance scope is constrained by the exact one-capability membership and absence of any finance/legacy role; a separate finance endpoint journey is not claimed.
