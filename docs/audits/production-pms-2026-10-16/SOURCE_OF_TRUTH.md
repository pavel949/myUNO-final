# PMS facts and canonical writers

> **Датированный отчёт / evidence конкретного среза.** Текущее [описание системы](../../current/SYSTEM.md) и [матрица реализации](../../current/IMPLEMENTATION_STATUS.md); production факты ниже относятся к указанной дате/окружению.

| Fact | Writer / tables | Reader / scope | Evidence |
|---|---|---|---|
| Physical inventory | projects → Unit/InventoryCategory | public + scoped calendars | schema, project tests; live count only |
| Availability / holds | booking + core availability → Booking/BlockedDate | canonical pricing/search/calendar | DB overlap and concurrency tests; operational task does not create a parallel occupancy table |
| Rate / accepted quote | core canonical pricing → Booking snapshot | search/quote/booking/extension | canonical-pricing + date-change integration suites |
| Stay lifecycle | booking.service → Booking | Trip/Home Space + operations | property-to-financial-close and PMS transition races |
| Readiness | ops operational-task.service → OperationalTask | check-in + calendar + housekeeping | independent blocksInventory work now blocks arrival; cleaning cannot clear maintenance |
| Guest registration / TM30 | ops → BookingGuest/Tm30Filing | scoped staff; encrypted PII | reservation-guests, TM30, guest-pii tests |
| Money | finance → Payment/LedgerEntry/OwnerStatement/Payout | scoped finance and owner reports | immutable statements, payout/deposit/ledger and full close integration |
| Media | media direct-upload → MediaAsset; scoped proposal/gallery writer | employee draft/reviewer/public after approval | unit/client tests; real production upload not checked |
| Authority | core → Identity/RoleAssignment; operating scope | SSR/API/media access | scoped access, revocation and delegation tests |
| Jobs | src/jobs registry + dispatcher → JobRun | scheduler panel | production frequent run successful; daily fallback remains |

No new booking, payment, occupancy or owner-report authority was introduced by this follow-up. The two pending schema changes only extend bounded employee role/delegation shape.
