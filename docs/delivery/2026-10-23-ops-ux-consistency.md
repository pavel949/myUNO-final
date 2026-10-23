# Operational workspace consistency

Scope: myUNO-final only; follow-up to [issue #334](https://github.com/pavel949/myUNO-final/issues/334) and process fix [PR #333](https://github.com/pavel949/myUNO-final/pull/333).

Read-only desktop inspection of deployed8bb999a at viewport1363 found Today content1028px versus Requests896px with the same rail. Messages rendered only212px of ivory content inside a936px mint workspace. Source confirmed separate per-page width/padding and a flex-1 inbox inside a block shell.

Today, Requests, Stays, Housekeeping and their shared loading skeleton now use the existing stitch-page container: max1280px, horizontal20/32px, vertical32/40px. Existing grids and domain controls are retained. Messages locally gets a minimum screen height, allowing its existing flex layout and ivory background to fill the workspace; the shared consumer shell is unchanged.

Implementation revision:720249fdfdc1dbf9725ed18f0b1ae91d2c611e9b. Full ESLint, production TypeScript and whitespace checks passed in the isolated worktree. No CSS-mirroring tests were added for this reversible presentation change. Final CI, browser/recovery and screenshot review results are recorded in the PR after execution.

The browser pack uses a disposable PostgreSQL database and real local production build. Its existing navigation journey now also captures Today, Requests, Stays, Housekeeping and Messages at1363px and390px with an authenticated synthetic administrator. It checks real route responses and preserves the final no-business-mutation snapshot; it does not assert CSS class names. Screenshots will be reviewed after execution; synthetic evidence is not proof of deployed UI. Live mobile screenshots of these screens were unavailable in the read-only audit. Admin sizing, pricing negative margins and other workspaces remain outside this bounded fix.

No production writes, deployment, domain changes, tariff/booking modifications, new dependencies or authority changes occur in this UX change. The code includes PR #333 as its parent; merge only after that process fix is green and merged, with an exact diff check against current main.
