# Attribute Ownership Matrix

Which entity is the single source of truth for each attribute, who may change it, and whether a
change reaches a confirmed booking.

**Resolution order (target):** unit override → unit-type value → project default → organization
default. Inheritance is **opt-in per attribute**, never blanket — a legal unit number must never
inherit, and a project address must never be overridden.

Legend — **Today**: where the value actually lives now. **Target**: where the master spec puts it.
✅ aligned · ⚠️ SSOT violation · ❌ absent.

---

## Project

| Attribute | Today | Target | Inheritable | Editable by | Effective-dated | Affects confirmed bookings |
|---|---|---|---|---|---|---|
| `name`, `slug` | Project ✅ | Project | no | admin | no | no |
| `address`, `latitude`, `longitude` | Project ✅ | Project | no (never) | admin | no | no |
| `timezone` | Project ✅ | Project | no | admin | no | no — snapshot carries dates |
| `defaultCurrency` | Project ✅ | Project | to unit | admin (founder) | should be | **yes** — snapshot only |
| `amenityKeys` | Project `String[]` ⚠️ | `AmenityAssignment` @ project | yes, to unit | admin | should be | no |
| `status` | Project ✅ | Project | no | admin | no | no |
| check-in / check-out time | ❌ absent | Project, overridable per unit | yes | ops | no | no |
| `handbookKey` | Project ✅ | content layer | yes | ops | no | no |

## Unit

| Attribute | Today | Target | Inheritable | Editable by | Effective-dated | Affects confirmed bookings |
|---|---|---|---|---|---|---|
| `name` | Unit ✅ | Unit | no | admin | no | no |
| legal unit number | ❌ absent | Unit only, **never inherited** | **no** | admin | no | no |
| `unitType` (enum) | Unit ⚠️ | `UnitType` entity | classifies | admin | no | no |
| `categoryKey` | Unit `String?` ⚠️ | `UnitType.id` FK | — | admin | no | no |
| `floor` | Unit, free text ⚠️ | `SpaceNode` | via node | admin | no | no |
| `bedrooms`, `bathrooms`, `maxGuests` | Unit ✅ | Unit; UnitType as creation default | default only | admin | no | no |
| `sizeSqm` | Unit ✅ | Unit; UnitType as default | default only | admin | no | no |
| `amenityKeys` | Unit `String[]` ⚠️ | `AmenityAssignment` @ unit, may **add, override, or explicitly remove** an inherited value | yes | admin | should be | no |
| **`baseNightlyThb`** | **Unit** ⚠️ | `RateRule` (dated, per rate plan) | no | revenue mgr | **yes** | **no** — snapshot governs |
| **`minNights`** | **Unit** ⚠️ | `RestrictionRule` | no | revenue mgr | **yes** | no |
| `instantBook` | Unit ✅ | AccommodationProduct | yes | ops | no | no |
| `cancellationPolicyKey` | Unit ⚠️ | `RatePlan`, snapshotted at booking | yes | ops | **yes** | **no** — snapshot governs |
| `ownerIdentityId` | Unit scalar ⚠️ | `OwnershipPeriod` | no | admin | **yes** | no — statements use the period |
| `status`, `assetStatus` | Unit ✅ | Unit | no | admin | no | no |
| `permittedUseConfirmedAt` | Unit ✅ | `ComplianceRecord` | no | ClearView | yes | no — hard gate on go-live |

## Commercial

| Attribute | Today | Target | Editable by | Effective-dated | Affects confirmed bookings |
|---|---|---|---|---|---|
| nightly price | `PricingRule` (dated) ✅ | `RateRule` | revenue mgr | yes | **no** |
| management fee % | `UnitEngagement.feeOverridePct` ✅ | `ManagementAgreement` version | founder | yes | **no** — statement uses the version in force |
| NOI cap | `UnitEngagement.noiCapAnnualThb` ✅ | agreement | founder | yes | no |
| engagement type | `UnitEngagement.engagementType` ✅ | agreement | founder | yes | no |
| commission basis | `EarnedFee.calculation_basis` ✅ | agreement | founder | yes | no |

## Booking (immutable once confirmed)

| Attribute | Today | Mutable after confirm? | Should be |
|---|---|---|---|
| `totalThb` | Booking ✅ | **yes** ⚠️ | no — P1-1 |
| `priceBreakdown` | `JsonB` ⚠️ | **yes** ⚠️ | no — P1-1, and relational not JSON |
| `cancellationPolicySnapshot` | `JsonB` ✅ captured | **yes** ⚠️ | no — P1-1 |
| allocated unit | `Booking.unitId` | yes, by ops | yes, with audit + reason |
| `status` | Booking ✅ | state machine | ✅ as-is |

---

## Provenance API (not yet built)

The master spec requires admin reads to expose where a value came from. Nothing in the codebase
does this today, because inheritance itself does not exist — values are read straight off the row.
Target response shape:

```json
{
  "attribute": "amenities.private_pool",
  "effective_value": true,
  "source_entity_type": "UnitType",
  "source_entity_id": "…",
  "inherited": true,
  "overridden_at": null,
  "version": 3
}
```

## Rules that must hold

1. A confirmed booking's economics never change because configuration changed. Enforced by
   snapshot + immutability trigger (**P1-1**, open).
2. Legal identifiers and addresses never inherit.
3. Every inheritable attribute supports explicit removal at the child level, distinct from "unset".
4. Every attribute affecting money or legal standing is effective-dated and audit-logged.
