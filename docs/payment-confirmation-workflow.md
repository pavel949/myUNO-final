# Payment Confirmation Workflow

## Overview

When a guest successfully pays for a booking, the system must transition the booking from `pending_payment` → `confirmed`. This document outlines the complete workflow and the critical states involved.

## Booking Status States

```
created
  ↓
instant_book? → pending_payment  (card/cash payment required)
               → confirmed       (payment received)
request_to_book? → requested    (awaiting owner approval)
```

Once a booking reaches `confirmed`, it:
- Blocks the unit's dates from further bookings
- Makes the guest eligible to review after stay checkout
- Generates owner earnings/statements
- Triggers notification fanout to guest and owner

## Two Payment Paths

### Path 1: Card Payment (Doc 10 §3, Flow F-OPS-5)

**Workflow:**
1. Guest initiates booking with `instantBook=true` → creates booking with status `pending_payment`
2. `POST /api/bookings/[id]/checkout` → calls `financeService.createCheckout()`
3. `createCheckout()` → creates Payment record with status `pending`
4. Guest redirected to checkout page (mock or real provider)
5. Payment succeeds → guest returns to success page or provider calls webhook
6. `POST /api/checkout/confirm` with `sessionId` → calls `financeService.verifyAndConfirm(sessionId)`
7. `verifyAndConfirm()` → **CRITICAL STATE TRANSITION:**
   - Updates `payment.status` = `pending` → `succeeded`
   - Updates `booking.status` = `pending_payment` → `confirmed`
   - Creates `ledgerEntry` for rental revenue
   - Creates booking communication thread
8. Route calls `notifyBookingConfirmed()` → notifications + email

**Code Path:**
```
POST /api/checkout/confirm
  ├─ getCurrentUser() [auth check]
  ├─ payment = db.payment.findUnique(sessionId)
  ├─ verifyAndConfirm(sessionId)
  │  ├─ payment.status = 'succeeded'
  │  ├─ booking.status = 'pending_payment' → 'confirmed'  ✓ TRANSITION
  │  ├─ ledgerEntry.create(rental_revenue)
  │  └─ findOrCreateThread(booking)
  └─ notifyBookingConfirmed(bookingId)
     ├─ createNotification(guest)
     ├─ createNotification(owner)
     └─ sendEmail(guest)
```

### Path 2: Cash Payment (Doc 10 §1, Flow F-OPS-6)

**Workflow:**
1. Guest creates booking → status `pending_payment`
2. Staff verifies guest arrival / readiness
3. `POST /api/bookings/[id]/record-cash-payment` with `receiptRef` → calls `financeService.recordCashPayment()`
4. `recordCashPayment()` → **CRITICAL STATE TRANSITION:**
   - Creates Payment record with status `succeeded` (cash is physical)
   - Updates `booking.status` = `pending_payment` → `confirmed`
   - Creates `ledgerEntry` for rental revenue
5. Route calls `notifyBookingConfirmed()` → notifications + email

**Code Path:**
```
POST /api/bookings/[id]/record-cash-payment
  ├─ getCurrentUser() [auth: staff_ops/admin]
  ├─ booking = db.booking.findUnique(id)
  ├─ recordCashPayment(bookingId, receiptRef)
  │  ├─ payment.create(status='succeeded')
  │  ├─ booking.status = 'pending_payment' → 'confirmed'  ✓ TRANSITION
  │  ├─ ledgerEntry.create(rental_revenue)
  │  └─ track(stay_payment_succeeded)
  └─ notifyBookingConfirmed(bookingId)
     ├─ createNotification(guest)
     ├─ createNotification(owner)
     └─ sendEmail(guest)
```

## Critical Implementation Details

### 1. **Single Source of Truth for Status Transition**

The booking status transition happens in **two places**, but with clear responsibility:

- **`financeService.recordCashPayment()`** — handles cash payments (immediate, no async)
- **`financeService.verifyAndConfirm()`** — handles card payments (after provider confirms)

Both functions directly update `booking.status` in the database. This is correct because:
- Each payment path has a single point of confirmation
- Status transition is atomic with ledger entry creation
- No separate "confirmBooking" API method is invoked (avoids dual-write risk)

### 2. **Ledger Entry Must Precede Notification**

The sequence is:
1. Payment status → succeeded
2. Booking status → confirmed
3. Ledger entry created (rental_revenue)
4. Thread created
5. **Then** notification sent

This ensures:
- Ledger is immutable and always in sync with booking state
- Notifications reflect final state, never provisional
- Audit trail is complete before stakeholder communication

### 3. **Idempotency for Card Payments**

`verifyAndConfirm()` is idempotent because:
- If payment already succeeded, returns `confirmed=false` and does not re-process
- Caller can safely call this twice (success return URL + webhook)
- Ledger entries are created only on first confirmation
- Notification is sent only when `result.confirmed === true`

```typescript
if (payment.status === 'succeeded') {
  return { payment, confirmed: false };  // Already done
}
```

### 4. **Notifications Are Best-Effort**

After booking status transitions to confirmed, notifications are sent with error handling:

```typescript
try {
  await notifyBookingConfirmed(db, bookingId);
} catch (error) {
  console.error('Notification failed:', error);
  // Payment is already confirmed; don't roll back
}
```

This ensures:
- Payment confirmation is never blocked by notification failures
- Guest sees "confirmed" in their account even if email delivery fails
- Admin can re-send notifications manually if needed

## Verification Checklist

When modifying payment or booking logic, verify:

- [ ] Booking transitions from `pending_payment` → `confirmed` **before** notification
- [ ] Ledger entry created with correct `entryType` (`rental_revenue`)
- [ ] Both payment paths (cash + card) behave identically from guest perspective
- [ ] Idempotency: calling twice doesn't create duplicate ledger entries
- [ ] Notification receivers include both guest and owner
- [ ] Confirmation email is sent with correct locale
- [ ] Analytics event (`stay_payment_succeeded`) is tracked

## Testing

Integration tests live in:
- `src/modules/finance/finance.service.integration.test.ts` — verifyAndConfirm, recordCashPayment
- `src/app/api/checkout/confirm/` — checkout confirm route
- `src/app/api/bookings/[id]/record-cash-payment/` — cash payment route

Key tests:
- ✓ Payment succeeds → booking transitions to confirmed
- ✓ Ledger entry created
- ✓ Idempotent: calling twice doesn't duplicate
- ✓ Notification sent on first confirmation only
- ✓ Email sent with correct subject/body

## Open Questions

None currently. Payment confirmation workflow is stable and documented in:
- **Doc 10 §1–3:** Payment flows (F-OPS-5 card, F-OPS-6 cash)
- **Doc 07 B-STAY:** Booking flow states
- **This file:** Implementation details

