# Guest registration / TM30 snapshot correction

Base: schema-independent PMS slice38e9e2f1. No schema, authority, authentication/session or legal-deadline change.

A deterministic actual-handler test pauses check-in after its outer empty-party read, commits an authorized foreign-guest registration, then resumes check-in. Baseline successfully checked in without the required filing. Late foreign registration on an already checked-in stay likewise created no filing, and a synthetic filing failure could not roll back that registration. Baseline: three failures, one existing-party/Thai case passed.

Correction:
- Check-in reads the filing party inside its existing transaction after canonical booking locking/eligibility. The response reports this actual filing count.
- Guest registration and passport capture share the existing unit→booking lock. Party row, encrypted passport, verification status and any late foreign-guest filing commit together.
- Existing late registration remains available. A foreign guest added after checked_in receives the existing canonical filing; the filing function and its deadline calculation are unchanged.
- Standalone passport updates acquire the same booking source lock. Existing registered guests and passport retry semantics remain unchanged.

Evidence: six new regression cases plus existing condition, permission, check-in, verification, filing and booking-race suites: seven suites /49 tests passed. Tests assert rollback, original passport handling, actual response filing count, duplicate check-in rejection, passport retries without duplicate filings, foreign-identity denial, and Thai no-filing behavior. Focused lint and production types are recorded in the evidence directory. No full suite/build/production HTTP on this separate follow-on yet.

Limit: guest POST has no request idempotency key; repeated successful registration requests retain the existing behavior of adding distinct guest rows. This patch creates one filing per newly registered foreign guest and does not introduce guest deduplication or alter party-count policy. Failed transactional requests can retry without an orphan guest or filing.

All evidence uses isolated synthetic data. No live filing submission, production query, external delivery or publication was performed. This checkpoint requires independent review before release integration.
