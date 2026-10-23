# Inspected process surfaces
| Surface | Actor / next step | Writer / permission | Evidence and limitation |
|---|---|---|---|
| /units/[id] → /book/review | Guest quotes and books | Canonical pricing, booking, finance | Baseline synthetic browser report: publication, quote, consent, booking, cancel and date release passed |
| /ops/stays/[bookingId] → /check-in | Authorized operator hands over stay | resolveBookingOperationsAccess.canManageFrontDesk → checkin API | Source trace found destination mismatch; page uses shared resolver in this branch; page tests are not browser proof |
| /api/bookings/[id]/check-out → /api/ops/tasks/[id] | Departure hands over to cleaning and inspection | Booking transaction, OperationalTask; task authorization | Added real PostgreSQL route regression, awaiting branch CI |
| /services/orders/[orderId] | Customer orders, fulfillment, confirm/dispute | Services and finance | Baseline synthetic browser report passed; actual provider delivery/external payment not proved |
| Employee and content workspaces | Scoped edits → review → canonical draft | Existing scoped grant/content services | Baseline synthetic browser reports passed; actual upload/email transport not proved |

Source-level UX differences requiring screenshot review before a visual redesign:
- Today: max-w-6xl; requests: max-w-4xl; housekeeping: max-w-7xl.
- Admin shell uses a 1500px maximum while StitchMain uses1280px.
- Messages has ivory/paper surfaces within a mint workspace shell.
Widths may legitimately differ for dense operational tables; the next change should define consistent shell/gutters and intentional content widths.

Subsequent read-only live desktop screenshots of deployed8bb999a confirmed /ops1028px versus /ops/requests896px at viewport1363 with the same256px rail. Messages content was212px tall inside a936px mint parent: the flex-1 inbox does not stretch inside block-level StitchConsumerShell. [Issue #334](https://github.com/pavel949/myUNO-final/issues/334) records evidence, minimal repair and acceptance. No data was changed. Live mobile screenshots of these exact screens were unavailable because the browser exposes no resize capability; synthetic /ops/spaces mobile acceptance is not a substitute.

