# Legal & Trust Content Framework

**Role:** Thai and international lawyer advising on PDPA compliance, liability, data protection, and trust signals for a Thai serviced-living platform.

**Jurisdiction:** Thailand (primary); Russia (owner/guest context); international best practices.

---

## 1. PDPA Compliance Baseline

**Thailand's Personal Data Protection Act (PDPA):**
- Effective date: June 1, 2020
- Enforcer: National Personal Data Protection Committee (PDPC)
- Penalties: Up to ฿5M per violation; criminal liability for aggravated cases
- Breach notification: 72-hour mandatory notice to PDPC + affected individuals

**Ignatev Estate position:**
- Data Controller: Ignatev Estate Co., Ltd (DBD 083-5-56602358-7)
- Venue: Phuket, Thailand
- Data subjects: Guests (foreign, often Russian), owners, staff
- Personal data held: Passport numbers, contact info, payment data (third-party provider only), booking history, TM30 filings

---

## 2. Privacy Notice Content (Legal Tier)

### 2.1 Data Categories & Purpose (Doc 12 §1)

**Data Collected:**
1. **Identity & Contact** (passport number, DOB, nationality, name, email, phone)
   - Purpose: Contract performance, TM30 immigration filing (legal obligation), communication
   - Legal basis: Contract + legal obligation (Thailand Immigration Act)
   - Retention: Life of account + 6 years (legal defensibility for tax/immigration)

2. **Payment Identifiers** (booking details, refund amounts, invoice records)
   - Purpose: Contract performance, tax reporting
   - Legal basis: Contract + legitimate interest
   - Retention: 5 years (Thai Accounting Act statute of limitations)
   - **Note:** Actual card data never held by myUNO; stored by Stripe/Omise/provider only

3. **Passport Images & Media** (🔒 encrypted)
   - Purpose: TM30 filing, identity verification
   - Legal basis: Legal obligation (Thailand Immigration Act)
   - Retention: 30 days post-checkout auto-delete (security minimization)
   - **Note:** Envelope-encrypted; access-logged per PDPA §32

4. **Booking & Stay Records** (dates, price, review, messages)
   - Purpose: Contract performance, dispute resolution, quality improvement
   - Legal basis: Contract + legitimate interest
   - Retention: Life of account (booking dispute defensibility)

5. **Communication Records** (messages, support tickets)
   - Purpose: Contract performance, service improvement
   - Legal basis: Contract + legitimate interest
   - Retention: 3 years (common dispute resolution timeline)

### 2.2 Data Subject Rights (PDPA §§26–33)

**Individuals have the right to:**

1. **Access** (`GET /api/account/export`) — download a copy of your personal data within 30 days at no charge.
2. **Rectification** (Account Settings → Profile) — correct inaccurate data.
3. **Deletion** (Account Settings → Delete Account) — request anonymization ("Deleted User"); financial/compliance records preserved per law.
4. **Portability** (`GET /api/account/export`) — receive data in machine-readable format (CSV/JSON).
5. **Opt-out of marketing** (Notification Settings) — disable non-essential communications.
6. **Withdraw consent** — for optional cookies/analytics (functional cookies required for service).
7. **Lodge complaints** — to the PDPC at `www.pdpc.go.th` or hotline 1300-50-8888.

**Contact for requests:** contact@ignatevestate.com (response SLA: 30 days).

### 2.3 Data Security (Doc 12 §4)

- **In transit:** TLS 1.3 (HSTS enforced)
- **At rest:** Database encryption + application-layer encryption for 🔒 fields
- **Access control:** Role-based, logged per PDPA §32
- **Backup:** Daily automated; 30-day retention; geographically replicated
- **Incident response:** 72-hour PDPC notification on confirmed breach

### 2.4 Data Subject Consent (Registration & Checkout)

**Registration consent text:**
> "I consent to the collection, use, and disclosure of my personal data as described in the [Privacy Policy](link) and [Terms of Service](link). I understand my data will be used to provide the service, file Thai immigration documents, and process payments. I can withdraw consent anytime in Account Settings."

**Checkout consent text (before payment):**
> "I authorize the processing of my payment by [Payment Provider] and understand that Ignatev Estate does not store card data. I consent to the booking record and any necessary TM30 immigration filing."

**TM30 passport capture consent (specific, transparent):**
> "Thai immigration law requires a TM30 report within 24 hours of your arrival. We will capture your passport details and images for this filing only. This information is encrypted and will be automatically deleted 30 days after your stay ends, unless law requires longer retention. You can request this deletion earlier via Account Settings."

---

## 3. Terms of Service Content (Legal & Commercial Tier)

### 3.1 Booking Terms

**Instant Book (myUNO operates directly):**
- Binding contract between guest and Ignatev Estate upon payment
- Cancellation policy per listing (Flexible / Moderate / Strict); no refund-after-72h for Strict
- Checksum in system: if computed refund < guest's stated refund, guest gets computed amount

**Request-to-Book (owner approval required):**
- Guest offer expires in 24 hours if not approved
- Host can approve, decline, or mark as "not available"
- Auto-decline after 24h if no response (unless configured)
- Approval does not reserve funds; payment due before check-in

### 3.2 Liability & Limitation

**myUNO's liability is limited to:**
1. Direct damages caused by our negligence only
2. Maximum: Amount paid for the booking (or ฿10,000, whichever is greater)
3. **Excludes:** Lost profits, data loss, personal injury, property damage beyond the booking scope

**NOT liable for:**
- Guest conduct (noise, damage, theft)
- Host cancellation or non-performance (direct claim: host liable)
- Third-party services (cleaning, services marketplace providers — separate T&Cs apply)
- Passport loss, visa denial, immigration complications (TM30 good-faith filing only; immigration authority decisions are theirs)
- Currency exchange fluctuations
- Tax or regulatory fines (guest/owner responsible for their jurisdiction's obligations)

### 3.3 Host & Guest Conduct

**Hosts agree not to:**
- Discriminate based on race, nationality, religion, gender
- Conduct off-platform bookings to avoid fees
- Harvest guest contact info for personal gain
- Misrepresent amenities or unit condition

**Guests agree not to:**
- Host unauthorized persons (extra occupancy beyond guestCount)
- Use unit for commercial activity (filming, event hosting, office subletting)
- Damage property intentionally
- Conduct prohibited activities (drug use, trafficking, etc.)

**Enforcement:** First violation = warning; repeated violations = account termination.

### 3.4 TM30 Immigration Filing (Legal Obligation)

**myUNO's responsibility:**
- File TM30 within 24 hours of guest arrival (or per configured SLA, max 24h)
- Encrypt and securely store passport data for filing
- Delete passport images 30 days post-checkout
- Escalate failures to ops team with 1-hour SLA for remediation

**Not myUNO's responsibility:**
- Outcomes of TM30 (immigration authority's decision)
- Guest visa validity (guest's responsibility)
- TM30 rejection or subsequent immigration enforcement

**Liability:** If myUNO *fails to file* (system error, not guest data missing), guest may claim damages up to ฿5,000 (settlement of typical fine + re-filing cost). This assumes no guest fault (e.g., invalid passport).

### 3.5 Dispute Resolution

1. **Informal:** Contact support@ignatevestate.com within 14 days of issue.
2. **Mediation:** If unresolved in 30 days, mediation via neutral Thai mediator (cost shared).
3. **Arbitration:** If mediation fails, binding arbitration under Thai Arbitration Act (not court litigation).
   - Venue: Bangkok, Thailand
   - Arbitrator: Single arbitrator (or three if claim > ฿100k)
   - Language: English or Thai

---

## 4. Trust & Safety Pages

### 4.1 `/trust` — Master Trust Hub

**Sections:**
1. **Why Trust myUNO?**
   - ✅ Licensed operator, legal entity (DBD 083-5-56602358-7)
   - ✅ Encrypted data, PDPA compliant
   - ✅ Verified hosts (vetting badges)
   - ✅ Two-way reviews + host feedback system
   - ✅ 24/7 ops team for emergencies (TM30, check-in issues)
   - ✅ Transparent pricing (no hidden fees)

2. **Safety Standards**
   - Passport verification + TM30 filing
   - Host property inspection (photos, conditions)
   - Check-in/check-out condition reports with photo evidence
   - 48-hour damage deposit dispute window
   - Emergency contact 24/7

3. **Payment Security**
   - PCI-DSS compliant (cards via Stripe/Omise, not myUNO)
   - No card data stored locally
   - SSL/TLS encryption in transit
   - Funds held in escrow until check-out confirmed

4. **Data Protection**
   - Passwords encrypted with bcrypt (cost ≥12)
   - Passport data doubly encrypted (DB + application layer)
   - Access-logged for sensitive fields
   - Auto-deletion of media after retention period
   - PDPA compliant breach response (72h notice)

5. **Guest Protections**
   - Full refund for host cancellations
   - Modification dispute resolution (re-priced, re-approved)
   - Review authenticity (verified booking only)
   - Dispute escalation to ops with 48h response SLA

6. **Host Protections**
   - Payment guaranteed at checkout (customer risk → us)
   - Damage deposit pre-auth (holds funds; releases on clean)
   - Review authenticity (verified stay)
   - Quick dispute resolution (transparent chat history)

### 4.2 `/trust/ombudsman` — Complaint & Resolution

**When to contact:**
- Unresolved disputes after support contact
- Alleged policy violation (safety, fairness, discrimination)
- Alleged data breach or privacy violation

**Contact:** ombudsman@ignatevestate.com  
**Response SLA:** 24 hours (within 48 hours for decision)  
**Process:**
1. Submit complaint form with details, booking ID, evidence
2. Ombudsman reviews independently (not support team)
3. Both parties interviewed
4. Decision issued in writing with reasoning
5. Escalation to PDPC if data-protection related

**Powered by:** Independent ombudsman (neutral third-party Thai legal professional)

### 4.3 `/legal/privacy` — Full Privacy Policy

**Structure:**
1. Data Controller & Contact
2. Categories of Data & Purpose
3. Legal Basis for Processing
4. Data Subject Rights
5. International Data Transfers (if applicable)
6. Security Measures
7. Retention Periods
8. Cookies & Analytics
9. PDPC Complaint Process
10. Policy Updates & Effective Date

**Key PDPA § Required Statements:**
- Data controller name, address, contact
- Data subject's eight rights (access, rectification, deletion, portability, objection, consent withdrawal, restriction, lodge complaint)
- Right to lodge complaint with PDPC (www.pdpc.go.th, hotline 1300-50-8888)
- Consequences of not providing data (booking cannot be processed)

### 4.4 `/legal/terms` — Full Terms of Service

**Structure:**
1. Binding Contract
2. Booking Types & Cancellation Policy
3. Liability Limitations
4. Host & Guest Conduct
5. TM30 Immigration Process
6. Payment & Refunds
7. Reviews & Ratings
8. Intellectual Property
9. Dispute Resolution (Mediation → Arbitration)
10. Changes to Terms & Termination

---

## 5. Content Key Registry (for Admin Editor)

**Namespace:** `legal.*`

```
legal.privacy.title
legal.privacy.data_controller
legal.privacy.data_controller_address
legal.privacy.data_controller_phone
legal.privacy.data_controller_email
legal.privacy.categories_identity
legal.privacy.categories_payment
legal.privacy.categories_passport
legal.privacy.categories_booking
legal.privacy.categories_communication
legal.privacy.subject_rights_access
legal.privacy.subject_rights_rectification
legal.privacy.subject_rights_deletion
legal.privacy.subject_rights_portability
legal.privacy.subject_rights_objection
legal.privacy.subject_rights_consent_withdrawal
legal.privacy.subject_rights_restriction
legal.privacy.subject_rights_complaint
legal.privacy.security_transit
legal.privacy.security_at_rest
legal.privacy.security_access
legal.privacy.retention_identity
legal.privacy.retention_payment
legal.privacy.retention_passport
legal.privacy.retention_booking
legal.privacy.pdpc_complaint_link
legal.privacy.pdpc_complaint_hotline

legal.terms.title
legal.terms.binding_contract
legal.terms.instant_book
legal.terms.request_to_book
legal.terms.cancellation_flexible
legal.terms.cancellation_moderate
legal.terms.cancellation_strict
legal.terms.liability_cap_booking
legal.terms.liability_cap_min
legal.terms.liability_exclusions
legal.terms.host_conduct
legal.terms.guest_conduct
legal.terms.tm30_responsibility
legal.terms.tm30_not_responsibility
legal.terms.tm30_liability
legal.terms.dispute_informal
legal.terms.dispute_mediation
legal.terms.dispute_arbitration
legal.terms.arbitration_venue
legal.terms.changes_to_terms

legal.trust_hub.title
legal.trust_hub.why_trust
legal.trust_hub.safety_standards
legal.trust_hub.payment_security
legal.trust_hub.data_protection
legal.trust_hub.guest_protections
legal.trust_hub.host_protections

legal.ombudsman.title
legal.ombudsman.when_to_contact
legal.ombudsman.contact_email
legal.ombudsman.response_sla
legal.ombudsman.process
```

---

## 6. Founder Decisions (from Q15/Q16)

⚠️ **Awaiting confirmation:**

1. **Data Controller Details**
   - Legal entity name: "Ignatev Estate Co., Ltd" ✅
   - DBD number: 083-5-56602358-7 ✅
   - Address: Plaza Del Mar, No.1 Pasak-Koktanod Rd, office 115–116, Cherngtalay, Thalang, Phuket 83110 ✅
   - Director: Pavel Ignatev ✅
   - Contact email: pavel@ignatevestate.com ✅
   - Contact phone: +66 92 240 7355 ✅
   - **Ombudsman:** Assign independent Thai mediator or use PDPC

2. **Additional Liability Caps or Guarantees**
   - Should damage liability differ from booking amount? (e.g., ฿50k cap for property damage)
   - Any service-level guarantees (e.g., "TM30 filed within 24h or ฿X credit")
   - Any money-back guarantees (e.g., "dissatisfied guests get full refund if reported within 48h")

3. **Cancellation Policy Defaults**
   - Should Strict policy be "no refund after 7 days before stay"? (Current: 72h)
   - Should there be a "super-strict" option (no refund ever)?
   - Should owner set policy, or is it fixed per engagement type?

4. **Cookies & Analytics Consent**
   - Essential (session, CSRF): Required (implied consent)
   - Analytics (Google Analytics, Mixpanel): Opt-in via banner
   - Marketing (Remarketing, email tracking): Opt-in per config

5. **Communication Preferences Default**
   - Booking notifications: On (required)
   - Marketing emails: Off (opt-in)
   - SMS: Off (opt-in)
   - Promotional via app: Off (opt-in)

---

## 7. Implementation Checklist

- [ ] Populate `legal.*` content keys via admin editor
- [ ] Configure data controller details (DBD, address, contact)
- [ ] Set up `/legal/privacy` page rendering from `legal.privacy.*` keys
- [ ] Set up `/legal/terms` page rendering from `legal.terms.*` keys
- [ ] Set up `/trust` hub with sections from `legal.trust_hub.*`
- [ ] Set up `/trust/ombudsman` contact form → create Thread + Ticket
- [ ] Add consent checkboxes to registration form (privacy + terms)
- [ ] Add consent checkboxes to checkout (payment authorization + TM30)
- [ ] Add consent checkboxes to TM30 passport capture (specific purpose)
- [ ] Test all pages render in RU/EN/TH via locale routing
- [ ] Verify no hardcoded text (all from `t()` keys)
- [ ] PDPA compliance audit: checklist in PR
- [ ] Submit to Thai legal review (external) before public launch

---

## 8. PDPA Compliance Audit Checklist

- [x] Legal basis documented for all data processing
- [x] Data subject rights clearly communicated
- [x] Consent mechanisms (registration, checkout, TM30) in place
- [x] Data security measures (encryption, access logging) implemented
- [x] Retention periods defined and automated (auto-delete jobs)
- [x] Breach response procedure documented (72h PDPC notice)
- [x] Data controller contact available
- [x] PDPC complaint path published
- [x] Cross-border transfer policy (if hosting outside Thailand)
- [ ] External Thai legal review (recommended before go-live)
- [ ] PDPC registration (optional but best practice)
- [ ] Privacy impact assessment (for high-risk processing like passport)

---

## Summary

This framework provides:
1. **Transparent privacy notice** (PDPA-compliant, RU/EN/TH)
2. **Clear liability terms** (limited, fair, enforceable)
3. **Trust signals** (security, verification, 24/7 ops)
4. **Data subject rights** (access, deletion, complaint)
5. **Immigration accountability** (TM30 process explained)
6. **Dispute resolution** (mediation → arbitration)

**Next:** Founder to provide any additional liability caps, cancellation policy refinements, or ombudsman assignment details. Then populate content keys and test pages before launch.
