# Release validation — 20 October 2026

Application revision tested: `1fa0309d7e81f7948d8f58f414809771b604096f`.
Production alias independently rechecked at 23:22 Bangkok: still `8bb999a616a8bc781799f0d3e0800db3253e4117`.

**Decision: no production promotion performed.** An isolated production-mode build is validated; an actual unpromoted Vercel production deployment has not been created or validated. Read-only database verification succeeded, but both existing protected migration preflight routes failed. Scheduler activation, real email delivery and production runtime acceptance remain blocked as detailed below.

| Requested work | Completed evidence | Remaining / blocker |
|---|---|---|
| Validate revision, drift/content and release | Exact-main production-mode build passes; full local suite 557 files / 6,055 tests passes. Production ledger has no pending migrations under existing checksum policy; pending content review = 0. Public columns/defaults and constraints match fresh replay. | Protected preflight runs [39454787456](https://github.com/pavel949/myUNO-final/actions/runs/39454787456) and [39455351344](https://github.com/pavel949/myUNO-final/actions/runs/39455351344) both fail P1001/network_unreachable. No production release. New restricted-reader preflight change is not yet merged or exercised remotely. |
| Reliable five-minute scheduling | Versioned SQL dispatch and independent watchdog prepared; 13 PostgreSQL-backed tests pass, including concurrent dispatch, retry, stale/missing/failed per-job records and alert cooldown/recovery. Activation refuses incomplete acceptance. | Not installed or activated in production. pg_cron/pg_net are available but not enabled. Vault needs matching cron/protection credentials and an approved alert webhook. No claim of five-minute production operation. Latest three frequent JobRuns were 84.9 minutes old at the final observation. |
| Sender DNS and delivery | Fresh Google DNS responses: DKIM TXT, sender SPF TXT and sender MX names each return NXDOMAIN. | DNS owner must publish the exact Resend records. No callable Resend connector/provider credential in this environment; recipient remains unspecified. No real test email sent or delivery claimed. |
| Mock end-to-end, capacity and tenancy | 6,055 tests pass, including financial/payment/refund/payout, provider webhook, owner/manager/provider scope and private media/calendar export cases. 25-step real-browser booking journey passes, including eight independent contenders and foreign guest/manager denials. | Synthetic database and mocked provider transport; not a live-money or exhaustive production role matrix certification. |
| Reconciliation, UX, health and recovery | Production aggregate data recorded. Mobile/keyboard journey 5 steps; EN/RU/TH smoke 3 scenarios; zero captured page errors. 120-table dump/restore row/digest parity and mocked outage-refund reconciliation/replay pass. Fresh production backup/restore workflow succeeds. | Media byte coverage, authoritative operator/legal evidence and real provider liability reconciliation remain unverified. Production health/log access is denied. Local latency is not production latency. |

## Repeatable verification

- Full application suite: **557 files / 6,055 tests passed**, 696.12 seconds, disposable PostgreSQL 17.
- Updated migration/preflight/backup policies: **16 passed**.
- Actual PostgreSQL scheduler control functions with synthetic HTTP/Vault adapters: **13 passed**. No real webhook traffic.
- Production-mode Next 15.5.28 build: passed in a detached exact-main worktree with strict isolated credentials and blocked outbound HTTP.
- Real Chromium: founder/publication/booking **25 steps**, guest mobile/keyboard/services **5 steps**, EN/RU/TH migration smoke **3 scenarios**, all passed. Synthetic 1-pixel fixture photographs intentionally do not assess real photography quality.
- Recovery: **120 public tables** match after dump/restore. Replaying a confirmed mocked charge adds no payment; reconciling a provider refund completed during outage writes exactly one refund-out entry, including repeat delivery.
- Current-main production backup [39455356605](https://github.com/pavel949/myUNO-final/actions/runs/39455356605): successful dump, scratch restore/table parity, encryption and storage; encrypted artifact `12280796456`. No production restore performed.
- Local health: **30/30 successful DB-backed probes**, p50 8 ms / p95 16 ms / max 159 ms. This is a small loopback smoke measurement, not load testing or production SLO evidence.
- Lint and production TypeScript pass. Documentation/reference checks pass after generation.

## Production schema/data facts

The connected Supabase project is `burcnghheyzbzffzgmjz` (MyUno-final). All observations used read-only transactions and aggregate/schema metadata only.

- No pending migration in the existing policy; no unfinished/rolled-back active row or unapproved checksum mismatch. The existing audited comment-only checksum exception remains unchanged.
- Column/default hash `e611e745ab76dc28ccaf3cbc2537397a` and constraint hash `2731e7ea90ba195ab20b47a2d057fd78` equal a fresh migration replay.
- **Index drift exists:** production 464 indexes versus fresh replay 384: 80 additional production indexes, zero missing or changed common definitions. See [index-drift.json](index-drift.json). None were dropped or rewritten.
- 44 units marked live; none lack the permitted-use timestamp. 27 lack a direct unit cover; six lack both unit and category cover; five belong to a non-live project. These counts do not establish public visibility because publication gates also apply.
- 718 unencrypted photo metadata records, zero non-positive recorded byte sizes, 624 unit-media links and zero missing media-reference targets. Actual hosted bytes were not reconciled.
- Zero `regulatory_credential`, `compliance_record` and `unit_engagement` records at observation; stored permitted-use timestamps alone do not establish documentary authority. No legal/compliance approval inferred.
- No booking/payment rows at observation; three active service records. No authoritative external PMS/owner extracts were available for liability/source reconciliation.
- All public tables have RLS enabled; zero public SECURITY DEFINER functions. This is configuration evidence, not tenant/API penetration testing or proof of every RLS policy.
- Translation rows marked ok: EN 4,323, RU 4,323, TH 3,985, ZH 298. Zero pending review; uneven counts do not alone prove a missing translation because applicability/fallback vary.

## Changes prepared for review

1. Read-only preflight can use the existing canonical restricted backup reader. It validates project/principal/port/schema, forces TLS and one connection, and still establishes database-enforced READ ONLY before ledger access. The migration writer, backup requirement, exact-main CI and protected environment controls remain separate.
2. Private-schema scheduler SQL with a five-minute dispatcher, independent one-minute watchdog, persisted per-job verification after dispatch, bounded retries, overlap suppression, cooldown/recovery alerts and guarded activation. See [scheduler rollout](SCHEDULER_ROLLOUT.md).
3. Reproducible isolated recovery harness and a dedicated [CI workflow](../../../.github/workflows/recovery-scheduler.yml). No production credentials are used by those tests.

## Access/configuration needed to finish

- Merge/test the restricted-reader preflight through normal checks; require a successful fresh protected preflight and backup before staging/release. No writer credential was extracted or replaced.
- Vercel access that supports unpromoted production staging and protected-runtime checks. Current connection reads project/deployment metadata but protected health and runtime-error queries return 403; no authenticated CLI is available.
- Provision the existing matching scheduler credentials into Supabase Vault through a secure operator flow and select an alert destination; then execute the guarded rollout and observe persisted runs over multiple five-minute intervals. Do not set SCHEDULER_MODE=external merely because the SQL exists.
- DNS owner access to the sender zone, exact Resend DNS values from the account and a confirmed test recipient. Do not invent DKIM values or claim delivery from an accepted send request.

Evidence files here contain aggregate/schema data or synthetic test results only. No payment credential, auth cookie, passport, private address or raw production business row is included.
