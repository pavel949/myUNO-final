# ERD — Core Domain

Two diagrams: **what exists today** (verified against `prisma/schema.prisma`, 71 models) and
**the target shape** from the master specification. The gap between them is the Phase 1–3 backlog.

---

## 1. As-built (2026-08-18)

```mermaid
erDiagram
    Project ||--o{ Unit : contains
    Project ||--o{ Booking : scopes
    Project ||--o{ Announcement : hosts
    Project ||--o{ ProjectMedia : has

    Identity ||--o{ Unit : "owns (scalar FK)"
    Identity ||--o{ Booking : "guest of"
    Identity ||--o{ RoleAssignment : holds

    Unit ||--o{ Booking : "booked as"
    Unit ||--o{ BlockedDate : blocked
    Unit ||--o{ PricingRule : "dated price override"
    Unit ||--o{ UnitEngagement : "commercial terms"
    Unit ||--o{ UnitMedia : has
    Unit ||--o{ ComplianceRecord : evidences

    Booking ||--o{ BookingGuest : registers
    Booking ||--o{ BookingChange : "audit of changes"
    Booking ||--o{ Payment : "paid by"
    Booking ||--o{ LedgerEntry : posts
    Booking ||--o| DepositPreauth : "holds deposit"

    UnitEngagement ||--o{ OwnerStatement : settles
    OwnerStatement ||--o{ StatementLineItem : "line items"
    StatementLineItem }o--o| Booking : "traces to"

    Organization ||--o{ UnitEngagement : manages
    Organization ||--o{ RoleAssignment : scopes

    Project {
        uuid id PK
        string slug UK
        decimal latitude
        decimal longitude
        string timezone
        string_array amenityKeys "SSOT violation - untyped"
        enum status "draft|live|archived"
    }
    Unit {
        uuid id PK
        uuid projectId FK
        uuid ownerIdentityId FK "scalar - no history"
        enum unitType "ENUM not entity"
        string categoryKey "loose string - stands in for UnitType"
        string floor "free text"
        int baseNightlyThb "SSOT violation - price on unit"
        int minNights "SSOT violation - restriction on unit"
        string_array amenityKeys "SSOT violation"
        enum status
    }
    Booking {
        uuid id PK
        uuid unitId FK "cascade delete - risk"
        enum status "9 states"
        date startDate
        date endDate
        int totalThb
        jsonb priceBreakdown "snapshot - mutable"
        jsonb cancellationPolicySnapshot "snapshot - mutable"
        timestamp holdExpiresAt "hold is a column not an entity"
    }
    BlockedDate {
        uuid id PK
        uuid unitId FK
        enum reason "maintenance|owner_hold|ota_import|other"
    }
```

**Constraints added this session** (`20260818000014`):

- `booking_dates_ordered` — `CHECK (end_date > start_date)`
- `booking_no_overlap` — `EXCLUDE USING gist (unit_id WITH =, daterange(start_date, end_date,'[)') WITH &&) WHERE status IN ('confirmed','checked_in','pending_payment')`

**Missing relative to the master spec:** `SpaceNode`, `UnitType` (as an entity), `AmenityDefinition`
/ `AmenityAssignment`, `OwnershipPeriod`, `AccommodationProduct`, `InventoryPool`, `AvailabilityDay`,
`InventoryHold` (as an entity), `RatePlan`, `RestrictionRule`, `Quote`, `BookingItem`,
`ChannelMapping`.

---

## 2. Target shape

```mermaid
erDiagram
    Organization ||--o{ Project : owns
    Project ||--o{ SpaceNode : "structural tree"
    SpaceNode ||--o{ SpaceNode : "parent of"
    SpaceNode ||--o{ Unit : locates

    Project ||--o{ UnitType : defines
    UnitType ||--o{ Unit : classifies
    UnitType ||--o{ AccommodationProduct : "sold as"

    Unit ||--o{ OwnershipPeriod : "owned over time"
    Identity ||--o{ OwnershipPeriod : "owner in"
    OwnershipPeriod ||--o| ManagementAgreement : "governed by"

    AccommodationProduct ||--o{ InventoryPool : "fulfilled from"
    InventoryPool ||--o{ InventoryPoolUnit : includes
    Unit ||--o{ InventoryPoolUnit : "member of"

    AccommodationProduct ||--o{ RatePlan : priced by
    RatePlan ||--o{ RateRule : "dated rates"
    RatePlan ||--o{ RestrictionRule : constrains

    Quote ||--o{ QuoteLine : "priced lines"
    Quote ||--o| InventoryHold : reserves
    Quote ||--o| Booking : "becomes"

    Booking ||--o{ BookingItem : "one per unit sold"
    BookingItem }o--|| Unit : "allocated to"
    Booking ||--|| BookingSnapshot : "immutable economics"

    AmenityDefinition ||--o{ AmenityAssignment : "assigned by"
    AmenityAssignment }o--o| Project : "at project"
    AmenityAssignment }o--o| UnitType : "at type"
    AmenityAssignment }o--o| Unit : "at unit"

    OwnershipPeriod {
        uuid id PK
        uuid unitId FK
        uuid ownerIdentityId FK
        date effectiveFrom
        date effectiveTo "null = current"
    }
    InventoryHold {
        uuid id PK
        uuid poolId FK
        daterange dates
        timestamp expiresAt
        enum status
    }
    BookingSnapshot {
        uuid bookingId PK
        jsonb economics "immutable - trigger enforced"
        timestamp takenAt
    }
```

### Migration path (no destructive step required)

1. `UnitType` entity, backfilled from `Unit.categoryKey`; keep the string column until every read
   moves over.
2. `SpaceNode`, backfilled from `Unit.floor`; `Unit.spaceNodeId` nullable at first.
3. `OwnershipPeriod`, backfilled from `Unit.ownerIdentityId` as one open-ended row per unit. The
   scalar stays as a read-through cache until callers migrate.
4. `AmenityDefinition` / `AmenityAssignment`, backfilled from the two `String[]` columns.
5. `InventoryPool` + `unit_occupancy`, absorbing `Booking` and `BlockedDate` into one exclusion
   constraint — the correct resolution of **P0-4**.
6. `Quote` and `BookingItem` last: they change the checkout contract.

Every step is additive; each old column is dropped only once nothing reads it.
