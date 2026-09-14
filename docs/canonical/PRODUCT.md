# PRODUCT.md — myUNO Product Surfaces and Journeys

## 1. Product layers

1. Public network — discover places and services.
2. My myUNO — personal relationship hub.
3. Property/partner workspaces — operate delegated scope.
4. Control Plane — portfolio/network intelligence.

One account may unlock multiple layers.

## 2. Public IA

```text
/
├─ /explore
├─ /stays
├─ /services
│  ├─ /services/[category]
│  └─ /services/[service]
├─ /properties/[slug]
│  ├─ /collections/[slug]
│  └─ /units/[slug-or-id]
├─ /homes
├─ /owners
│  ├─ /owners/submit
│  ├─ /owners/claim
│  └─ /owners/management
├─ /partners
│  ├─ /partners/property-managers
│  └─ /partners/providers
└─ /auth
```

Preserve existing canonical routes and redirects where sensible.

## 3. Homepage

Hero is image-led and practical.

Direction:

**Phuket, better connected.**  
Stay in places we know. Manage your trip. Get trusted local services.

Primary: `Where · Dates · Guests → Find a stay`  
Secondary: `Explore Phuket services`  
Tertiary, quiet: `List or manage a property`

Do not make management/company audiences equal primary choices in the hero.

Then:
- Places on myUNO;
- Find by intent: private pool villas, beach, family, long stay, groups/retreats, workation;
- Your Phuket, handled: transfers, cars, chefs, yachts, wellness, family, cleaning, property services;
- Trip Hub product proof;
- owner paths;
- partner paths;
- trust/standard.

## 4. Explore and Stay

```text
Homepage → search → results → property/unit → availability → quote → booking mode → review → auth/identity → payment/request → confirmation → Trip Hub
```

Search state survives navigation. No page independently calculates canonical price.

## 5. Property page

Editorial shell around canonical facts. Sections render only when capability/data exists: hero, story, availability, collections/categories, units, facilities, services, groups/retreats, long stay, location, reviews, responsibility, trust, FAQ.

Selected residences inside a third-party development must disclose the actual managed scope.

## 6. Unit page

Media, location context, capacity, beds, amenities, availability, canonical quote, booking mode, policies, operator responsibility, relevant services, reviews and trust/evidence where appropriate.

## 7. Services journey

```text
/services → category → offering → context/location → schedule → quote/price → auth if required → order → payment/handoff → tracking → fulfillment → rating
```

Modes: instant, provider-confirmed, quote, concierge, referral. UI states which mode applies.

## 8. My myUNO

Adaptive sections:
`Trips · Orders · Homes · Services · Saved · Ownership · Work · Partner`.

Only relevant sections appear.

## 9. Guest Trip Hub

Pre-arrival: details, transfer, groceries, itinerary, payment, readiness.  
Arrival: directions, transfer, contact, map, access when released.  
In stay: Home Space, services, requests, messages, itinerary, guide, extension.  
Departure: checkout, transfer, balance/deposit, late checkout if eligible.  
Post-stay: receipt, deposit state, review, rebook, relationship history.

## 10. Owner acquisition

Two distinct flows:

### Apply for myUNO management
Property basics → ownership → current operation → needs → commercial context → contact → qualification → proposal/mandate → onboarding.

### List / self-manage
Identity → ownership verification → property → inventory → content → pricing → availability source → responsibility → settlement → compliance → validation → publish.

Do not merge these into one vague CTA.

## 11. Partner property manager

Organization application → verification → authority proof → team → add/claim development → managed units → delegated capabilities → pricing/availability source → settlement → review → live.

Workspace: Today, portfolio, units, stays, guests, pricing, availability, tasks, services, team, finance, settings.

## 12. Provider portal

Profile, verification, capabilities, offers, availability/lead time, orders, accept/decline, fulfillment, evidence, remittance, performance.

## 13. Property staff

Default home = `Today`, not analytics. Show arrivals, departures, in-house, readiness blockers, guest requests, overdue tasks, maintenance, team coverage, approvals.

## 14. Control Plane

Default = `Needs Attention`, then Portfolio, CRM/Party, Owners, Properties, Partners, Services, Standards, Distribution, Finance overview, Integrations, Data quality, Platform health.

## 15. Standalone Phuket customer

A customer does not need a property/stay role to buy eligible services:

```text
Services → need/category → area/address → matching offers → detail → category form → canonical quote → sign in/verify contact → accept terms → payment/request → order timeline
```

Do not force a fake guest role or fake Phuket project.

## 16. Help

Distinguish emergency guidance, urgent property issue, normal support and service/order problem. Emergency assistance is never routed through normal checkout.

## 17. Product rules

1. No dead CTA.
2. No decorative workflow.
3. One primary action per screen.
4. No false management claim.
5. No client-authoritative price.
6. No guessed-ID private access.
7. No unnecessary re-entry of known data.
8. Failures explain recovery.
9. Every role sees the smallest useful surface.
10. Every meaningful state change is traceable.
