# Process 5 — arrival: passports → check-in → TM30 → check-out

Local production build, throw-away DB; browser as guest and admin/front desk.

| Step | Result |
|---|---|
| Guest opens "Pre-arrival: passports" and adds two travellers | FIXED — date-of-birth field could never be submitted (`pattern="\\d{4}…"` doubled backslash → "Please match the requested format"). Same defect on the night-audit date field. Regression test added |
| Passport numbers stored encrypted (AES-GCM), never shown back in clear | PASS |
| Staff open guided check-in: party 2/2, passports received, readiness ready | PASS |
| Confirm check-in → `checked_in`, condition report saved, one TM30 filing per foreign guest, due 24 h from arrival day | PASS |
| TM30 queue: open filing decrypts passport and writes an access-log entry | PASS |
| Mark filed (both) → queue empty | PASS |
| Check-out from the stay page | FIXED — one click checked a guest out two days early with no inspection report; now opens the departure-inspection form. re-checked in the browser on the new build: inspection form opens, empty checklist refused, report saved |
| Staff-facing check-in footer was developer text | FIXED (plain staff wording) |

Not covered: TM30 escalation job (runs via the scheduler, covered by unit tests), real immigration portal (manual by design), passport retention deletion job.
