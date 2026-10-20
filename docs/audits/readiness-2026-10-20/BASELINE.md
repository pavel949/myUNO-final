# Baseline — 20 October 2026 (Asia/Bangkok)

Repository: pavel949/myUNO-final. Checkout and independently queried GitHub main: `1fa0309d7e81f7948d8f58f414809771b604096f`. Working tree initially clean. Assessment changes are reports only; no application, production configuration, migration or release changes.

Vercel project `prj_GonhJLt1m9T060dxDBnSZtuiiWYj`, team `team_yhQPVQRquxdAw8pzvG4Lvfe1`. Alias `my-uno-final.vercel.app` resolves to deployment `dpl_DBLCzT2HfMDARmWviY7LqHWAMkjr`, READY, production, bom1; source `8bb999a616a8bc781799f0d3e0800db3253e4117`. Verified through connected Vercel get_alias/get_deployment calls during this assessment. Source lockfile: Next 14.2.35, MapLibre 4.7.1. Main: Next 15.5.28, MapLibre 6.15.0. Production artifact bytes were not downloaded or inspected.

No production DB credentials are configured in the cloud environment. Local .env database selectors point to loopback, with a separate test DB name; local port 5432 refuses connections. No production DB was queried. Vercel runtime-error and protected health access returned 403; no Vercel CLI available. Consequently production migrations, data, runtime health, tenancy, latency and business acceptance remain unverified.

GitHub PR314 is documentation only and remains open. Its email/DNS and pending-migration observations are secondary reports, not fresh independent verification. Other open PRs are not counted as delivered features.
