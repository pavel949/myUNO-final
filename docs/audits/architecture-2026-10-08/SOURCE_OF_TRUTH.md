# Source-of-truth / writer contract

| Fact | Canonical records/writer | Consumers | Boundary/constraint | Gap |
|---|---|---|---|---|
| Physical unit | Project/InventoryCategory/Unit,projects/onboarding commands | public,search,ops,owner | one physical inventory identity | missing stable destination membership; no ordinary-property DBfork |
| Reservation/hold | Booking,booking.service create/change | availability/calendar/guest/ops | advisoryunit lock,SQL exclusion,serverquote | stale checkin/out validation, manual-command idempotency |
| Unavailability | BlockedDate,availabilitymanualblock/channel intake | quote/search/booking/calendar | same physical unit and halfopenrange | taskblocksInventory not canonical writer |
| Tariff | category/BAR RatePlan/PricingRule,canonicalpricing/tariffeditor | quotes/calendar/acceptedBooking | server price,immutable accepted snapshot | rulecheck/create race; historical branchrateauthority assertions must reconcile |
| Permission | Identity/RoleAssignment/Org/UnitEngagement/OperatingSpace | SSR,API,commands/media | source role/currentstate | genericcan vs mandate/capability policy split |
| Payment | Payment,verifiedprovider/cash transaction | booking/ledger/refunds | amount/payer/status/transactionlock | externalresult reconciliation/idempotency edge cases |
| Ledger/payout | LedgerEntry/Payout,financialwriters | statements/remittance/reconciliation | appendonly;uniquepayout consequence | repeatablemanualreverse, mutableproviderrecognition/currentcommission |
| Operational work | OperationalTask/PreventiveMaintenancePlan | queues/readiness/calendar | canonical task state | readinesspredicate drift, CAS/occurrence/capability gaps |
| Federation | ExternalSystem/ExternalMapping/ExternalEventInbox/Checkpoint | Layantara booking/protection commands | key+environment,eventhash,versionfence | genericnew PMS adapter still requires authority/command/recovery contracts |
| Editorial/trust | ContentKey/Translation/media/activeengagement | publicDTOs/labels | approvedpublicfields/privateevidence separation | reviewstatus semantics, scopedcache/destinationcopy |

Exact file:line, writer-to-consumer traces and remedies in five detailed domain reports. AuditLog is actor evidence, analytics telemetry is not domain state; publicread projections must never grant booking authority.
