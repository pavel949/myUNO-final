# PMS remediation — 21 October 2026

Scope: local remediation of ten confirmed PMS bugs on main baseline `97ba836bdd4a07e28da9c9cdf4264fb4093c7e1e`, plus the confirmed booking-card refund recovery gap. No production writes, real payments, pushes or deployments.

## Behavior

- Reservation-group creation authorizes effective workspace units and guest eligibility inside its transaction.
- Guest-party/passport endpoints respect explicit reservations/front-desk department restrictions while retaining guest/admin access and the established legacy role policy.
- Bank-transfer recording uses the same finance permission as cash and rechecks authority under the inventory lock.
- Failed-refund resolution serializes source/refund state, makes write-off idempotent, never reopens succeeded refunds, and validates payment status/capacity before retry.
- Cancellation and requested refund records commit together. Persistence failure rolls cancellation back. Quote-bound same-actor retries return committed truth without another obligation or notification. Gateway dispatch follows commit.
- Booking lifecycle recovers bounded requested card work. Processing/unknown outcomes are not automatically replayed. Legacy failed card rows without provider evidence require reconciliation; no provider outcome is invented.
- Guest commercial date changes respect the property-local current day, preserving checked-in arrival and historical source-party factual reconciliation.
- Group forms retain drafts and unlock after failures, reset after success, and suppress concurrent pending submissions.
- Calendar departures include the first range day; occupancy remains half-open. Open details use refreshed cells; nonblocking requests remain available.

A nullable expand-only migration adds `Refund.dispatchAuthorizedAt`. New cancellation and known failed retry writers authorize dispatch; the claim consumes that timestamp. Historical requested rows remain null and are never automatically reauthorized. Existing requested Refund rows remain the durable work records. Apply the migration before running updated code; no production migration was performed. No automatic historical financial-data repair is included. Pet grandfathering and reschedule/cancellation-window commercial policies remain unchanged.

## Validation

The local implementation/validation report at `/workspace/pms-audit/FIXES.md` records exact final commands and counts. Tests use disposable loopback PostgreSQL, synthetic accounts, mocked gateway responses and local Chromium. Original diagnostic findings remain in `/workspace/pms-audit/REPORT.md` and distinguish audited main from the production commit supplied by the parent.

Production acceptance, real provider reconciliation and release approval remain separate. Deployment was not performed.
