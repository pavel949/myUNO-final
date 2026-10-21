# Production readiness assessment

Follow-up: [release validation](../release-validation-2026-10-20/RELEASE_EVIDENCE.md) adds fresh production database and full isolated acceptance evidence. The access limitations and partial-test observations below describe the initial assessment, not that later verification.

**Decision: do not certify full production readiness. Evidence-based readiness rating: 5/10.** This is an assessor judgment about demonstrated readiness, not a measured percentage of functionality, uptime or defect freedom. Known release and scheduling issues independently prevent a positive conclusion. No exploitation or production money/data loss was established.

**Code/branch:** substantial implementation with successful exact-main CI; suitable to continue controlled release validation, not proof of complete acceptance. **Deployed operations:** older dependency-vulnerable revision is still serving; scheduling misses intended cadence; remaining release checks are unverified.

Scores use 1–2 = absent/severely deficient assurance, 3–4 = material confirmed gaps or limited evidence, 5–6 = partial assurance, 7–8 = strong implementation and repeatable test evidence, 9–10 = production acceptance plus measured operating evidence. Unknown is not a failed behavior; it limits assurance. Scores concern this repository/application scope, not every proposed future product. The rounded equal-weight mean is 5/10; it cannot override any release blocker.

| Area | Score /10 | Evidence and limitation |
|---|---:|---|
| Architecture and maintainability | 8 | 21 modules; centralized domain services and permission matrix; 118 models. Structure inspected, operational scale unproven. |
| Automated quality assurance | 8 | Local lint and typecheck pass; 93 focused tests and 44 policy tests pass; exact-main GitHub CI success includes integration tests, migration/drift and build. Local full suite unavailable. |
| Production dependency security | 3 | Live alias points to 8bb999a6; its lockfile audit reports 2 critical and 1 high vulnerable packages. Main lockfile reports zero. Exploitability not tested. |
| Authorization and privacy assurance | 6 | Scoped permissions, shared DB rate limiter and security headers inspected; session/header tests pass. Live cross-tenant API/SSR/media/export and Data API isolation not verified. |
| Booking and inventory integrity | 6 | DB exclusion migration covers confirmed/checked_in/pending_payment; quote and publication gates tested. Production constraint installation and concurrent buyers not verified; scheduler cadence deficient. |
| Payments and financial operations | 5 | Real Opn adapter and production mock rejection exist. Main CI critical regressions pass. Real provider charge/refund, ledger reconciliation and payout acceptance not verified. |
| Services and external integrations | 4 | Standalone context and service closure tests pass. WhatsApp/Telegram send and webhook adapters explicitly unavailable. Live channel round trip not verified. |
| Deployment and release control | 3 | Production is READY on older 8bb999a6; current main 1fa0309d is not serving. Git auto-deploy disabled. Production migration ledger and content-review state not verified. |
| Scheduling and operational monitoring | 2 | 7 GitHub scheduled runs in rolling 24h ending latest run; expected 288 for five-minute cadence; largest observed gap 292.3 minutes. Runtime error access returns 403. |
| Backup and recovery | 8 | Exact-main Backup workflow succeeded; steps confirm production dump, scratch restore/table comparison, encryption and storage. Complete app recovery and external reconciliation/RTO/RPO not measured. |
| UX, accessibility and localization assurance | 5 | 174 pages discovered; isolated browser acceptance succeeds on docs-only PR314, not a production acceptance run. Live role flows/mobile/keyboard/RU-EN-TH not inspected. |
| Performance and capacity assurance | 4 | Functions configured in bom1; deployment reports bom1. No load-test/Lighthouse benchmark located in filename search; no production p95, error rate or capacity measurements obtained. |

Independent facts:

- Production alias source differs from current main; dependency audit of its source lockfile has 3 vulnerable packages (2 critical, 1 high), compared with zero in main. Advisory severity does not establish reachability or exploitation; Windows-only advisories must not be represented as applicable to Vercel Linux.
- Scheduler history contains 7 scheduled runs in the 24-hour interval ending 2026-10-20 14:57:13 UTC (21:57:13 Bangkok); 288 are expected at five-minute frequency. These include all Scheduler scheduled events, so frequent-only coverage cannot be greater. Largest gap between observed runs in that interval is 292.3 minutes. This measures dispatch history, not individual database JobRun execution or demonstrated booking corruption.
- Local npm run build exits 1 with `production_bypass_refused`; local configuration requests disabled content review outside an approved isolated CI build. This is intended fail-closed behavior, not a proven application compile defect or evidence of current production review counts.
- Local full test run was interrupted after discovering missing DB/generated-client setup; it is neither a suite pass nor a credible product failure count. Prisma generation followed by production TypeScript check succeeds. Focused tests were rerun after generation and pass.

Release priorities:

1. Validate the current security-fixed revision on a staged production build, inspect production migration drift/content review, then release through existing controls and verify the alias SHA. This assessment did not deploy.
2. Supply reliable five-minute dispatch and verify each frequent job through fresh persisted JobRun records, missed-run alerting and replay tests.
3. Independently verify sender DNS and real email delivery; PR314 reports failure but it was not reconfirmed here.
4. Execute real end-to-end booking/payment/refund/payout and concurrent-capacity cases, plus cross-tenant read/write/media/export checks on the intended release.
5. Record release data/media/compliance reconciliation, mobile/keyboard/locales, production health/error/latency and a full recovery rehearsal with external payment reconciliation.

See [baseline](BASELINE.md), [release evidence](RELEASE_EVIDENCE.md), [gaps](GAPS.md), [capability and CO/AT ledger](FLOW_MATRIX.md), [surface map](SURFACE_MAP.md), [source-of-truth map](SOURCE_OF_TRUTH.md), and [data limitations](DATA_RECONCILIATION.md).
