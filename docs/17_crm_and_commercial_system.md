# 17 · CRM and commercial system

## Decision

The platform owns its CRM. `Identity` is the canonical Party ID: the same person
may be a guest today, a buyer tomorrow and an owner later without creating a
second contact. CRM is a module of the Property Operating System, not an
integration with HubSpot.

## Commercial objects

| Object | Purpose |
|---|---|
| `CrmProfile` | Lifecycle, score, tags, source and next action for one Party. |
| `CrmOpportunity` | A monetisable request: rental, purchase, sale, management, developer advisory, capex or compliance. |
| `CrmActivity` | Tasks, calls, meetings, notes and channel interactions. |
| `CrmConsent` | Purpose-specific PDPA evidence and withdrawal history. |
| `CrmAttributionTouch` | First touch, lead creation, conversion and assisted attribution. |

## Guest-to-owner loop

1. A booking or public inquiry resolves to one `Identity`.
2. A `CrmProfile` stores lifecycle and channel preference.
3. Behavioural `BuyerSignal` creates a review task; it never silently changes a
   commercial stage.
4. A qualified purchase discussion creates a `purchase` opportunity.
5. A won purchase promotes the Party lifecycle to `owner`; booking history and
   service preferences remain attached to the same ID.

## Demand without owned inventory

Incoming rental demand must not be discarded when myUNO has no matching managed
unit. Staff create a `rental` opportunity with `externalPartner` populated and
`unitId` empty. The partner receives only the minimum necessary data after
consent. Revenue is classified as referral/agent commission, never as managed
asset revenue. Partner properties are not shown as “Managed by myUNO” and do
not enter owner NOP statements.

## Pipeline rules

Stages are `new → qualified → discovery → proposal → negotiation → won/lost`.
`nurture` is a deliberate holding stage, not a graveyard. Every active
opportunity must have a responsible person and next action before production
rollout. Lost opportunities require a reason. Won opportunities retain source
and attribution rather than overwriting them.

## AI boundary

AI may summarize interactions, suggest score, detect intent, draft a response
and recommend next action. It may not merge identities, grant consent, send a
message, change an opportunity to won/lost, confirm a booking, change money or
share data with a partner without deterministic validation and human approval.

