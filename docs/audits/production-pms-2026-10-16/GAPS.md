# Findings and release decision

> **Датированный отчёт / evidence конкретного среза.** Текущее [описание системы](../../current/SYSTEM.md) и [матрица реализации](../../current/IMPLEMENTATION_STATUS.md); production факты ниже относятся к указанной дате/окружению.

| Priority | Finding | Evidence / impact | Action / owner |
|---|---|---|---|
| P1 | Check-in ignored blocking maintenance; calendar could show ready | assertUnitReadyForCheckIn filtered only cleaning/inspection. getUnitReadinessMap omitted blocksInventory. | Fixed on this branch: include all open blocking work, retain blocker after cleaning; regression and locale key added. Release operator must deploy. |
| P1 | Frequent scheduler manually disabled | GitHub workflow 351996574 disabled_manually; production last run 07:45 | Re-enabled and real dispatch succeeded at 10:50; verify recurring ticks. |
| Resolved | Application backup/restore prerequisite | Production run38896564642 captured120 public application tables; isolated restore matched every row count/digest; encrypted artifact12043314893 retained30days | Dedicated read-only principal and sealed secrets configured. Protected migration workflow repeats backup for exact main SHA. Managed infrastructure and external Blob recovery remain separate. |
| P1 | Production differs from tested main | Alias SHA408ad99a; /property, /property/content and direct-upload 404 | After backup, run explicit Prisma migration then deploy tested main to Vercel and verify served SHA. |
| P1 | Real photo upload not verified | Endpoint absent; no application login available | After deployment, use scoped test draft; upload valid small and >4.5MiB image ≤8MiB, retry finalize, reload saved gallery, reject invalid/oversize; remove only dedicated test data. |
| P2 | Content review gate would block current production build | 4213 needs_review, enabled by default | Content owner reviews drafts in existing editor; do not silently bypass governance. |
| P2 | Full procurement/owner-approval process not proven | Estimated/actual task cost exists; no completed purchase/receipt/approval chain proven | Operations/product owner must supply process acceptance evidence; expense recording is not procurement acceptance. |
| P2 | Non-empty production PMS flows unverified | Production canonical bookings/payments/orders all zero | Synthetic integration evidence retained; do not label all CO/AT complete. |
| P2 | Full-service RPO/RTO/external webhook replay not proven | Application DB restore passed in run38896564642; managed Supabase internals, Blob bytes, credentials and external side effects are outside that dump | Recovery owner verifies complete-service recovery objectives and external reconciliation before claiming AT30. |

NO-GO for full production readiness. Main CI is code evidence, not a release. Remaining commercial operating scope, provider/channel authority and source data must be verified independently.

Scheduler evidence: https://github.com/pavel949/myUNO-final/actions/runs/38889878798
