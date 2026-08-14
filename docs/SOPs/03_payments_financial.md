# SOP: Payments & Financial Operations

## Overview
Process for handling guest payments, deposits, and financial transactions.

---

## Step 1: Payment Methods & Setup
**Actor:** Finance Team, Guest  
**Duration:** Ongoing

### 1.1 Accepted Payment Methods
- **Primary:** Stripe card payments (Visa, Mastercard, etc.)
- **Fallback:** Mock payment (for testing / if Stripe unavailable)
- **Future:** Thai local methods (e.g., PromptPay) — Q3 2026

### 1.2 Guest Payment Configuration
1. At registration, guest can:
   - Add card details (optional — stored securely via Stripe)
   - Select saved card at checkout
   - Or enter card details at each booking

2. All card data handled by Stripe (PCI-DSS compliant)
3. myUNO never stores full card numbers

### 1.3 Host Payout Configuration
1. Host provides:
   - Bank account details
   - Account holder name
   - Bank code (Thailand)

2. Finance team verifies bank details
3. Monthly payouts routed to account

---

## Step 2: Guest Booking Payment
**Actor:** Guest  
**Duration:** 5-10 minutes

### 2.1 Checkout Page
1. Guest views booking summary:
   - Nightly rate × nights
   - Length-of-stay discount (if applicable)
   - Cleaning fee
   - Service fee (12% of subtotal)
   - Occupancy tax
   - **Total in guest's local currency** (if multi-currency enabled)

2. Guest enters:
   - Billing email
   - Card details (or select saved card)
   - Name on card

### 2.2 Payment Processing
1. Stripe processes transaction
2. One of two outcomes:

**✅ Success:**
- Reservation marked **confirmed**
- Confirmation email sent to guest
- Host notified
- Dates blocked in calendar
- Funds held in Stripe account (not transferred to host yet)

**❌ Failed:**
- Error message shown to guest (card declined, wrong CVC, etc.)
- Guest can retry or use different card
- Reservation remains **pending** (not confirmed)
- Hold expires after `HOLD_MINUTES` (default: 15 minutes)

### 2.3 Post-Payment
1. Guest receives:
   - Confirmation email with booking details
   - Check-in instructions (24h before arrival)
   - Host contact info

2. Funds held in Stripe until:
   - Guest checks out (full stay completed)
   - Guest cancels (refund issued, or held per policy)

---

## Step 3: Deposit Management (Damage Prevention)
**Actor:** Host, Guest  
**Duration:** Varies

### 3.1 Deposit Setup (Future — Q4 2026)
1. Host can optionally require deposit:
   - Amount: 0–100% of nightly rate
   - Held as Stripe pre-authorization (not charged)

2. Guest sees deposit amount at booking
3. Deposit released post-checkout if no damage

### 3.2 Damage Claim Process
1. At check-out, host inspects property
2. If damage found:
   - Host initiates damage claim
   - Uploads photos
   - Describes damage & repair cost
3. System notifies guest of claim
4. Guest can accept or dispute
5. If accepted: Deposit charged; guest refunded remaining balance
6. If disputed: Escalated to ops team for adjudication

**SLA:** Damage claim must be filed within 48h of check-out

---

## Step 4: Refunds & Cancellations
**Actor:** Guest, Finance Team  
**Duration:** 5-7 business days (payment processor)

### 4.1 Guest-Initiated Cancellation
1. Guest cancels via app/website
2. System computes refund per cancellation policy:

| Policy | Timing | Refund |
|--------|--------|--------|
| **Flexible** | Up to check-in | 100% |
| **Flexible** | After check-in | 0% |
| **Moderate** | 7+ days before | 100% |
| **Moderate** | 1–7 days before | 50% |
| **Moderate** | <1 day before | 0% |
| **Strict** | 30+ days before | 100% |
| **Strict** | 7–30 days before | 50% |
| **Strict** | <7 days before | 0% |

3. Refund processed automatically via Stripe
4. Guest receives notification with refund amount & timeline
5. Refund appears in guest's account within 3–7 business days (bank dependent)
6. Dates freed immediately for new bookings

### 4.2 Host Cancellation
1. If host cancels:
   - Guest receives 100% refund (immediately)
   - Guest receives rebooking credit (same amount) for future booking
   - Host penalized (cancellation rate tracked)

---

## Step 5: Financial Reporting & Settlement
**Actor:** Finance Team, Host  
**Duration:** Monthly

### 5.1 Monthly Owner Statement
**Timing:** Generated on day 7 of each month

**Statement includes:**
- Gross revenue (all booking payments)
- Breakdown by property & date range
- Service fees (myUNO commission)
- Refunds issued
- Damage claim deductions
- Cleaning/maintenance costs (if applicable)
- **Net owner payout**

**Example:**
```
Gross Revenue:             150,000 THB (5 bookings)
  - Service fee (15%):     -22,500 THB
  - Cleaning costs:        -5,000 THB
  ─────────────────────────────────
Net Payout:               122,500 THB
```

### 5.2 Statement Approval & Payout
1. Finance team reviews statement
2. Owner signs off (can happen via mobile)
3. Payout initiated (within 24h)
4. Funds transferred to host's bank account (within 3–5 business days)

### 5.3 Statement Access
- Host views at any time: Dashboard → "Earnings" → "Monthly Statements"
- Downloadable as PDF
- Contains line-item detail (each booking)

---

## Step 6: Multi-Currency Support (Future)
**Actor:** Guest, Finance Team  
**Duration:** Varies

### 6.1 Guest Display Currency
1. Guest selects currency in settings (GBP, USD, EUR, etc.)
2. All prices converted for display only (via daily FX rates)
3. Stripe handles local payment method (guest's local card)

### 6.2 Actual Charge
- Guest charged in their local currency (Stripe determines rate)
- Host always paid in THB (myUNO converts FX risk)

### 6.3 Host FX Exposure
- myUNO absorbs FX loss/gain
- Host receives consistent THB amount

---

## Step 7: Compliance & PII Protection

### 7.1 Card Data
- **Never stored by myUNO** — all via Stripe (PCI-DSS)
- Stripe tokens stored locally (used for recurring/saved cards)

### 7.2 Audit Trail
- All transactions logged in audit database
- Finance team can retrieve:
  - Payment method used
  - Exact amount charged
  - Timestamp
  - Refund status
  - Error messages (if any)

### 7.3 Regulatory
- Monthly reports to tax authority (if required)
- Zero AML (anti-money laundering) violations
- KYC (know-your-customer) checks on hosts with 10+ bookings/month

---

## Step 8: Troubleshooting & Escalation

| Issue | Symptom | Resolution | Owner |
|-------|---------|------------|-------|
| Payment declined | Guest sees error at checkout | Guest retries with different card or contacts issuer | Guest |
| Refund stuck | Guest doesn't see refund after 7 days | Finance team investigates with Stripe; manual transfer if needed | Finance |
| Missing payout | Host doesn't receive monthly payment | Finance team checks bank details; resends if needed | Finance |
| Duplicate charge | Guest charged twice for 1 booking | Refund issued within 24h (one of two charges) | Finance |

---

## SLA & Escalation

| Item | SLA | Owner |
|------|-----|-------|
| Payment processing | Real-time (Stripe) | Stripe |
| Refund issuance | Within 3–7 business days | Payment processor |
| Owner payout | Within 3–5 business days | Bank |
| Damage claim decision | Within 48h (if accepted) or 7 days (if disputed) | Ops/Admin |
| PII breach notification | Within 24h | Compliance |

---

## Related Docs
- Guest Booking & Check-In SOP
- Host Property Management SOP
- Damage Claim & Refund SOP
- Financial Settlement & Payouts SOP
- PII & Security Policy (doc 12)
