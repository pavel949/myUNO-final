# Security policy

This platform holds passport data, payment records and personal information for
guests, owners and staff, under Thailand's PDPA. Security reports are treated as
production incidents, not feature requests.

## Reporting a vulnerability

Email **security@ignatevestate.com** with:

- what you found and where (URL, endpoint, or file),
- the steps to reproduce it,
- what an attacker could reach with it.

Please report privately. Do not open a public issue, and do not post details in a
pull request or commit message — this repository's issue tracker is world-visible
to everyone with repo access, and a description of a live hole is itself a risk.

We aim to acknowledge within **2 business days** and to tell you our assessment
and intended fix within **10 business days**.

Please do not test against production. Anything that would create, modify or read
real guest data belongs on a staging environment; ask and we will provide one.

## What we consider high severity

Ranked by what they expose, not by how clever the bug is:

| Class | Why it ranks here |
|---|---|
| Access to 🔒 fields (passports, dates of birth) | PDPA breach; the data cannot be un-disclosed |
| Cross-scope data access (one owner reading another's units, statements or guests) | The scoping rule in doc 03 is the product's core promise |
| Anything that moves money without authorisation | Deposits, captures, refunds, payouts, statement sign-off |
| Authentication or session compromise | Leads to all of the above |
| Stored XSS in admin-editable content | Content editors reach every visitor; see `serializeJsonLd` in `src/lib/seo.ts` |
| Ledger tampering | The ledger is append-only by design; a write path that breaks that breaks the audit trail |

## Handling secrets

`ENCRYPTION_KEY` (AES-256-GCM) encrypts passport data. It has one property that
makes it unlike every other secret here: **once it has encrypted data it can
never be changed or lost.** A different key means permanent decryption failure
and unrecoverable records. It is never rotated casually, never committed, and
never pasted into a chat or issue. See `docs/15_deployment.md` §4.

If you believe any secret has been exposed — in a commit, a log, a screenshot, a
build output — report it through the address above and treat it as compromised
until confirmed otherwise. For `ENCRYPTION_KEY` specifically, the response is to
encrypt new data under a new key and migrate existing fields individually, never
a straight rotation.

## Scope

This policy covers this repository and the deployed myUNO platform. Third-party
services it integrates with (the payment provider, messaging channels, the
managed database) have their own disclosure programmes; report issues in those
products to their vendors.
