# Release preparation — 2026-10-21

The user explicitly requested production migration and publication. The code was integrated with current `origin/main` `d9f9673f` (includes protected workspace administration); the content registry conflict was resolved by retaining both lead-form and pricing registrations. Existing calendar scope isolation remains intact.

The pricing migration is now included in the existing protected migration policy, pinned to SHA-256 `2e4c95a17b5318716b4cf3d1554c079277167a67518e2985a090026c3b76c414`. This permits only the exact additive SQL; target validation, exact-main CI, backup/restore and financial parity gates are unchanged. It does not itself execute a migration.

After integration: 155 focused/regression tests passed; 14 migration policy/preflight checks passed; complete repository ESLint, production-tsconfig typecheck and full isolated production compilation passed. The full build used the existing explicit CI/test-database isolation mode; it does not prove production registry review or production deployment readiness. The migration chain was applied to isolated local development/test databases only.

## Verified publication-target mismatch

Authenticated Vercel project/deployment reads establish:

| Surface | Project / framework | Source |
| --- | --- | --- |
| `myuno.app` | `myuno` (`prj_W24et3iEBnd3QvWjd0S9hkiGMaYA`), Vite | `pavel949/myuno`, production `c6d6e4ce23f1e1c1d903ce4ba6141cd37f5b8ef7` |
| Prepared pricing work | `my-uno-final` (`prj_GonhJLt1m9T060dxDBnSZtuiiWYj`), Next.js | `pavel949/myUNO-final`, current branch based on `d9f9673f` |

The live Vite repository's `vercel.json` routes to its SPA and references a different Supabase project. It does not proxy this Next.js API. Deploying the prepared Next.js code to its existing project would therefore not update `myuno.app`; reassigning the domain would replace the currently served application. Neither operation is treated as an implicit solution to this mismatch.

The requested spelling `Mayuna.app` and the intended project are being clarified with the user. Required decision: port this feature to the existing Vite application, or publish this Next.js project at its own intended address. No production migration, domain reassignment, publication, credential extraction, translation approval or edits to the other repository have been performed.
