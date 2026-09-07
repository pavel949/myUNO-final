# Guest Journey Architecture

## Core Architectural Principle

> **Booking** is the transaction.
> **Trip** is the guest-facing journey and orchestration view.
> **Stay / Home Space** is the active mode of that Trip.

myUNO does not create duplicate database tables for Trips or Stays when `Booking` records already contain the canonical transaction state. Instead, `Trip` and `Stay` are presentation and aggregation layers built over canonical records.

---

## Model Responsibilities

### 1. Booking (Canonical Transaction & Operations)
- **Database Entity**: `Booking` in Prisma schema (`src/modules/booking`).
- **Authority**: Rates, taxes, fees, payment status, availability holds, cancellation math, refund amounts, passport compliance, access permission.
- **Backend Services**: `/api/bookings`, `/api/pricing/breakdown`, `/api/checkout`, `/api/bookings/[id]/modify`, `/api/bookings/[id]/cancel`.

### 2. Trip (Guest Orchestration & Read Model)
- **Surface**: `/trips/[id]` (`src/app/trips/[id]`).
- **Function**: Aggregates accommodation details, payment state, pre-arrival checklist, contextual messaging, and derived timeline.
- **Derived Timeline Sources**:
  - `Booking`: Check-in, check-out, status transitions.
  - `ServiceOrder`: Housekeeping, airport transfer, wellness, experiences.
  - `MessageThread`: Active communications with property staff.
  - `Announcement`: Property/resort announcements.

### 3. Stay / Home Space (Active Trip Mode)
- **Surface**: `/bookings/[bookingId]/home-space` (`src/app/bookings/[bookingId]/home-space`).
- **Function**: Active mode for confirmed guests during stay dates. Gives immediate access to Wi-Fi, villa handbook, room service / F&B, housekeeping requests, maintenance issues, and checkout guidance.

---

## Context Continuity Rules

1. **Search Context**:
   - Query params (`checkIn`, `checkOut`, `adults`, `children`, `bedrooms`, `projectId`) persist across `/search` → `/units/[id]` → `/book/review`.
2. **Auth Context**:
   - If an unauthenticated guest clicks "Reserve" or "Book", the query parameters and selected unit are passed to `/login?redirect=...` so the booking context is restored immediately upon login/registration.
3. **Communication**:
   - Single canonical thread system (`/api/threads`). The guest talks to "Your Property Team" without needing to select internal operational departments.
