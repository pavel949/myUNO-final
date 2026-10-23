# Execution evidence and release boundary
Baseline PR #330 was merged after:
- [Full CI 39992685950](https://github.com/pavel949/myUNO-final/actions/runs/39992685950): 6284 tests in 584 files, lint, production typecheck/build, fresh migrations, drift verification, isolated backup/restore.
- [Browser 39992685321](https://github.com/pavel949/myUNO-final/actions/runs/39992685321): publication/booking, guest/operator operations, service fulfillment, employee/content workflows and navigation passed with synthetic data.
- [Recovery scheduler 39992685386](https://github.com/pavel949/myUNO-final/actions/runs/39992685386): passed.
The tested head 53ce962030a53bbadd07919c9376fbade47fda11 has the same file tree as baseline merge a572326. This does not assert a separate push workflow on the merge SHA.

This branch:
- Local focused run: 45 tests passed (7 guided page access, 16 shared operation-policy tests, 22 canonical check-in gate tests). All30 browser isolation/egress/navigation guards passed separately.
- Targeted ESLint and CI-equivalent production typecheck passed; reference/docs checks passed.
- Plain tsc --noEmit also includes legacy test and delivery-fixture files and fails there; it is not the repository CI typecheck. The actual CI command is tsc --noEmit --project tsconfig.production.json.
- New PostgreSQL route regression: checkout creates exactly two obligations; next arrival returns409 without condition/TM30 writes; cleaning alone and inspected-but-not-ready both remain blocked; completing both tasks permits check-in with one baseline and one foreign-guest filing. Full CI must execute this before merge.
- Four additional route regressions apply department restrictions to arrival/departure without writes on403, admit the same operator after a Front Desk grant, and preserve guest self-service. The final code revision is ec712ff4cc415acd5151112c4ac43f3e3d74af99.
- Exact-head CI/browser/recovery results will be recorded in the pull request after execution; this document does not predeclare them.

Production cutover: NO-GO pending protected migration configuration, exact-main checks, fresh backup/restore, successful migration/parity, staged deployment and authenticated runtime acceptance. No manual bypass, ledger repair or weakened exclusion constraint is proposed. Existing external bookings/tariffs/domains remain untouched.

Read-only live desktop UX observations were subsequently added to [issue #334](https://github.com/pavel949/myUNO-final/issues/334). They concern deployed8bb999a, not this branch. Mobile verification of those exact screens remains open.

