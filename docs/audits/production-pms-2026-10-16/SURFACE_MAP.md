# PMS surfaces

> **Датированный отчёт / evidence конкретного среза.** Текущее [описание системы](../../current/SYSTEM.md) и [матрица реализации](../../current/IMPLEMENTATION_STATUS.md); production факты ниже относятся к указанной дате/окружению.

Anonymous HTTP checks are transport checks only. Next.js streamed redirects can retain HTTP200; they do not prove an authenticated page works. No private response body or PII is stored here.

| Surface | Actor / action → writer | Production observation | Tested-main evidence |
|---|---|---|---|
| / and /login | visitor discovery/login | HTTP200, public alias reachable | browser journeys |
| /property, /property/content | scoped employee → proposals | HTTP404 | employee-workspaces / creation browser suites |
| /api/media/direct-upload | scoped employee → MediaAsset | HTTP404 | direct-upload policy/service/client tests; remote bytes not checked |
| /ops, /ops/calendar/board | staff → derived Booking/BlockedDate/OperationalTask | HTTP200 transport only; authenticated UX not checked | calendar + browser booking journey |
| /ops/requests, /ops/tasks | scoped staff → task/ticket transition | requests HTTP200 transport only | operating-space access/governance, task concurrency |
| /ops/housekeeping | assigned department → readiness | not checked | check-in/readiness regression; browser checklist not complete |
| /ops/tm30 | scoped front office → filing | HTTP200 transport only | queue/filing/guest PII integration tests |
| /ops/costs | scoped staff → finance cost/receipt | HTTP200 transport only | manual-cost/expense-owner-report integration |
| /trips, /bookings/[id]/home-space | guest → own canonical stay/support | authenticated production not checked | guest-ux/home-space browser + integration |
| /owner/statements | owner → published immutable read model | authenticated production not checked | owner visibility + financial close integration |
| /app/admin/scheduler | admin → derived JobRun health | authenticated production not checked | live SQL and successful actual scheduler dispatch |

Mobile/EN/RU/TH acceptance is partial: existing 320/430px navigation screenshots are verified for main's identical tree, but not every PMS screen/state/locale. New blocked-readiness label has EN/RU/TH drafts; content review remains explicit.
