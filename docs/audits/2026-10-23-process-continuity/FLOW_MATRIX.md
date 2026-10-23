# Flow evidence ledger

This checkpoint does not certify any entire CO/AT process in production. “Partial” names executed or inspected subflows, never all passport outcomes. Baseline evidence is scoped to a572326/PR330; new implementation to21f378a. Production differs (BASELINE.md). Unlisted subflows remain not checked.

| ID | Process | Main / branch evidence | Runtime | Next condition |
|---|---|---|---|---|
| CO01 | Lead intake | Not checked in this checkpoint | Not checked end to end | Trace and execute full passport |
| CO02 | Qualification | Not checked in this checkpoint | Not checked end to end | Trace and execute full passport |
| CO03 | Partner sourcing | Not checked in this checkpoint | Not checked end to end | Trace and execute full passport |
| CO04 | Owner acquisition | Not checked in this checkpoint | Not checked end to end | Trace and execute full passport |
| CO05 | Property onboarding | Partial: Synthetic property submission/employee creation → reviewed canonical draft; activation excluded | Not checked end to end | Complete remaining passport, release and live acceptance |
| CO06 | Rates/distribution | Partial: Tariff edit/seasonal quote browser checks and exclusion regressions; OTA ARI excluded | Not checked end to end | Complete remaining passport, release and live acceptance |
| CO07 | Booking | Partial: Publication → guest consent → booking → cash receipt/cancel; external card acceptance excluded | Not checked end to end | Complete remaining passport, release and live acceptance |
| CO08 | Pre-arrival | Partial: Party/passport gate tests; full pre-arrival UI handover not checked | Not checked end to end | Complete remaining passport, release and live acceptance |
| CO09 | Check-in | Partial: Canonical gate + new scoped destination regression; full role browser arrival not checked | Not checked end to end | Complete remaining passport, release and live acceptance |
| CO10 | In-stay request | Partial: Synthetic standalone support/navigation passed; full SLA routing not checked | Not checked end to end | Complete remaining passport, release and live acceptance |
| CO11 | Housekeeping | Partial: Task browser operations passed; new checkout→turnover→arrival route case pending CI | Not checked end to end | Complete remaining passport, release and live acceptance |
| CO12 | Maintenance | Not checked in this checkpoint | Not checked end to end | Trace and execute full passport |
| CO13 | Food and beverage | Not checked in this checkpoint | Not checked end to end | Trace and execute full passport |
| CO14 | Service order | Partial: Synthetic standalone order → cash fulfillment → customer confirmation/dispute | Not checked end to end | Complete remaining passport, release and live acceptance |
| CO15 | Checkout | Partial: Condition evidence/atomicity route tests; new handover chain pending CI | Not checked end to end | Complete remaining passport, release and live acceptance |
| CO16 | Cancel/extend | Partial: Browser cancellation and hold expiry passed; extension funding not checked | Not checked end to end | Complete remaining passport, release and live acceptance |
| CO17 | Incident/dispute | Partial: Service dispute branch passed; complete incident remedy not checked | Not checked end to end | Complete remaining passport, release and live acceptance |
| CO18 | Procurement | Not checked in this checkpoint | Not checked end to end | Trace and execute full passport |
| CO19 | Financial close | Partial: Property-to-financial-close integration exists/passed baseline suite; real payout not checked | Not checked end to end | Complete remaining passport, release and live acceptance |
| CO20 | Owner approval/capex | Not checked in this checkpoint | Not checked end to end | Trace and execute full passport |
| CO21 | Owner stay | Not checked in this checkpoint | Not checked end to end | Trace and execute full passport |
| CO22 | Staff lifecycle | Partial: Employee invite/delegation/revoke synthetic browser checks; real email excluded | Not checked end to end | Complete remaining passport, release and live acceptance |
| CO23 | Provider lifecycle | Not checked in this checkpoint | Not checked end to end | Trace and execute full passport |
| CO24 | Content/media | Partial: Scoped content proposal/review/public render passed; real upload excluded | Not checked end to end | Complete remaining passport, release and live acceptance |
| CO25 | Standards | Not checked in this checkpoint | Not checked end to end | Trace and execute full passport |
| CO26 | Guest to owner | Not checked in this checkpoint | Not checked end to end | Trace and execute full passport |
| CO27 | Ownership/operator change | Not checked in this checkpoint | Not checked end to end | Trace and execute full passport |
| CO28 | Offboarding | Not checked in this checkpoint | Not checked end to end | Trace and execute full passport |
| CO29 | Integration recovery | Partial: Isolated migration/restore/recovery CI passed; live scheduler cadence not checked | Not checked end to end | Complete remaining passport, release and live acceptance |
| CO30 | Leadership review | Not checked in this checkpoint | Not checked end to end | Trace and execute full passport |

| Acceptance | Status | Evidence / limit |
|---|---|---|
| AT01 | Partial | Partial: synthetic standalone order/fulfillment browser checks |
| AT02 | Not checked | Not checked against the complete acceptance contract in this checkpoint |
| AT03 | Not checked | Not checked against the complete acceptance contract in this checkpoint |
| AT04 | Not checked | Not checked against the complete acceptance contract in this checkpoint |
| AT05 | Not checked | Not checked against the complete acceptance contract in this checkpoint |
| AT06 | Not checked | Not checked against the complete acceptance contract in this checkpoint |
| AT07 | Not checked | Not checked against the complete acceptance contract in this checkpoint |
| AT08 | Partial | Partial: browser dispute blocks customer confirmation; full close race not assessed here |
| AT09 | Not checked | Not checked against the complete acceptance contract in this checkpoint |
| AT10 | Not checked | Not checked against the complete acceptance contract in this checkpoint |
| AT11 | Not checked | Not checked against the complete acceptance contract in this checkpoint |
| AT12 | Not checked | Not checked against the complete acceptance contract in this checkpoint |
| AT13 | Not checked | Not checked against the complete acceptance contract in this checkpoint |
| AT14 | Not checked | Not checked against the complete acceptance contract in this checkpoint |
| AT15 | Not checked | Not checked against the complete acceptance contract in this checkpoint |
| AT16 | Partial | Partial: property/employee draft and pricing publication subflows; full operating readiness not certified |
| AT17 | Not checked | Not checked against the complete acceptance contract in this checkpoint |
| AT18 | Not checked | Not checked against the complete acceptance contract in this checkpoint |
| AT19 | Partial | Partial: seasonal booking quote passed; extension across boundary not checked |
| AT20 | Not checked | Not checked against the complete acceptance contract in this checkpoint |
| AT21 | Not checked | Not checked against the complete acceptance contract in this checkpoint |
| AT22 | Not checked | Not checked against the complete acceptance contract in this checkpoint |
| AT23 | Partial | Partial: invite/delegation/revocation browser reports; complete reassignment acceptance not checked |
| AT24 | Partial | Partial: new checkout→cleaning→inspection→next-arrival route regression pending CI; existing independent maintenance blocker tests passed baseline; no full browser chain |
| AT25 | Not checked | Not checked against the complete acceptance contract in this checkpoint |
| AT26 | Not checked | Not checked against the complete acceptance contract in this checkpoint |
| AT27 | Not checked | Not checked against the complete acceptance contract in this checkpoint |
| AT28 | Partial | Partial: employee/guest/scoped content foreign-resource checks; all API/SSR/media/export surfaces not certified |
| AT29 | Partial | Partial: selected mobile/locale/keyboard browser cases; full cross-product slow-network matrix not checked |
| AT30 | Partial | Partial: disposable migration/restore and recovery CI; production objectives and external effects recovery not certified |

## Nine readiness dimensions
Values refer to the named scope only, not the whole capability.

| Capability | Specification | Code | Migration | Data/config | Permission | UI | Test | Deploy | Runtime |
|---|---|---|---|---|---|---|---|---|---|
| Guided check-in destination fix | verified | verified (branch) | not applicable | not checked live | partial (shared resolver/page tests) | partial (source/page tests) | partial (local40; CI pending) | not checked for new code | not checked live |
| Canonical tariff matrix | verified | verified (main) | failed (absent production column) | partial | partial | partial (synthetic browser) | verified (baseline CI) | failed (old served SHA) | not checked live |
| Departure/turnover/next arrival | verified | verified (main, new test branch) | not checked live | not checked live | partial | partial | partial (baseline and pending new case) | not checked at current code | not checked live |
| Services and finance | verified | partial | not checked | not checked | partial | partial (synthetic browser) | partial | not checked at current code | not checked live |
| Migration/recovery | verified | partial | partial (isolated replay) | failed (migration credential unresolved) | partial | not applicable | partial | partial | not checked end to end |

