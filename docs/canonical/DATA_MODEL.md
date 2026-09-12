# DATA_MODEL.md — Canonical Models and Data Ownership

## 1. Identity
Evolve existing `Identity` as canonical Party. Roles are relationships, not separate people. Preserve contact points, consent, lifecycle, merge/alias history. Never create separate global guest/owner/buyer person tables.

## 2. Organization
Represents myUNO, management companies, developers, juristic persons, owner companies, providers and partners. Relationships: Identity↔Organization membership; Organization↔Property roles; Organization↔OperatingScope; Organization↔Provider.

## 3. Asset graph
Conceptual: Area → Development/Project → Property → Collection → Unit. Use the smallest additive schema change that expresses semantics. Reuse an existing development when adding units.

## 4. Ownership
Time-bounded and evidence-backed. Minimum: unit, owner Identity/Organization, effective dates, evidence, source, status. CRM won or role=owner is not legal ownership.

## 5. OperatingScope
Canonical authority/responsibility relationship: responsible org, property/collection/unit scope, relationship type, effective dates, permissions, responsibilities, settlement, endorsement, contract references and audit.

## 6. Booking / Stay
Booking remains transactional truth with supply scope, guest identity, dates, party, commercial snapshot, source/channel, status and payment state. Trip is derived experience orchestration.

## 7. Pricing
Canonical: RatePlan, applicability, seasons/date rules, min stay, restrictions, taxes, fees, discounts/overrides. Legacy unit base-rate fields cease as writers only after parity/cutover.

## 8. Availability
Explicit source: myUNO, Layantara, partner PMS, iCal, channel manager or owner manual. Store freshness/health and fallback mode.

## 9. Services commerce
Global: Provider, ServiceDefinition/CatalogDefinition, ProviderCapability. Local: PropertyServiceConfiguration. Transactional: Offer/TermsVersion, Quote, Order/OrderLine, Fulfillment, Payment/Settlement, Evidence, Rating.

## 10. BusinessEvent
Minimum: id, contract version, type, source system, source event id, occurred/received timestamps, org/property/unit, party, booking/order, actor, evidence refs and payload. Unique by external system + source event.

## 11. ExternalRecordLink
Maps source records to canonical entities. Never silently remap. Keep reconciliation/audit trail.

## 12. Derived models
Search projection, readiness, SLA performance, Party360, Owner360, Portfolio, provider score and standard score are rebuildable projections.

## 13. Data classification
Every new model/field group must be classified as `CANONICAL`, `CONFIGURATION`, `EVENT`, `DERIVED` or `EXTERNAL_MAPPING`. Critical rights/money/state do not live in uncontrolled JSON.

## 14. Collections
Collection may drive editorial grouping and explicit inherited configuration. It never grants ownership, pricing authority, availability authority or access by itself.

## 15. Physical unit vs commercial configuration
Alternate sellable modes of one physical unit share one physical capacity/resource. Do not duplicate Units for 1BR/2BR variants unless physically independently occupiable.

## 16. Accepted commerce terms
Transactions reference immutable/versioned pricing model, price, taxes/fees, commission, cancellation, SLA/lead-time and settlement basis.

## 17. Settlement allocation
Represent exactly which earning/refund obligation a payout satisfies. One obligation cannot be allocated twice.

## 18. Scoped CRM privacy
Identity is global; relationship/read visibility is scope-aware and never exposes another operator’s confidential CRM context by default.
