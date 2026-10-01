# Canonical Rent Out / Manage Onboarding

Status: implementation contract
Date: 2026-10-01

## Invariants

1. A physical property is represented by exactly one canonical `Unit`.
2. `Project` identifies the development/complex; it is not a listing.
3. `CommercialOffering` answers what may be transacted now: `sale`, `long_term_rental`, or `short_term_stay`.
4. `UnitEngagement` answers who operates the Unit: `owner_direct`, `via_management_company`, or `direct_managed`.
5. `OwnershipPeriod` is the dated ownership fact. `Unit.ownerIdentityId` is the current-owner projection.
6. `RoleAssignment` grants software access only. It is never evidence of ownership, listing authority, or management authority.
7. `CrmOpportunity` tracks the commercial/onboarding process. It is never a property record.
8. Public onboarding may create only draft commercial/operating records. Activation is fail-closed through domain gates.

## Entry journeys

### Rent Out

Purpose: commercial activation.

Public choices:
- short stays → requested `short_stay`
- monthly/yearly → requested `monthly` / `yearly`
- both

Canonical mapping:
- `short_stay` → `CommercialOffering(short_term_stay)`
- `monthly | yearly` → `CommercialOffering(long_term_rental)`

Operating model is selected independently:
- owner direct
- existing management company
- myUNO direct managed

### Manage

Purpose: professional operating relationship.

A single-property owner enters as:
- `kind=home`
- `operatingModel=direct_managed`

`kind=management` is reserved for a representative of a management company submitting properties on behalf of owners.

## Onboarding state machine

Derived states:

```
draft
unit_matched
authority_pending
authority_verified
commercial_configured
engagement_configured
readiness_pending
ready_for_activation
active
blocked
```

The legal transition graph is exported as `ONBOARDING_TRANSITIONS` from `src/modules/onboarding`.

Most state is derived from canonical records rather than being manually advanced.

## Physical asset resolution

Sequence:

```
Project
  ↓
Search existing Unit
  ├─ select existing Unit → reuse it
  └─ no match → duplicate review → create one draft Unit
```

Existing Unit selection is validated against the selected Project.

For a proposed new Unit, identifiers are normalized for duplicate detection. Common variants such as `F705`, `F-705`, `Unit F 705`, and `Building F / 705` resolve to the same duplicate key.

Ambiguous duplicate candidates block conversion. Admin cannot bypass this merely by approving the application.

## Ownership

The only canonical writer is `setUnitOwnerTx()` / `setUnitOwner()`.

It synchronizes:
- `OwnershipPeriod`
- `Unit.ownerIdentityId`
- Unit-scoped owner access

A transfer closes the outgoing period and revokes the outgoing Unit-scoped owner role before granting the incoming owner access.

The same-owner path reconciles missing history/access for imported legacy Units.

## Management relationships

Public onboarding records only a requested operating model.

After verification it may create a draft `UnitEngagement`.

### owner_direct

Draft requires:
- Unit
- verified owner

Activation uses the established owner-direct operating rules.

### via_management_company

Draft requires:
- Unit
- verified owner
- verified active management-company Organization

The relationship is stored on `UnitEngagement.managementOrgId`.

It does **not** grant `mc_member` access to the owner. Management-company employee access is a separate organization/team invitation workflow.

### direct_managed

Draft may exist before commercial terms/mandate are complete.

Activation requires:
- mandate document
- NOI cap/economics
- no competing active engagement

Only one UnitEngagement may be active for a Unit at a time.

## Draft offerings

`ensureDraftCommercialOfferingsTx()` canonicalizes presentation intents and upserts against the existing unique constraint `(unitId, offeringType)`.

No duplicate offering is created when monthly + yearly both resolve to `long_term_rental`.

## Activation gates

Public onboarding never activates an offering.

`assertCommercialOfferingReadyForActivation()` is the pre-activation gate for commercial intent.

### Short-term stay

Requires:
- verified owner
- active operating engagement
- permitted-use confirmation
- confirmed permitted-use compliance record
- live inventory category
- valid stay pricing/minimum nights
- active rate plan
- exact-unit public media
- sleeping-space facts
- hospitality mobilization complete

Existing source-system cutover rules remain additive for source-owned inventory such as Layantara.

### Long-term rental

Requires:
- verified owner
- active operating engagement
- permitted-use confirmation
- confirmed permitted-use compliance record

Commercial terms remain offering-specific.

### Sale

Requires:
- verified owner
- current verified `title_legal_use` credential
- current verified `sale_authority` credential

## CRM rules

Property onboarding creates a `CrmOpportunity` using one classifier:

- sale only → `sale`
- rental + owner direct → `rental`
- rental + existing manager → `rental`
- direct managed → `management`
- management-company intake → `management`

POST and PATCH use the same classifier.

If an owner already has an active property-submission opportunity, a later public owner-advisor inquiry is attached as `CrmActivity` to that opportunity rather than creating a second commercial workflow.

## Record creation timing

| Record | Creation point |
|---|---|
| CrmOpportunity | onboarding begins |
| Project | only after duplicate/location review when no Project exists |
| Unit | only after existing-Unit lookup and duplicate review |
| OwnershipPeriod | after verified owner evidence |
| owner RoleAssignment | projection after verified ownership |
| CommercialOffering | draft after accepted commercial intent |
| UnitEngagement | draft after verified owner + accepted operating model |
| management-company role access | separate team/invitation workflow |
| active CommercialOffering | only through activation gate |
| active UnitEngagement | only through engagement activation gate |

## Canonical sources of truth

| Question | Source |
|---|---|
| What physical property is this? | Unit |
| Which development? | Project |
| Who owned it at a date? | OwnershipPeriod |
| Who owns it now? | Unit.ownerIdentityId projection |
| What can be transacted? | CommercialOffering |
| Who operates it? | UnitEngagement |
| Which company operates it? | UnitEngagement.managementOrgId |
| Who may use the software? | RoleAssignment |
| Where is the process tracked? | CrmOpportunity + CrmActivity |
| Is a commercial intent ready to activate? | onboarding/compliance/pricing/readiness gates |

## Fail-closed rule

No commercial or operating activation may be derived from:
- user assertion,
- role membership,
- CRM stage,
- admin checkbox alone,
- presence of a Unit row.

Activation requires the relevant canonical evidence and domain gate to pass.
