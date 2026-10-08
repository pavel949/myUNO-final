# Current-build HTTP smoke - 9 October 2026 (Phuket)

**PASS: 24/24; failed: 0.** Runtime application: `79dcba041362ff933d938c39c018cfaf1fc945f1`. Workspace documentation HEAD at execution: `edb1aec42186105ec9a5989157ef0820e6fdae1c`. Completed UTC: `2026-10-08T21:37:53.348Z`. This repeats the same 24 assertions used at the previous checkpoint; no product code, feature, assertion or readiness rule was changed.

The existing Next production build was reused without running the full suite or build again. Build ID: `4GcRDb3qFPh74MWsnUNDZ`; BUILD_ID SHA-256 before and after: `0026e5b7ebf6d072e4d814a4ebc145afdd10a1816849991594d9ab481a0c90a5`. Application sources matched 79dcba04; only audit documentation differed. Origin: `http://127.0.0.1:3010`; database: isolated PostgreSQL at `127.0.0.1:55432/myuno_night_test`.

The prior synthetic fixture scheme was reused: one clearly labeled test project, instant/request units, dates 2027-03-01 through 2027-03-04, one private requested booking and three repository UI screenshots. No property photography, real inventory, authentication credentials or live payment was created. Exact request IDs and response evidence are in `card-policy-http-smoke.json`; table placeholders below refer only to synthetic fixture IDs.

| # | Actual HTTP assertion | Observed result |
|---|---|---|
| 1 | dated discovery returns both ready synthetic units | PASS - HTTP 200 |
| 2 | instant unit detail has its own gallery and availability | PASS - HTTP 200; exact-unit gallery, 3 images |
| 3 | instant direct quote retains integer consent amount | PASS - HTTP 200; 1875000 satang |
| 4 | instant category quote retains booking mode and signed consent | PASS - HTTP 200; signed quote and server booking mode |
| 5 | request unit detail has its own gallery and availability | PASS - HTTP 200; exact-unit gallery, 3 images |
| 6 | request direct quote retains integer consent amount | PASS - HTTP 200; 1500000 satang |
| 7 | request category quote retains booking mode and signed consent | PASS - HTTP 200; signed quote and server booking mode |
| 8 | public page /search renders | PASS - HTTP 200 |
| 9 | public page /projects/local-night-qa renders | PASS - HTTP 200 |
| 10 | public page /units/{instantUnit} renders | PASS - HTTP 200 |
| 11 | public page /units/{requestUnit} renders | PASS - HTTP 200 |
| 12 | public page /book/review renders | PASS - HTTP 200 |
| 13 | synthetic fixture media is served locally | PASS - HTTP 200 |
| 14 | anonymous /ops is protected | PASS - HTTP 200; streamed redirect to /login?next=/ops |
| 15 | anonymous /ops/calendar/board is protected | PASS - HTTP 200; streamed redirect to /login?next=/ops/calendar/board |
| 16 | anonymous /owner is protected | PASS - HTTP 200; streamed redirect to /login?next=/owner |
| 17 | anonymous /mc is protected | PASS - HTTP 200; streamed redirect to /login?next=/mc |
| 18 | anonymous POST /api/bookings is denied | PASS - HTTP 401 |
| 19 | anonymous GET /api/bookings is denied | PASS - HTTP 401 |
| 20 | anonymous GET /api/bookings/me is denied | PASS - HTTP 401 |
| 21 | anonymous GET /api/bookings/{privateBooking} is denied | PASS - HTTP 401 |
| 22 | anonymous POST /api/bookings/{privateBooking}/cancel is denied | PASS - HTTP 401 |
| 23 | anonymous POST /api/owner-stays is denied | PASS - HTTP 401 |
| 24 | anonymous POST /api/ops/reservations is denied | PASS - HTTP 401 |

For the four protected pages, Next returned HTTP 200 containing its streamed login redirect. The assertions checked that redirect and login destination; they do not claim a 3xx transport response or browser execution. The seven protected API checks all returned HTTP 401. Public-page checks verified HTML and the CSP frame-ancestors restriction, not hydration or interactive behavior.

Cleanup passed: only task-owned Next PID `24188` and the verified task-owned PostgreSQL were stopped. Exactly the three created QA image copies and their empty task directory were removed. Ports 3010 and 55432 had no listener afterward; working tree was clean before this documentation update. No production scheduler, provider, push, merge, preview or deployment was run.

The parent reported that the exact 79dcba04 patch passed limited independent static review with matching SHA and no material regressions in scope. The reviewer did not independently execute tests, build or DB gates; earlier execution evidence remains attributed to this implementation task.

Browser E2E, authenticated interactive guest/operator/owner journeys, real media/content approval and live external integrations remain **NOT RUN**. Expected anonymous-401 logs and missing translations for deliberately synthetic category keys do not constitute those unperformed checks.
