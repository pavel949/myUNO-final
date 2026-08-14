# SOP: CRM & Lead Management

## Overview
Process for managing customer relationships, leads, opportunities, and lifecycle stages.

---

## Step 1: Lead Ingestion
**Actor:** Marketing, CRM User  
**Duration:** Varies

### 1.1 Lead Sources
Leads enter myUNO via multiple channels:
1. **Direct sign-up:** Guest registers on website/app
2. **Inquiry form:** Prospect submits "Contact Us" form
3. **Lead API:** External system pushes leads via `POST /api/leads`
4. **Manual entry:** Staff enters contact in CRM dashboard
5. **Service request:** Prospect submits service request (becomes potential opportunity)

### 1.2 Lead Creation
1. System automatically creates **CRM Profile** for new lead:
   - Name
   - Email
   - Phone
   - Source (where they came from)
   - Timestamp

2. Default lifecycle stage: **Contact**

3. Staff can add:
   - Company
   - Interests (guest, owner, investor, advisor)
   - Notes
   - Tags (VIP, investor, builder, etc.)

### 1.3 Lead Enrichment
1. Staff (or auto-system) enriches contact with:
   - Social profiles (LinkedIn, etc.)
   - Location details
   - Company info
   - Interests (keywords from inquiry)

---

## Step 2: Lifecycle Stage Management
**Actor:** CRM User, Sales Staff  
**Duration:** Ongoing

### 2.1 Lifecycle Stages
Each contact progresses through stages:

```
Contact
  ↓
Guest (booked stay)
  ↓
Prospect (repeat interest or purchase interest)
  ↓
Buyer (negotiating or closed purchase)
  ↓
Owner (owns unit in project)
  ↓
Seller (exiting owner status)
```

**Note:** Each arrow is bidirectional—contacts can move backward too (e.g., Owner → Prospect if considering sale).

### 2.2 Stage Transition
1. Staff navigates to contact profile
2. Staff clicks "Transition Stage"
3. System shows **valid transitions** per current stage
4. Staff selects new stage
5. System records:
   - Old stage
   - New stage
   - Timestamp
   - Staff member who transitioned
   - Reason (optional)

**SLA:** Opportunity-bearing contacts (buyer, owner prospects) reviewed at least weekly

### 2.3 Guest Lifecycle (Example)
1. **Contact** → books first stay
2. → **Guest** (marked automatically post-booking)
3. → Completes stay, rates property
4. → If shows interest in repeat bookings → **Prospect** (potential owner)
5. → Engaged in property purchase discussion → **Buyer**
6. → Closes purchase deal → **Owner**

---

## Step 3: Opportunity Management
**Actor:** Sales, CRM User  
**Duration:** Varies

### 3.1 Opportunity Types
An **opportunity** is a potential deal:
- **Rental:** Guest interested in long-term booking
- **Purchase:** Individual considering property purchase
- **Sale:** Owner considering selling unit
- **Management:** Owner seeking management services
- **Development:** Investor considering land acquisition

### 3.2 Create Opportunity
1. Staff clicks contact → "Add Opportunity"
2. Staff enters:
   - Opportunity name (e.g., "Buyer - Riverside Villa")
   - Type (rental, purchase, sale, etc.)
   - Value (estimated deal size in THB)
   - Target close date
   - Project (if applicable)
   - Notes

3. Opportunity created in **Open** stage

### 3.3 Opportunity Stages
Opportunities move through:

```
Open
  ↓
Qualified (budget & authority confirmed)
  ↓
Proposal (term sheet or offer sent)
  ↓
Negotiation (back-and-forth on terms)
  ↓
Closed Won (deal finalized)
   OR
Closed Lost (deal fell through)
```

### 3.4 Activities & Follow-up
1. Staff creates **activity** on opportunity:
   - Type: Call, Email, Meeting, Note, Task
   - Details: Summary of conversation
   - Next step (if applicable)
   - Follow-up date

2. System notifies assigned staff of due follow-ups
3. Activities logged for audit trail

**Example:**
- Activity: "Call with buyer re: financing"
- Notes: "Approved for 8M THB loan, wants 15% discount"
- Next: "Send updated proposal by Friday"

---

## Step 4: Lead Scoring & Qualification
**Actor:** CRM System, Sales Manager  
**Duration:** Ongoing

### 4.1 Lead Score
System auto-computes **lead score** (0–100) based on:
- Email opens (prospect engaged)
- Website visits & pages viewed
- Service inquiries submitted
- Lifecycle stage (owners = high score)
- Engagement frequency

**Score ranges:**
- **80–100:** Hot lead (immediate follow-up)
- **50–79:** Warm lead (regular follow-up)
- **0–49:** Cold lead (nurture track)

### 4.2 Qualification Criteria
Before moving to "Qualified" stage, confirm:
- ✅ Has budget (can afford purchase/service)
- ✅ Has authority (decision-maker or influencer)
- ✅ Has timeline (realistic close date)
- ✅ Has pain point (rental income, capital preservation, etc.)

If criteria not met → stay in "Open" or return to earlier stage

---

## Step 5: Communication & Messaging
**Actor:** Sales Staff, Assigned User  
**Duration:** Varies

### 5.1 Channels
Contact via:
- **Email:** Mass campaigns or 1:1 follow-up
- **In-app messaging:** Direct message within myUNO (if contact is registered user)
- **WhatsApp/Telegram:** Manual outreach (not integrated yet)
- **Phone:** Direct call

### 5.2 Message Log
Every communication logged in contact timeline:
- Sender
- Channel (email, call, message, etc.)
- Timestamp
- Content summary
- Response (if any)

### 5.3 Unsubscribe
Contact can unsubscribe from marketing emails (PDPA compliant):
- One-click unsubscribe link in every email
- Staff respects preference immediately
- Contact remains in CRM for transaction history

---

## Step 6: Opportunity Closure
**Actor:** Sales, Finance  
**Duration:** Varies

### 6.1 Closed Won (Deal Finalized)
1. Staff clicks opportunity → "Mark as Closed Won"
2. Staff enters:
   - Actual deal value (if different from estimate)
   - Deposit/payment received (if applicable)
   - Expected revenue to myUNO

3. Opportunity marked **Closed Won**
4. Contact lifecycle progresses (e.g., Buyer → Owner)
5. New transactions created (booking, service order, property registration, etc.)

### 6.2 Closed Lost (Deal Fell Through)
1. Staff clicks opportunity → "Mark as Closed Lost"
2. Staff enters:
   - Reason (budget, timeline, competitor, etc.)
   - Loss notes

3. Opportunity marked **Closed Lost**
4. Staff can re-engage (nurture for future) or archive

---

## Step 7: Reporting & Analytics
**Actor:** Sales Manager, Executive  
**Duration:** Monthly/Quarterly

### 7.1 CRM Dashboard
Views:
- **Pipeline:** Open opportunities by stage & value
- **Activity:** Recent calls, emails, tasks
- **Conversion funnel:** Contact → Guest → Owner (conversion rates)
- **Lead sources:** Which channels produce most deals
- **Rep performance:** Each sales rep's closed deals & pipeline

### 7.2 Attribution
System tracks:
- **Source:** How did lead first arrive (direct sign-up, referral, ad, etc.)
- **Campaign:** Which marketing campaign (if applicable)
- **Medium:** Email, social, organic, paid, etc.
- **Journey:** All touchpoints from first contact to closed deal

**Example:**
```
Lead source: Google Ad → Website sign-up
Campaign: Summer Promo
Medium: Paid search
Touchpoints: Ad click → Home page → Listing view → Inquiry form → Call → Proposal → Closed Won
```

### 7.3 Export & Analysis
- Export contacts to CSV
- Export opportunities to Excel
- Generate monthly reports (PDF)
- Share dashboards with team

---

## Step 8: Privacy & PDPA Compliance
**Actor:** Compliance, CRM User  
**Duration:** Ongoing

### 8.1 Consent Tracking
- Contact opt-in/opt-out preference recorded
- Timestamp of consent
- Consent method (form submission, verbal, etc.)

### 8.2 Data Retention
- Inactive contacts (no activity for 2 years) → archive or delete per PDPA
- Active contacts → retained as long as relationship exists

### 8.3 PII Protection
- Contact phone & email marked as sensitive (🔒)
- Only authorized staff can view
- Access logged & audited

---

## SLA & Escalation

| Activity | SLA | Owner |
|----------|-----|-------|
| Lead response | Within 24h | Sales |
| Opportunity qualification | 3–5 days | Sales |
| Proposal sent | Within 7 days of request | Sales |
| Close follow-up | 1–2 weeks after contact | Sales Manager |
| Lost opportunity re-engagement | Within 3 months | Retention |

---

## Related Docs
- Communication & Messaging SOP
- Email Campaign Guidelines
- Sales Process & Closing SOP
- PDPA Privacy Policy (doc 12)
