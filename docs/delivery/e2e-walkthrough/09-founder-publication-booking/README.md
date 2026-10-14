# Reproducible isolated founder → publication → guest booking acceptance

## Status

Prepared after the historical PR #251 walkthrough and PR #254 description/publication fixes. **Do not treat the presence of this runner as a pass.** The authoritative evidence is the completed `Browser acceptance (isolated)` job for the exact candidate commit, its `result.json`, screenshots and Chromium traces.

The first production-browser runs caught a real publication-feedback defect: the validated live response was persisted, but route refresh detached the success/review link before it could be clicked. The UI now retains the server-confirmed row status and feedback without refreshing that successful status transition. Other actions still refresh, and subsequent server props remain authoritative. The browser continues to click the actual review link; it does not bypass this failure with a direct URL or a forced click.

## Scope

The existing walkthrough remains useful historical evidence. Its guest script uses a missing local `lib.mjs`, hard-coded filesystem/record/date values, and a placeholder assertion for calendar release. Process 8 explicitly excludes positive browser go-live and the tariff editor. This runnable slice closes that specific regression gap without adding a second application or mocking route success.

The fixture is a fully synthetic, already-onboarded canonical `villa_estate` with one draft unit, owner, founder, guest, category/rate plan, local image bytes, private synthetic regulatory evidence, engagement and seven completed mobilization prerequisites. The unit is not published by setup. The browser must:

1. Prove the draft's public API is private and anonymous admin access redirects.
2. Log the founder in through the real login form (real server-issued secure session).
3. Follow the description deep link, save the English text using the actual content-row ID, reload, and verify the persisted translation.
4. Add an all-year nightly tariff, save 1,234 THB/night, reload and verify 123,400 satang in the canonical offering.
5. Publish through the units UI, check response/state, and follow the publication panel's public link.
6. Open the anonymous guest card, see the saved description and 3,702 THB three-night quote.
7. Sign in as the synthetic guest and prove admin content access is denied.
8. Reserve through the guest card, review, explicit consent and cash selection. Verify exactly one real booking with the quoted total and a live manual-payment hold. No payment is collected.
9. Open the founder calendar night, inspect its hold, and follow its canonical booking identity. Independently verify the public quote reports the dates unavailable.
10. Cancel through the guest UI; verify the canonical row, date release and free calendar cell.

Unexpected local 5xx responses and browser runtime exceptions fail the run. Each completed step has a screenshot. Failures produce a nonzero exit and preserve traces/screenshots.

## Safe execution

The workflow uses a fresh GitHub Actions PostgreSQL 16 service named `myuno_browser_test`, the real migration chain and a local production Next.js build. It has read-only repository permissions, no environment binding, no repository secrets, no deployment steps, and no production URLs. It installs the exact official Playwright library version into the runner's temporary directory and Chromium through Playwright; the application's lockfile and dependency tree are unchanged.

The guard requires the exact loopback database URL and synthetic auth/encryption values. A same-named remote DB, a mismatched app/test database, a nonlocal app URL, runtime `.env` files and known provider secrets are refused. Setup never invokes `resetDb`, truncation, `db push`, production seeding or migration repair; rerunning against an existing fixture refuses rather than deleting it. The CI service is discarded after the run.

Browser requests outside localhost are aborted and their origins recorded. Node fetch/http/https egress is guarded; an attempted external server request fails the job. This is an application-HTTP guard, not an operating-system network sandbox. No provider credentials are supplied. Anonymous maps or other third-party browser assets may be intentionally blocked; the report records those origins separately from application failures.

To run on a reviewed branch, open/update its PR and inspect **Browser acceptance (isolated) → founder-publication-booking** for that exact SHA. A successful build or historical screenshot is not acceptance. The workflow can also be manually dispatched once registered on the default branch. Do not point the scripts at a preview or production environment.

## Explicit exclusions

This does not test the owner onboarding wizard, photo upload to hosted storage, legal verification by a human, payment settlement/refunds, e-mail/Telegram delivery, Google sign-in, external channel synchronization, mobile layout, source-controlled Layantara cutover or production runtime. Seeded legal/checklist prerequisites are test setup, not evidence that those user workflows passed. The cash path proves a reservation and occupancy hold, not payment completion. Auth generation/revocation and vault behavior need their own security acceptance.

## Runner reference

This intentionally retains the existing walkthrough's lightweight Playwright Library style. See [official library usage](https://playwright.dev/docs/library) and the [pinned release](https://github.com/microsoft/playwright/releases/tag/v1.56.1). A larger browser suite should consolidate these steps into Playwright Test rather than create another parallel harness.
