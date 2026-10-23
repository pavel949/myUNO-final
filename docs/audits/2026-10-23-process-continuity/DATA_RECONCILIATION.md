# Read-only production observations
Observed on 2026-10-23 through the existing Supabase connection; no personal records or secrets exported.

| Aggregate | Observed |
|---|---:|
| Units | 56: 44 live, 12 draft |
| Projects | 11: 1 live, 7 draft, 3 archived |
| Bookings | 0 |
| Active long-term rental offerings | 39 |
| Active short-stay offerings | 45 |
| Active short-stay offers with canonical_tariff_grid_v1 and verified tax policy | 40 |

These counts do not prove source parity, physical mapping, bookability or approved activation. In particular 0 bookings means no recorded production stay demonstrates the operational chain in this database.

Latest JobRun observations: booking_lifecycle, tm30_escalations and ical_sync finished with outcome ok at 2026-10-23T15:03:42Z; deposit_release, guest_lifecycle, metrics_rollup, preventive_maintenance, retention, service_order_expiry and verification_deadlines at 2026-10-22T22:13:09Z. Cadence/SLA and external delivery were not verified; an old successful row is not current scheduler-health proof.

Migration counts alone were not used to infer drift. Latest applied migration and missing column are in BASELINE. Full source-to-target entity reconciliation and protected migration parity remain open.

