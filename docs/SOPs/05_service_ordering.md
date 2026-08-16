# SOP: Service Ordering & Fulfillment

## Overview
Process for users (guests, residents, owners) to order services (cleaning, maintenance, amenities) and for providers to fulfill.

---

## Step 1: Browse Services Marketplace
**Actor:** Guest, Resident, Owner  
**Duration:** 10-20 minutes

### 1.1 Discover Services
1. User navigates to "Services" → "Marketplace"
2. Services displayed by category:
   - Cleaning (daily, weekly, turnover)
   - Maintenance (appliance repair, painting, plumbing)
   - Amenities (massage, yoga, concierge)
   - Supplies (groceries, toiletries delivery)
   - Other

3. User can:
   - Filter by availability (same-day, scheduled)
   - Filter by price range
   - Sort by rating or popularity

### 1.2 View Service Detail
1. User clicks service → detail page shows:
   - Provider name & avatar
   - Service description
   - Price (per hour, per session, fixed)
   - Availability (calendar)
   - Reviews from past customers
   - Provider profile (background check status, certifications)

2. User can message provider with questions

---

## Step 2: Request Service
**Actor:** Guest, Resident, Owner  
**Duration:** 5 minutes

### 2.1 Create Service Order
1. User clicks "Request Service"
2. User enters:
   - Preferred date & time
   - Duration (if applicable)
   - Special requests (e.g., "hypoallergenic products")
   - Location (unit address auto-filled)

3. System calculates:
   - Service price
   - Travel fee (if applicable)
   - Total

4. User reviews and clicks "Request"
5. Service order created in **Requested** status

### 2.2 Order Confirmation
- Provider notified: "New service request"
- User receives notification: "Request sent"
- SLA: Provider must respond within 2 hours

---

## Step 3: Provider Response
**Actor:** Service Provider  
**Duration:** Varies

### 3.1 Accept or Decline
1. Provider receives notification
2. Provider reviews request:
   - Date/time convenient?
   - Service scope clear?
   - Customer acceptable (no negative reviews)?

3. Provider options:
   - **Accept:** Service moves to **Confirmed**
   - **Decline:** Service marked **Declined**, customer notified
   - **Propose alternate time:** Suggests different date/time

### 3.2 Confirmed Service Order
Once accepted:
- Calendar blocked for provider
- Customer notified: "Service confirmed"
- Pre-arrival checklist sent to customer (e.g., "ensure access to unit")
- Provider receives directions & access codes

---

## Step 4: Payment & Deposit
**Actor:** Customer, Finance  
**Duration:** Immediate

### 4.1 Upfront Payment (For Confirmed Orders)
1. For services with fixed price:
   - Customer charged immediately (via card on file)
   - Funds held in escrow until service complete

2. For time-based services:
   - Deposit (typically 50% of estimated cost) charged upfront
   - Balance charged after completion

3. Customer receives:
   - Confirmation email with total
   - Receipt number
   - Cancellation policy

### 4.2 Cancellation Policy
- **Provider cancels 24h+ before:** Full refund to customer
- **Provider cancels <24h before:** 50% refund to customer, 50% to provider (cancellation fee)
- **Customer cancels 24h+ before:** Full refund
- **Customer cancels <24h before:** Forfeit deposit (goes to provider)

---

## Step 5: Service Fulfillment
**Actor:** Service Provider, Customer  
**Duration:** Varies

### 5.1 Provider Arrival
1. Provider arrives on scheduled date/time
2. Provider:
   - Texts/calls customer upon arrival
   - Enters unit (with access code)
   - Sets up work area

### 5.2 Service Execution
1. Provider performs service per agreement
2. Provider:
   - Takes before/after photos (for certain services)
   - Documents any issues found
   - Notes any additional work requested

3. Customer:
   - Inspects progress (if present)
   - Can request adjustments in real-time

### 5.3 Service Completion
1. Provider notifies customer: "Service complete"
2. Provider uploads:
   - Completion photos
   - Time log (if time-based)
   - Invoice/receipt

3. Service moved to **Completed** status

---

## Step 6: Quality Review & Rating
**Actor:** Customer  
**Duration:** 5 minutes

### 6.1 Rating Service
1. Customer receives notification: "Rate this service"
2. Customer rates:
   - Overall rating (1–5 stars)
   - Category ratings:
     - Quality of work
     - Timeliness
     - Communication
     - Value for money

3. Customer can add written review:
   - What went well
   - What could improve
   - Recommendation

### 6.2 Rating Impact
- Ratings visible on provider's profile
- Low ratings (<3 stars) flag for review:
  - Customer can request refund
  - Ops may suspend provider if pattern emerges

### 6.3 Provider Response
- Provider can reply to written reviews
- Must maintain professional tone

---

## Step 7: Payment Settlement
**Actor:** Finance, Provider  
**Duration:** Varies

### 7.1 Final Charge (Time-Based Services)
1. If service was time-based:
   - Actual hours logged (e.g., 2.5 hours)
   - Hourly rate applied
   - Balance computed (Total - Deposit)

2. Final balance charged to customer
3. Provider notified of final amount owed

### 7.2 Provider Payout
1. Weekly payouts to providers:
   - Confirmed & completed services paid out
   - Refunds & cancellations deducted
   - myUNO commission deducted (typically 20%)

2. Example payout:
   ```
   Gross service value:     1,000 THB
   - myUNO commission (20%): -200 THB
   - Cancellation refund:   -0 THB
   ─────────────────────────────────
   Provider payout:          800 THB
   ```

3. Payout transferred to provider's bank within 3–5 business days

---

## Step 8: Issue Resolution
**Actor:** Customer, Provider, Ops  
**Duration:** Varies

### 8.1 Common Issues
- **Provider no-show:** Customer charged $0, full refund; provider warned/suspended
- **Poor quality:** Customer can request partial refund (ops adjudicates); low rating flags provider
- **Missing items:** Customer documents with photos; provider reimburses or makes good
- **Accident/damage:** Customer files claim; insurance or provider liable

### 8.2 Escalation
1. Customer initiates dispute within 48h of service
2. Ops team reviews:
   - Photos
   - Messages between parties
   - Provider reputation
   - Service description

3. Ops decision:
   - **Customer favored:** Refund issued
   - **Provider favored:** No refund (customer keeps rating-rating option)
   - **Split:** Partial refund (50–50 split)

**SLA:** Resolution within 7 days

---

## Step 9: Provider Management
**Actor:** Admin, HR  
**Duration:** Ongoing

### 9.1 Provider Vetting
Before going live:
1. Background check (criminal, civil)
2. Reference checks (2–3)
3. Skills verification (certifications, portfolio)
4. Trial service (observed by staff)

**Approval:** After passing all, marked as **Approved**

### 9.2 Performance Monitoring
Monthly tracked:
- Number of services completed
- Avg customer rating
- Cancellation rate
- No-shows
- Complaints

**Benchmarks:**
- Avg rating must be ≥ 4.0/5
- No-show rate < 5%
- Cancellation rate < 10%

### 9.3 Suspension & Termination
- **Warning:** Rating drops <3.5 or 2+ complaints
- **Suspension:** Rating <3.0 or 5+ complaints; can reapply after 30 days
- **Termination:** Background check issue discovered, criminal activity, or persistent poor performance

---

## Step 10: Reporting & Analytics
**Actor:** Operations Manager  
**Duration:** Monthly

### 10.1 Service Dashboard
Views:
- Total services requested/completed/cancelled
- Top-rated services
- Top-rated providers
- Service category breakdown (cleaning, maintenance, etc.)
- Average rating trend

### 10.2 Provider Performance Report
- Requests received
- Acceptance rate
- Completion rate
- Avg rating
- Revenue generated (for each provider)

### 10.3 Customer Satisfaction
- NPS (Net Promoter Score) for services
- Churn rate (customers who used once vs. repeat)
- Revenue per customer

---

## SLA & Escalation

| Item | SLA | Owner |
|------|-----|-------|
| Provider response | 2 hours | Provider |
| Service execution | Per scheduled time ±30 min | Provider |
| Payment (fixed price) | At booking confirmation | Finance |
| Final balance charge (time-based) | Within 24h of completion | Finance |
| Provider payout | Within 3–5 business days | Finance |
| Rating prompt | Within 24h of completion | System |
| Issue resolution | Within 7 days | Ops |
| Provider suspension review | Within 30 days | HR |

---

## Related Docs
- Payment & Financial SOP
- Damage Claim & Dispute Resolution SOP
- Provider Vetting & Onboarding SOP
- Service Marketplace Guidelines
