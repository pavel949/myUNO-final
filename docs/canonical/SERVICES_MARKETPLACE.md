# SERVICES_MARKETPLACE.md — Phuket Services Network

## 1. Purpose
Services are a network utility across guests, owners, residents, property managers and standalone Phuket customers — not a static concierge directory.

## 2. Initial taxonomy
Guest/lifestyle: transfers, drivers, car rental, yacht/boat, chef/catering, groceries, wellness, fitness, babysitting/kids, tours, restaurant assistance, events, flowers/gifts. Property: cleaning, laundry/linen, pool/garden, pest control, aircon, plumbing/electrical, handyman/appliances, deep cleaning, inspections, moving/furnishing, photography, internet, security/access.

Use configurable catalog definitions; do not hard-code categories into UI.

## 3. Fulfillment modes
`INSTANT`, `REQUEST_CONFIRMATION`, `QUOTE`, `CONCIERGE`, `REFERRAL`, `INTERNAL_PROPERTY_SERVICE`. UI must state the mode.

## 4. Provider onboarding
Application → identity/org verification → categories/capabilities → coverage → required documents → commercial terms → payout method → offers → vetting → active. Also support needs_information, rejected, suspended and offboarded. Vetted badge requires actual evidence.

## 5. Canonical network model
```text
CatalogDefinition
→ Provider / ProviderCapability
→ ProviderOffering (evolve existing Service)
→ OfferingTermsVersion
→ PropertyServiceConfiguration
→ Quote / Order / OrderLine
→ Fulfillment Evidence
→ Settlement Allocation
→ Performance
```

Do not duplicate existing Provider/Service if they can evolve safely.

## 6. PropertyServiceConfiguration
Same offer may vary by property: enabled/public, eligibility, price/override, cost, commission, lead time, SLA, cancellation, collector, fulfillment owner, complaint owner, inclusions/copy and effective dates.

## 7. Standalone Phuket commerce
A customer may order without a stay/property. Required: orderer Identity, recipient, area/address, responsible organization, selected offer/terms and fulfillment mode. `project_id` may be null. Never create a synthetic “All Phuket” project.

## 8. Contextual ordering
Guest transfer: Booking + arrival → Order. Owner repair: Owner + Unit → Order → owner finance. Manager cleaning: Property + Unit → Order → operating cost. Standalone customer: Identity + delivery/service context → Order.

## 9. Public UX
`/services` starts with “What do you need?” and optional context (“For your Layantara stay” / “Anywhere in Phuket”). Show only real eligible supply, real price/price-from/quote, lead time, cancellation, confirmation mode, provider and meaningful rating/performance.

## 10. Trip integration
Stay-linked orders appear in Trip Hub, itinerary, messages, payments and notifications. No isolated service-account history.

## 11. Separate quantity dimensions
Do not use one quantity for persons + duration + product count + capacity. Category forms use explicit typed units.

Examples: transfer has passengers/luggage/vehicle/time; chef has guests/service window; cleaning has scope/size/repetition; car rental has dates/resource class; flowers/products use SKU/variant/quantity/delivery window.

## 12. Quote workflow
Quote-priced offers use `QuoteRequest → response → QuoteVersion → expiry → acceptance → Order`. Accepted version is immutable.

## 13. Order state dimensions
Keep commercial acceptance, fulfillment, payment, dispute/case, settlement and administrative closure independent. Exact enums must reconcile existing schema first.

### 13.1 Fulfilment confirmation and dispute window
`service.fulfilment_confirm_window_hours` is a canonical commercial/recourse control. Default: **48 hours** when no valid property override exists.

- only positive whole-hour values are valid; `0` and negatives are rejected;
- provider fulfillment moves an accepted order to `fulfilled` and records immutable `fulfilled_at`;
- the orderer may confirm fulfillment or raise an allowed dispute before `fulfilled_at + windowHours`;
- explicit confirmation closes the order early;
- if no dispute exists, expiry of the window allows the system sweep to move `fulfilled → closed`;
- an undecided dispute prevents close/remittance eligibility according to finance rules;
- confirm, dispute creation and auto-close must serialize against the same canonical service-order row so they cannot produce contradictory terminal states;
- configuration changes must not rewrite already accepted financial terms. Where a future commercial rule requires an immutable accepted-window snapshot, introduce it explicitly rather than silently reinterpreting old orders.

The UI must show the actual deadline/status and must not offer actions the server will reject.

## 14. Reschedule
Request → validate new slot/resource/terms → hold replacement → price delta → customer/provider agreement → funding adjustment → commit new reservation → release old. Do not release old capacity before replacement is safely reserved.

## 15. Alternative provider
Do not rewrite historical provider on a fulfilled/financially recognized order. Use reassignment/child order/versioned fulfillment linkage with customer approval where terms materially change.

## 16. Partial fulfillment
Store delivered quantities/evidence and line-level financial adjustments. Refund/commission follows accepted line terms.

## 17. Products
When real supply exists: SKU/variant, quantity unit, seller, stock mode, retail price, cost/commission basis, delivery/pickup, return/substitution policy, stock reservations and append-only movements. Stock modes: confirmed internal, partner-confirmed, procurement-on-request. Never display exact stock when unverifiable.

## 18. Logistics
Address, recipient, window, delivery fee, cutoff/lead time, fulfiller, proof of delivery, failed-attempt reason and redelivery/return ownership. Exact address is private and scoped.

## 19. Rentals/equipment
Start/end, physical resource, handover/return condition, availability, late return, damage case, downtime and allowed preauthorization/deposit policy. One physical item has one capacity calendar.

## 20. Packages
A package may combine stay + service/product, but each component keeps responsibility, fulfillment, money allocation and cancellation rules.

## 21. Recurring services
Schedule, timezone, start/end, pause, skip, reschedule and terms version. Each occurrence has a unique idempotency key. Worker retry must not duplicate occurrence/charge.

## 22. Provider workspace
Today’s work, new requests/deadlines, calendar, task card, accept/decline reason, reschedule, evidence, problems, offers, coverage, team, earned/held/paid/refunds and statements. Never expose global CRM or unrelated property finance.

## 23. Settlement
Eligibility considers collector, actual receipt/approved credit terms, fulfillment acceptance, disputes/holds and prior allocations. Financial period uses immutable recognition/fulfillment date, not `updatedAt`. Provider-collects may create a commission receivable rather than provider gross payable.

Closed/recorded payout periods are immutable accounting history. A refund arising after payout must be represented in a later payable period or explicit adjustment; it must never disappear by retroactively changing only an already paid historic remittance. Requested/processing refunds block payout where the economic result is not yet known.

## 24. Quality
Measure response, acceptance, on-time, cancellation, no-show, complaint, refund, repeat, guest/operator ratings and evidence completeness. Do not rank only by average stars.

## 25. Safety
Prevent lateral guest access, global CRM access, false vetted badges, false confirmations, uncontrolled payout edits and public access to provider compliance documents.
