# Airbnb-Level Guest Journey Gap Analysis

This document audits the myUNO guest journey against an Airbnb-benchmark level of continuity, low cognitive load, and persistent context, while maintaining myUNO's deep resort operating model.

## Domain Gap Analysis Table

| Domain | Existing Implementation | Routes / Components | Backend Source | Status | Action |
| --- | --- | --- | --- | --- | --- |
| **Discovery** | Home & Project landing pages | `/`, `/projects`, `/projects/[slug]` | `src/modules/projects`, `src/modules/core` | Implemented | **REUSE & EXTEND**: Pass search parameters into search route. |
| **Search** | Villa/Unit search with filters | `/search`, `SearchBar.tsx` | `src/modules/browse`, `/api/search/units` | Implemented | **EXTEND**: Persist search context (dates, guests, bedrooms) in URL and session storage so context isn't lost on click. |
| **Villa Detail** | Unit detail, photo gallery, pricing preview | `/units/[id]`, `unit-client.tsx`, `UnitPhotoMosaic.tsx` | `/api/units/[unitId]`, `src/modules/booking` | Implemented | **EXTEND**: Accept search context query params, preserve date/guest selection into checkout button. |
| **Saved / Wishlist** | Backend saved service exists; `/buying` uses saved units | `/buying`, `src/modules/browse/saved.service.ts` | `src/modules/browse` | Partial | **EXTEND / MERGE**: Add canonical `/saved` route for guests to view saved villas with search context preserved. |
| **Booking & Auth** | Booking review & auth flow | `/book/review`, `/login`, `/register` | `/api/bookings`, `src/modules/booking` | Implemented | **EXTEND**: Preserve query context (`unitId`, `checkIn`, `checkOut`, `adults`, `children`) through auth redirects. |
| **Checkout & Payment** | Card checkout, bank transfer, cash on check-in | `/trips/[id]`, `/api/checkout` | `src/modules/finance`, Opn/Omise integration | Implemented | **REUSE**: Preserve backend payment math, payment hold expiration, transfer instructions. |
| **Trip Hub** | Guest trip detail and actions | `/trips/[id]`, `booking-client.tsx` | `/api/bookings/[id]`, `src/modules/booking` | Implemented | **EXTEND**: Upgrade `/trips/[id]` into the central guest orchestration hub with derived timeline, pre-arrival tasks, messaging, & Stay mode CTA. |
| **Pre-arrival** | Passport verification, check-in instructions | `/bookings/[bookingId]/passports`, `/trips/[id]` | `/api/bookings/[id]/verify-passports`, `src/modules/ops` | Implemented | **REUSE & EXTEND**: Surface pre-arrival checklist cleanly in Trip hub without repeating collected data. |
| **Messaging** | Unified threads for bookings & orders | `/messages`, `/messages/[threadId]` | `src/modules/comms`, `/api/threads` | Implemented | **REUSE & EXTEND**: Provide direct contextual messaging button on Trip hub ("Message your team"). |
| **Stay / Home Space** | Active in-stay guest portal | `/bookings/[bookingId]/home-space` | `getInStayHomeSpace`, `src/modules/booking` | Implemented | **REUSE**: Connect seamlessly from confirmed/active Trip hub directly to Home Space. |
| **Services & F&B** | Services marketplace, orders, timeline | `/services`, `/services/[id]`, `/services/orders/[orderId]` | `src/modules/services`, `/api/service-orders` | Implemented | **REUSE & EXTEND**: Link service orders into Trip timeline. |
| **Transfers** | Airport transfer services | Integrated in services catalog | `src/modules/services` | Implemented | **REUSE**: Treat as trip service in pre-arrival & timeline. |
| **Modifications** | Booking date change & repricing | `/trips/[id]`, `/api/bookings/[id]/modify` | `src/modules/booking` | Implemented | **REUSE**: Keep canonical backend repricing and payment diff calculations. |
| **Cancellation & Refund**| Cancellation and live refund calc | `/trips/[id]`, `/api/bookings/[id]/cancel` | `src/modules/booking` | Implemented | **REUSE**: Retain backend refund calculation and snapshotted policies. |
| **Reviews & Disputes** | Post-stay review & damage claims | `/trips/[id]`, `/api/disputes` | `src/modules/booking` | Implemented | **REUSE**: Retain review submission and dispute ticket creation. |
| **Profile** | Account & notification preferences | `/account`, `/api/account/profile` | `src/modules/core` | Implemented | **REUSE**: Keep single identity profile management. |

---

## Duplication & Consolidation Decisions

1. **Trip vs Booking**:
   - `Booking` is the database transaction entity.
   - `Trip` is the guest-facing presentation & orchestration model (`/trips/[id]`). No duplicate database entity created.
2. **Stay Mode**:
   - `/bookings/[bookingId]/home-space` is the canonical active stay dashboard.
   - `/trips/[id]` transitions directly into Home Space during active stay dates. No second Stay dashboard built.
3. **Pricing & Availability**:
   - Frontend never calculates authoritative rates or refunds. Always uses `/api/pricing/breakdown`, `/api/bookings/[id]/modify`, `/api/bookings/[id]/cancel`.
4. **Messaging**:
   - `/api/threads` and `/messages` serve all guest-host-concierge communications. No disconnected host/concierge chats.

---

## Summary of Actions

- **P0**: Search & booking context persistence across `/search` -> `/units/[id]` -> `/book/review` -> `/login`.
- **P0**: Enhance `/trips/[id]` to present a unified Trip Hub with an aggregated guest timeline, pre-arrival checklist, direct messaging, and Home Space entry point.
- **P1**: Expose `/saved` route for guest shortlist with search context preservation.
- **P1**: Refine Navbar for seamless guest journey switching.
