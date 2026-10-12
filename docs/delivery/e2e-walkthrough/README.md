# End-to-end walkthrough of the platform's main processes (2026-10-12)

Every process below was checked in code, then clicked through in a real browser (Playwright/Chromium) against a **local production build and a throw-away database** — never the live database. Each folder has `RESULT.md` (step table) and screenshots.

| # | Process | Result |
|---|---|---|
| 1 | Guest: search → request → host approves → pay (cash/transfer) → cancel → refund paid back | 22/22 steps pass (re-run on final build) |
| 2 | Staff expense + private receipt → owner report → owner sign-off | pass |
| 3 | Owner statement → both sign-offs → payout → owner sees it | pass |
| 4 | Register, verify e-mail, login/logout, forgot/reset password | pass |
| 5 | Passports → check-in → TM30 → check-out | pass after fixes |
| 6 | Service order → cash → provider accepts → fulfils → review | pass after fixes |
| 7 | Website lead → CRM → admin pipeline → conversation | pass after fix |
| 8 | Owner submits property → admin review → draft → publication gates | pass (positive go-live path covered by integration tests only) |
| – | All 108 static routes × 10 roles (anonymous, guest, owner, ops, admin, MC, provider, juristic, resident, buyer) | no 5xx, no crashes; non-staff correctly bounced from staff areas |

## Defects found and fixed in this pass
1. Cash/transfer refunds could never be paid out (stuck forever, no ledger line) → `/ops/refunds`, `settleManualRefund`, guest sees "refund paid".
2. Guest booking page showed card + transfer details for a cash booking; transfer deadline (72 h) longer than the 24 h date hold; dispute panel before any charge; "original card" text for a cash refund.
3. Guest could not submit a date of birth for a passport (broken regex); same on night-audit date field.
4. One click on the stay page checked a guest out with no inspection.
5. Login lock-out of everyone behind one IP after 5 *successful* sign-ins.
6. Owner/payout figures rounded to whole baht (฿317 vs ฿316.80).
7. Service order page showed "NaN"/internal fields; list time in server zone; provider offered "Accept" on unpaid orders and got a generic 500.
8. Lead consent was only text, not in the PDPA journal.
9. Developer-speak on staff check-in; stale "checkout unverified / database repair" warning; area slugs in the wizard; duplicate `id="lead-form"`.

## Not checked / open (honest list)
- Real e-mail, Telegram, WhatsApp, Google sign-in, card provider: no credentials in the sandbox.
- Production photo storage: prod has 636 photos in Vercel Blob (verified by query); 67 still point at an old Supabase project and 10 at layantararesort.com — copy them into Blob.
- Vercel env vars unreadable from here (403): `BLOB_READ_WRITE_TOKEN`, `RESEND_API_KEY` presence not confirmed.
- Content keys added in this pass need to be seeded on prod (new SQL to be prepared on request): refunds screen, refund-paid text, unit price, provider "waiting for payment", check-in note wording, publication warning.
- Open audit items: revocable sessions (S3), unverified-email password registration (S4), ownership transfer recipient (F2), overlapping statement periods (F3), in-memory rate limiter on serverless, Layantara migration 20261006070000 (publishes 39 units — founder decision).
- One unreproduced client error (React #185) seen once during the crawl as ops user while leaving /ops/tm30.
