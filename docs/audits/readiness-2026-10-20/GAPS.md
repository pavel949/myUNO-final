# Gaps

| ID / priority | Evidence | Impact / safest next step |
|---|---|---|
| G01 / P1 urgent security release | Vercel alias serves 8bb999a6; its source lockfile audit has 2 critical +1 high package findings | Security fixes in main are not deployed. Validate compatibility, staged build and release SHA; assess advisory applicability. No demonstrated exploit/P0 incident. |
| G02 / P1 automation | GitHub records 7 scheduled runs versus nominal 288 in sampled rolling day; max gap 292.3 minutes | Time-sensitive expiry/sync cannot rely on configured cadence. Establish reliable trigger and observe each JobRun; impact on individual bookings not measured. |
| G03 / P1 acceptance evidence | Protected runtime and database unavailable to assessor | Cannot certify production migrations, current content review, tenancy, money, inventory, media and role workflows. Run scoped live release acceptance. |
| G04 / P1 reported email delivery issue | Open docs-only PR314 reports failed Resend DNS on 19 October | Requires fresh provider/DNS and delivered-message verification. Not independently reconfirmed here. |
| G05 / P2 missing integration capability | messenger.ts returns MESSENGER_ADAPTER_UNAVAILABLE; webhook returns false | WhatsApp/Telegram are not functioning adapters; omit promises or complete integration if required for release. |
| G06 / P2 capacity evidence | No load/performance acceptance artifacts obtained | Define traffic targets; measure latency, throughput, DB saturation, image and mobile performance before scale claims. |

P1 denotes release significance, not proof of a security breach, financial loss or corrupt inventory. No P0 incident was established.
