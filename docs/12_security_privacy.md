# 12 · Security & Data Privacy

**What this document is.** How the platform protects the most sensitive things it touches — passports, payment data, personal information — under Thailand's **PDPA**, and how the system itself is secured: authentication, permission enforcement, secrets, and the audit trail. Written so the founder can answer "how do you handle my passport?" truthfully and precisely.

---

## 1. The data inventory (what we hold, why, and how long)

| Data | Where (doc 02) | Lawful purpose | Protection | Retention |
|---|---|---|---|---|
| Passport number, DOB, nationality, latin name | `BookingGuest`, `Identity` 🔒 | **Legal obligation** — TM30 filing | Field-level encryption (§4); access-logged | Structured fields: as long as the booking record must exist (tax/immigration defensibility) |
| Passport image | `MediaAsset(kind=passport)` 🔒 | TM30 filing support | Envelope-encrypted object storage; signed, expiring URLs; access-logged | **Auto-deleted** `[cfg] retention.passport_media_days_after_checkout` (default 30) after check-out — the `delete_after` job |
| Payment card data | **Never touches our systems** | — | Cards are entered on the licensed provider's hosted checkout (doc 10 §1); we store only provider session/charge IDs | n/a |
| Contact data (email, phone) | `Identity` 🔒 | Contract performance, notifications | Encrypted at rest (DB-level), unique-indexed | Life of the account + legal minimum |
| Bank/payout details | `Provider.payout_method`, payout records 🔒 | Paying providers/owners | Field-level encryption | Life of the relationship |
| Mandates, receipts, compliance docs | `MediaAsset(document)` 🔒 | Contract, legal obligation | Encrypted bucket, role-gated | Contract life + statutory period |
| Messages, tickets, reviews | Communication tables | Contract performance | Standard at-rest encryption; participant-only access | Life of the account |
| Analytics events | `AnalyticsEvent` | Legitimate interest | Identity-linked events minimized; no 🔒 fields in payloads (§5) | 24 months, then aggregate-only |

**Minimization in practice:** owners see guests as "first name + country" (doc 03 §4); providers see contact/address only while an order is active; exports never include 🔒 fields; logs are scrubbed of PII by the logging helper.

## 2. PDPA posture

- **Controller:** the operating legal entity (⚠ Q16 — exact name goes into `legal.privacy` content).
- **Consent & notice:** registration and checkout consent lines link the privacy notice (`legal.privacy`, RU/EN/TH); passport capture screens carry the purpose explainer (`checkin.tm30.explainer` — "Thai immigration law requires…").
- **Data-subject rights:** access/export (account settings → "download my data" produces the identity's records minus others' data), rectification (profile editing; staff-assisted for records), deletion (account deletion anonymizes the identity — name → "Deleted user", contact fields nulled — while preserving financial/compliance records the law requires; the request and outcome are audit-logged).
- **Cross-border:** hosting region choice (doc 15) and the provider list are disclosed in the privacy notice.
- **Breach response:** §7.

## 3. Authentication & sessions

Password auth with bcrypt (cost ≥ 12); optional OAuth (Google/Apple); **rate-limited** login/reset/claim endpoints (per-IP and per-account, exponential backoff); single-use hashed tokens for reset/verify/claim (doc 02 §2.3) with TTLs from config; sessions as signed HTTP-only, `Secure`, `SameSite=Lax` cookies with rotation on privilege change; password change invalidates other sessions; admin accounts require strong passwords + (phase-marked) TOTP 2FA — the schema field exists from day one, enforcement configurable. Blocked identity (`status=blocked`) = immediate session kill (doc 03 §4).

## 4. Encryption & secrets

- **In transit:** TLS everywhere, HSTS; webhooks signature-verified.
- **At rest:** full-disk/DB-level encryption from the host, **plus field-level (application-layer) encryption** for 🔒-marked columns (passport numbers, payout details, integration credentials) with keys held in the deployment platform's secret manager — a DB dump alone never yields passports.
- **Objects:** the media bucket is private; `passport/document` kinds additionally envelope-encrypted; all access via short-lived signed URLs from the upload/download seam.
- **Secrets:** environment-injected via the platform's secret store (doc 15); never in the repo, never in client bundles; `.env` files git-ignored; per-environment values; rotation documented per integration in the admin's integration health view.

## 5. Permission enforcement & auditability

Every read and mutation passes the `can()` helper against `RoleAssignment` scope (doc 03 §5) **server-side**; queries are ownership-scoped in the `where` clause (never fetch-then-filter). 🔒 field access by staff (e.g. opening the TM30 queue's passport panel) writes an `AuditLog` row — "who saw whose passport, when" is answerable. All privileged mutations (config/content edits, role grants, statement publication, manual ledger/refund actions, retention overrides) are audit-logged append-only. Admin panel is role-gated at the layout level *and* per-action server-side.

## 6. Retention jobs

A daily job: deletes `MediaAsset` rows past `delete_after` (passport images), anonymizes deletion-requested identities past their grace window, expires stale `OneTimeToken`s, and reports counts to the admin compliance view (doc 08 §6.11) — retention is *visible*, not assumed.

## 7. Operational security & incident response

Dependency updates via automated PRs; no `eval`/dynamic SQL (Prisma parameterization); file uploads validated by type/size with strict stored-name scheme (legacy-proven traversal guard); CSP + standard security headers; error messages never leak internals (unified error page, details to logs only). **Incident playbook (plain language):** contain (revoke keys/sessions, disable integration), assess scope from audit/access logs, notify the founder immediately, notify affected persons and the PDPC when thresholds require (72-hour clock), record the post-mortem in the repo. Backups & restore drills are doc 15 §5.

## 8. What builders must never do

Store card numbers; log request bodies containing 🔒 fields; put PII in analytics payloads, URLs, or content keys; bypass the media seam for uploads; widen a query's scope to "fix" a permission bug; ship an endpoint without the `can()` check. These are review-blocking rules, restated in `CLAUDE.md`.
