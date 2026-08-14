# SOP: Guest Booking & Check-In

## Overview
Process for guests to discover, book, and check in to a unit.

---

## Step 1: Guest Discovers Listing
**Actor:** Guest  
**Duration:** 5-15 minutes

1. Guest opens myUNO app/website
2. Guest uses search filters:
   - Location (country/region)
   - Dates (check-in, check-out)
   - Party size (adults, children, infants, pets)
   - Price range & amenities (optional)
3. Results display available listings with:
   - Photos & rating
   - Price per night
   - Host info & response time
   - Amenities & rules

**Exit:** Guest finds listing of interest → **Step 2**

---

## Step 2: Guest Reviews Listing Detail
**Actor:** Guest  
**Duration:** 10-20 minutes

1. Guest clicks listing to view full details:
   - All photos (lightbox gallery)
   - Description & house rules
   - Safety items & accessibility features
   - Host profile & reviews
   - Calendar (blocked dates visible)
   - Reviews from past guests

2. Guest reads:
   - Cancellation policy (flexible/moderate/strict)
   - Check-in/check-out time
   - House rules (guests, pets, smoking, etc.)
   - Contact method (messaging or host direct)

3. Guest can:
   - Save to wishlist
   - Message host with questions
   - Add to favorites

**Exit:** Guest ready to book → **Step 3**

---

## Step 3: Guest Initiates Booking
**Actor:** Guest  
**Duration:** 5 minutes

1. Guest enters booking widget:
   - Confirms dates (check-in, check-out)
   - Party breakdown: adults, children, infants, pets
   - Verifies guest count ≤ unit capacity

2. System computes price:
   - Per-night rate × nights
   - Length-of-stay discount (if applicable)
   - Cleaning fee
   - Service fee (12%)
   - Occupancy tax (per-country)
   - **Total shown to guest**

3. Guest reviews breakdown and clicks "Reserve" or "Request to Book"
   - **Instant Book listing:** Creates pending reservation, proceeds to payment
   - **Request-to-Book listing:** Sends approval request to host, guest waits

**For Request-to-Book:**
- Host receives notification & has 24h to approve/decline
- If approved → pending hold created, guest pays
- If declined → guest notified, dates freed

**Exit:** Pending reservation created → **Step 4**

---

## Step 4: Guest Pays (Checkout)
**Actor:** Guest  
**Duration:** 10 minutes

1. Guest redirected to checkout page
2. Guest enters payment method:
   - Card (via Stripe, if configured)
   - Mock payment (for testing)
3. Guest reviews:
   - Total amount
   - Billing name & email
   - Terms & cancellation policy

4. Guest submits payment
5. System:
   - Verifies payment with provider
   - Marks reservation as **confirmed**
   - Sends confirmation email to guest
   - Notifies host
   - Blocks dates in calendar

**Exit:** Reservation confirmed → **Step 5**

---

## Step 5: Guest Check-In (Immigration & Physical)
**Actor:** Guest, Host, Staff  
**Duration:** Varies

### Pre-Arrival (24-48h before)
1. Guest receives email with:
   - Check-in instructions
   - WiFi/parking info
   - Emergency contacts
   - House rules reminder

2. System triggers:
   - TM30 filing (if foreign guest) — must be completed within 24h of arrival
   - Host notification reminder

### At Check-In
1. Guest arrives at unit
2. Host or staff:
   - Verifies guest identity
   - Checks against reservation
   - Delivers keys/access codes
   - Walks guest through unit
   - Explains appliances, WiFi, emergency exits

3. Guest receives:
   - Physical house rules guide
   - Inventory checklist (to photo/sign)
   - Contact sheet

### Post-Check-In (24h after arrival)
1. System sends guest welcome message
2. Guest can message host/staff with issues
3. Host marks "checked in" in system

**Exit:** Guest settled, stay begins

---

## Cancellations & Refunds

### Guest Cancels
**Flexible Policy:**
- Full refund up to check-in

**Moderate Policy:**
- Full refund until 7 days before check-in
- 50% refund 7–1 days before
- No refund within 24h

**Strict Policy:**
- Full refund until 30 days before check-in
- 50% refund 30–7 days before
- No refund within 7 days

Refund issued within 5-7 business days (payment processor dependent).

### Host Cancels
- Full refund to guest + rebooking credit
- Host penalized (affects Superhost status)

---

## SLA & Escalation

| Issue | Response Time | Owner |
|-------|---------------|-------|
| Check-in delay/access issue | 1 hour | Host/Staff |
| Maintenance emergency (no water, heat, etc.) | 2 hours | Staff |
| Guest damage claim | 24 hours | Ops Team |
| TM30 not filed | 24h from arrival | Compliance |

**Escalation:** If host doesn't respond, ops staff takes over.

---

## Success Metrics
- Check-in within ±30 min of scheduled time
- TM30 filed within 24h for foreign guests
- Zero critical maintenance issues during stay
- Guest satisfaction rating ≥4/5

---

## Related Docs
- Guest Communication SOP
- Host Property Management SOP
- TM30 Immigration Compliance SOP
- Payment & Refund Policy
