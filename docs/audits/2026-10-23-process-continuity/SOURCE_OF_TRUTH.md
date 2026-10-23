# Critical writer crosswalk
| Fact | Canonical writer / table | Reader / boundary | Preservation |
|---|---|---|---|
| Physical property | projects module / Unit, Project, InventoryCategory | Public card and operations | Multiple offers retain one Unit identity |
| Rate | core canonical pricing / PricingRule | Quote and price calendar | Named PostgreSQL exclusion pricing_rule_tariff_grid_no_overlap retained; historical booking snapshots unchanged |
| Occupancy | booking service / Booking and inventory locks | Calendar, quote, check-in | Shared physical capacity and database guards retained |
| Stay transition | booking checkInBooking/checkOutBooking through booking API | Stay 360 and guided check-in | Transition, condition evidence and TM30/turnover commit atomically in routes |
| Ready for next guest | ops operational-task service / OperationalTask | getUnitReadinessMap and assertUnitReadyForCheckIn | Cleaning and inspection are independent obligations; independent maintenance also blocks |
| Operational authority | resolveBookingOperationsAccess plus current mandate/workspace checks | Stay 360, guided check-in and arrival/departure APIs | Exact unit and department boundaries; guest self-service checked separately; no new global role |
| Money | finance services / Payment, LedgerEntry, OwnerStatement | Stay folio and owner reports | No production financial writes; no payment-provider acceptance claim |
| External event | integration inbox/checkpoint and jobs | Operational projections | No source cutover or authority reassignment in this change |

