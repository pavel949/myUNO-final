# Production UI acceptance and Russian interface repair — 2026-10-24

Repository: `pavel949/myUNO-final`. The separate `myuno` application is outside scope.
Status: **partial acceptance; issue #334 must remain open**.

## Release identity

Vercel inspection of the actual production alias `https://my-uno-final.vercel.app` returned READY deployment `dpl_7MnyfYxJU8fYz7xT4fpaWz5jXdd5`, served commit `8bb999a616a8bc781799f0d3e0800db3253e4117`.
PR #335 is merged as `ba4375f2c989a46cf32fcad778955f70d8bb5867`; the repository default branch at checkout was that merge. Its tested branch head was `f337cf492358b1e1511cbeabac19579fa0e2dff4`.
The newer production-target deployment `dpl_4LefmWQ11XVCBnvAV1vEtP1sMhe2` was ERROR, not the served release. No new deployment, promotion or migration was performed here. Existing width and Messages-height fixes in #335 were preserved, not recreated.

## Live walkthrough

Chrome cloud browser, existing Pavel session, desktop viewport about 1350 × 924. Screenshots were inspected in the browser session; there is no durable screenshot attachment in this repository. This table records observed states, not screenshot or device certification.

| Step | Observation | Acceptance |
|---|---|---|
| 1. Today `/ops` | Dashboard loaded, all booking attention counters zero; multirow project filter; Russian page with English navigation/KPI headings before copy repair | Reachable, partial; #335 is not served |
| 2. Requests `/ops/requests` | Project links and genuine empty request state; no request cards or approve/decline controls | Empty state checked; populated layout blocked by absent data |
| 3. Stays `/ops/stays` | Department/project filters loaded, work queue zero; project list occupied several rows | Partial; payment/cash/transfer forms inaccessible without a stay |
| 4. Messages `/messages` | One existing conversation, thread and back link opened; send disabled with blank composer; old short working area remains visible | Desktop navigation checked; #335 height cannot be accepted live |
| 5. Housekeeping | Navigation resolved Layantara workspace; 39 villas shown READY, zero tasks; raw English state labels in RU and TH | Populated board checked; transition states, mobile and independent staff account not checked |
| 6. Admin `/app/admin` | Russian menu/dashboard loaded; missing process-hub translations observed, repaired and verified by browser reload | Copy repair visibly confirmed; full platform acceptance excluded |

The owner portal and operations/resort workspaces were reachable from the same existing account. Workspace switching is not proof of different account roles or RBAC isolation. No other-account sign-in, impersonation or permission change was attempted. Bookings, receipts, tariffs and financial records were not edited. Messages were not sent.

EN/RU/TH switching was exercised on Housekeeping. The title and task actions switched; the old release's state labels remained English. The original RU selection was restored. No physical mobile device or native/coarse-pointer input was available. This browser API does not expose viewport/device emulation, so no fresh mobile acceptance is claimed.

## Confirmed causes and corrections

1. Operational/admin keys existed in source but were absent from the production content registry. Additional source catalogues (`process-hub`, `operator-unpaid-confirmation`, `operating-governance`, `tariff-editor-usability`) were not included in `seedContent`'s registry.
2. Some Russian seed values were literal copies of English. Corrected these UI drafts in their source catalogues; retain brands, language names, technical identifiers and standard acronyms.
3. Restored scoped missing content keys/translations directly in the existing MyUno-final database `burcnghheyzbzffzgmjz`, and corrected Russian rows only where their current value equalled the registered English default. Existing other-language rows and customized Russian text were preserved.
4. Replaced 283 direct English JSX text occurrences with exact static-copy bindings. Added localizable conditional labels, input hints and selected raw enum displays. Reuse the existing `LocaleProvider`; admin/ops resolve CMS copy with the selected-language draft as fallback. This is not DOM translation; form values, identifiers, URLs, validation, commands and server authorization remain unchanged.
5. Added six EN/RU/TH housekeeping display-state keys and wrapping for longer state labels. Stored state derivation and priority are unchanged.
6. Replaced the long project pills with a native disclosure containing bounded, scrollable links on Today/Requests and a shared control on Stays. Active selection remains visible; existing URLs preserve department/space/project context.

The static-copy catalogue currently has 474 entries, of which 417 lack Thai drafts. This change targets the requested Russian cleanup and does **not** certify Thai completeness. Source registration and runtime visibility are separate from content review; machine-drafted translations remain `needs_review`.

## Production content write evidence

Two atomic, scoped reconciliation statements and one guarded payment-status wording correction completed. The first attempted statement failed at SQL name resolution and made no changes; its corrected version succeeded.

| Locale | Inserted translation rows | Replaced rows |
|---|---:|---:|
| EN | 968 | 0 |
| RU | 968 | 134 |
| TH | 412 | 0 |

968 missing content keys were inserted. There are 2,482 matching audit entries with batch `ops-ui-language-20261024`, action `content.translation.locale_repair`, system actor `system@myuno.internal`. Each stores key, locale, exact previous row (or null), new value and source. No production seed was run: wholesale seed would overwrite editor copy and is inappropriate here.

Readback confirmed translated `staff.shell.today`, `staff.shell.front_desk`, `admin.nav.processes` and the three process-dashboard strings. Browser reload confirmed Russian operational navigation and the Russian dashboard process block. These content-only corrections are visible on the old served commit; new JSX/status/filter code is not.

For rollback, restore only the recorded prior translation value/status/author for an audit entry whose current value still equals the logged `after`; remove an inserted translation only under the same concurrency check. Leave content keys and subsequent editor changes intact. No rollback was executed.

## Validation

- 104 targeted tests passed across 21 files, including real form command payload assertions, project/space/department navigation, copy locale/CMS precedence and existing booking payment-authority UI coverage. Behavioral fixtures explicitly select English; separate tests exercise Russian and identifier preservation.
- Production TypeScript and scoped ESLint passed; see PR for the final checkout checks.
- Repository reference generation and documentation checks passed; regenerate after final source changes.
- `npm run build` stopped at the existing content-review gate with `database_missing` because this checkout has no runtime database connection. Next compilation was therefore **not** reached. The gate was not bypassed and translations were not automatically approved.
- AST inventory of literal `getLabels` defaults in admin/ops found no unregistered keys after registration repair. This is a source coverage check, not proof that every rendered string is localized.

## Remaining acceptance and release limits

- Deploy a reviewed compatible release containing #335 and this follow-up through the existing protected release process; verify exact served SHA afterward. Full release/database prerequisites were not reassessed here.
- Populated Requests approval/decline layout, cash/transfer forms, other-role accounts, native devices and mobile Messages clearance remain open.
- Review the new Russian copy in the actual new release. Some dynamic process-health summaries, exceptional backend error messages, free-form user content and secondary enum/attribute paths still need a dedicated localization pass; do not claim every admin string is fixed.
- Complete and review Thai coverage, then inspect EN/RU/TH with long text and real data. Proper names and stored machine identifiers require separate treatment from translated UI labels.
- Durable before/after screenshots and visual verification of the new code remain open. All live observations above concern the old served code plus the explicitly documented content repairs.

No complete process, role isolation, accessibility compliance, production release or whole-platform UX acceptance is claimed.
