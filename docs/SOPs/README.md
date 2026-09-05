# myUNO Standard Operating Procedures (SOPs)

## Overview
This directory contains comprehensive, step-by-step Standard Operating Procedures for all key business processes in the myUNO platform. SOPs are written for non-technical stakeholders and provide clear guidance on how to execute each process.

---

## SOP Directory

### 1. **Guest Booking & Check-In** 
`01_guest_booking_checkin.md`

**Scope:** End-to-end guest booking experience, from listing discovery through check-in.

**Key Sections:**
- Listing discovery & review
- Booking initiation (Instant Book vs. Request-to-Book)
- Payment processing
- Pre-arrival preparation
- Check-in & check-out procedures
- Cancellation & refunds
- SLA & escalation

**Audience:** Guests, hosts, operations staff

**Duration:** 5 mins (discovery) → 5 mins (payment) → varies (check-in)

---

### 2. **Host Property Management**
`02_host_property_management.md`

**Scope:** Everything a host needs to manage their property(ies) on myUNO.

**Key Sections:**
- Create & activate new listings
- Manage availability (block dates, seasonal pricing)
- Manage reservations (approvals, cancellations)
- Check-in & check-out operations
- Maintenance & issue resolution
- Monthly financial settlements & payouts
- Superhost eligibility & tracking

**Audience:** Hosts, property owners, operations staff

**Duration:** 30–60 mins (listing creation) → ongoing (management)

---

### 3. **Payments & Financial Operations**
`03_payments_financial.md`

**Scope:** All payment flows, refunds, deposits, and financial settlements.

**Key Sections:**
- Payment methods & setup
- Guest booking payment flow
- Deposit management (damage prevention)
- Refunds & cancellations per policy
- Monthly owner statements & payouts
- Multi-currency support (future)
- PII protection & compliance
- Troubleshooting & escalation

**Audience:** Guests, hosts, finance staff, ops

**Duration:** 5–10 mins (guest payment) → 3–7 days (refund settlement)

---

### 4. **CRM & Lead Management**
`04_crm_lead_management.md`

**Scope:** Customer relationship management, from lead ingestion through opportunity closure.

**Key Sections:**
- Lead sources & ingestion
- Lifecycle stage management (Contact → Guest → Prospect → Buyer → Owner)
- Opportunity creation & management
- Lead scoring & qualification
- Communication & messaging
- Opportunity closure (Closed Won / Closed Lost)
- Reporting & analytics
- PDPA compliance

**Audience:** Sales team, CRM users, marketing, management

**Duration:** Varies (days to months per deal)

---

### 5. **Service Ordering & Fulfillment**
`05_service_ordering.md`

**Scope:** Service marketplace — how customers order services and providers fulfill them.

**Key Sections:**
- Browse services marketplace
- Request service
- Provider response & acceptance
- Payment & deposit
- Service fulfillment
- Quality review & rating
- Payment settlement to providers
- Issue resolution & escalation
- Provider vetting & management
- Reporting & analytics

**Audience:** Guests, residents, owners, service providers, ops staff

**Duration:** 5 mins (browse) → 2 hours (provider response) → varies (fulfillment)

---

### 6. **Production Cutover — the console actions**
`06_production_cutover.md`

**Scope:** The remainder of Stage 1 of the production plan — every step that needs a console or a credential no agent has. Unlike the SOPs above, this is a one-time sequence, not a repeating business process.

**Key Sections:**
- Close the public-API exposure (four tables readable through Supabase's REST endpoint — **do this first**)
- Verify `ENCRYPTION_KEY`, and establish whether it can still be rotated at all
- Rotate the production credential leaked into developer `.env` files
- Turn on error alerting and uptime monitoring
- Enable the real scheduler (restores doc 15's 5-minute cadence at no cost)
- Enable backups, and walk the recovery runbook once on purpose
- Confirm what the provider's plan tier actually gives

**Audience:** Founder, or an operator with Supabase, Vercel and GitHub admin access

**Duration:** ~2 hours, plus one deliberate restore walk-through

---

## How to Use These SOPs

### For Guests & Users
1. **Find your process:** Look at the process name (e.g., "Booking a stay")
2. **Open the SOP:** Go to the corresponding SOP document
3. **Follow steps in order:** Each step is numbered and explains what to do
4. **Check tables:** SLA, escalation, and troubleshooting tables provide quick reference

**Example:** "How do I cancel my booking?" → See `01_guest_booking_checkin.md` → Section "Cancellations & Refunds"

### For Staff & Operations
1. **Understand the flow:** Each SOP shows the complete workflow with actors (who does what)
2. **Follow your role:** Find your role (Host, Staff, Finance, etc.) and follow your steps
3. **Know your SLA:** Check the SLA & Escalation tables to understand response times
4. **Escalate correctly:** Use the escalation paths for issues outside your scope

**Example:** "A guest claims damage; what do I do?" → See `03_payments_financial.md` → Section "Damage Claim Process"

### For Training & Onboarding
1. **New team member?** Start with relevant SOPs in order (e.g., ops staff: 1 → 2 → 3 → 5)
2. **New host?** Start with `02_host_property_management.md`
3. **New guest?** Start with `01_guest_booking_checkin.md`
4. **New sales staff?** Start with `04_crm_lead_management.md`

---

## SOP Structure (Standard Format)

Each SOP follows this structure:

1. **Overview** — What the process does
2. **Step-by-step instructions** — Numbered sections with:
   - Actor (who's doing the action)
   - Duration (how long it takes)
   - Actions (what to do)
   - Exit condition (what happens next)
3. **Tables** — SLA, escalation, troubleshooting
4. **Related docs** — Links to other SOPs or policies

---

## Key Processes NOT YET DOCUMENTED

These will be added in future updates:

- TM30 Immigration Compliance (filing procedures for foreign guests)
- Dispute Resolution & Arbitration (for contracts & claims)
- Damage Claim Assessment & Recovery
- Tax & Accounting (quarterly/annual filings)
- Marketing & Promotional Campaigns
- Staff Onboarding & Training
- Vendor Management & Procurement
- Incident Management & Business Continuity

---

## SLA Summary (Quick Reference)

| Process | Key SLA |
|---------|----------|
| Booking request (host response) | 24 hours |
| Payment processing | Real-time |
| Refund issuance | 3–7 business days |
| Owner payout | 3–5 business days |
| Service provider response | 2 hours |
| Issue escalation | 7 days |
| CRM opportunity qualification | 3–5 days |

---

## Roles & Responsibilities

### Guests
- Book stays
- Provide feedback via reviews
- Report issues promptly
- Follow house rules

### Hosts
- Approve/decline booking requests within 24h
- Respond to guest messages within 2h
- Prepare unit for arrival
- Conduct inspections at check-out
- Provide accurate property information

### Service Providers
- Respond to service requests within 2h
- Complete services on time
- Maintain quality standards (≥4.0 rating)
- Communicate professionally

### Operations Staff
- Monitor SLA compliance
- Escalate issues per policy
- Investigate disputes
- File TM30 & compliance docs
- Support emergency maintenance

### Finance Team
- Process payments & refunds
- Generate monthly statements
- Pay out hosts & providers
- Track financial metrics
- Ensure PII/data security

### CRM/Sales Team
- Manage leads & opportunities
- Qualify prospects
- Track conversion metrics
- Report on pipeline & performance
- Maintain contact data accuracy

---

## Version Control & Updates

- **Current Version:** 1.0 (August 2026)
- **Last Updated:** 2026-08-14
- **Next Review:** 2026-11-14 (quarterly)

**To request updates or clarifications:** Create an issue with tag `#SOP-Update` or contact the Operations team.

---

## Contact & Support

For questions on these SOPs:
- **Operations Lead:** [TBD]
- **Finance Questions:** [TBD]
- **CRM/Sales Questions:** [TBD]
- **Technical Questions:** ops@myuno.local

---

## Related Documents

- **Architecture & Tech Spec:** `docs/14_tech_spec.md`
- **Business Model:** `docs/business/Ignatev_Estate_Business_and_Operating_Model_v3.md`
- **Data Model:** `docs/02_data_model.md`
- **Roles & Permissions:** `docs/03_roles_and_permissions.md`
- **Configuration:** `docs/04_configuration.md`
- **Flows & Journeys:** `docs/07_flows.md`
- **Payment Policy:** `docs/10_payments.md`
- **Security & Privacy:** `docs/12_security_privacy.md`
- **Build Plan:** `docs/16_build_plan.md`
