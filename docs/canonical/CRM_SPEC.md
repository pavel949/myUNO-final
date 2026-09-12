# CRM_SPEC.md — myUNO Relationship and Commercial Operating System

## 1. Purpose
CRM uses existing `Identity`, CRM profile/opportunity/activity/consent primitives as the relationship layer. It is not a duplicate booking/order/ledger/ownership system.

## 2. Primary screens

### Today
My next actions, overdue follow-ups, new leads, meetings/tasks, proposals awaiting response and handovers requiring completion.

### Inbox
New lead events, source/channel, identity match candidate, SLA, responsible queue and assignment.

### Contacts / Organizations
Canonical identity, verified contacts, language, consent, allowed relationship context, account owner, lifecycle summary, linked stays/services/ownership/opportunities, open cases and next action.

### Opportunities
Pipeline-specific stages, fields and prerequisites.

### Calendar / Activities
Calls, meetings, tasks, messages and follow-ups.

### Shortlists / Proposals
Versioned commercial material linked to an opportunity.

### Partners / Referrals
Source partner, attribution basis, fee terms, disputes and accrued/paid referral economics.

### Reports
Only formula-defined metrics with explicit scope/period/drill-down.

## 3. Opportunity types
- stay / long stay;
- property purchase;
- property sale;
- property management;
- complex service / group / relocation;
- provider / B2B partner;
- advisory / capex / compliance.

Use one opportunity core with pipeline type; do not create separate customer tables.

## 4. Mandatory active opportunity fields
Identity/organization, pipeline, stage, assignedTo or explicit Unassigned queue, nextActionType, nextActionAt, nextActionOwner, source/attribution, value basis/currency where meaningful, created/updated, scope and closure reason when closed.

## 5. Deal card
Header: client, pipeline/stage, owner, urgency, value basis, next action.  
Requirements: dates, geography, budget, constraints, explicit unknowns.  
Proposal: versions, offers, validity, evidence-backed viewed/accepted/rejected.  
Timeline: inbound/outbound, tasks, meetings, stage changes, documents; internal notes separated.  
Money: expected company revenue, gross transaction value separately, contractual fee, invoice/payment links.  
Handover: linked Booking / ServiceOrder / Onboarding case, accepting team, unresolved issues.  
Closure: won/lost/no-decision, reason/evidence/follow-up permission.

## 6. Transition rules
Drag-and-drop is only UX. Server validates prerequisites. Property sale `won` cannot create ownership. Management opportunity cannot activate authority without contract/scope evidence. Stay conversion links to booking. Provider opportunity links to provider onboarding.

## 7. Activity discipline
Completing an activity should allow the next action in the same interaction. Active opportunities without next action appear in an exception queue.

## 8. Lead intake
Sources: public forms, manual call/WhatsApp log, partner referral, approved message adapter, booking/service signals. Store external request/message ID, receivedAt, source, context, consent evidence and identity-match state. Duplicate webhook must not duplicate a lead. Unassigned leads remain visible with SLA.

## 9. Scoped privacy
Global Identity does not grant global visibility. A partner manager cannot automatically see another operator’s sales notes, unrelated guest complaints or owner finance. Every CRM read model applies organization/property/relationship scope.

## 10. Metrics
**Active opportunities:** configured active stages; nurture treatment explicit.  
**Weighted forecast:** expected company revenue × probability on open qualified opportunities; do not mix gross asset value.  
**Win rate:** Won / (Won + Lost) in defined closed cohort.  
**Lead response time:** ReceivedAt → first qualifying human/approved response; autoresponder separate.

Aggregates are calculated over the complete permitted result set before pagination.

## 11. Acceptance flow
Lead → match/create Identity → assign → qualify → proposal → accept → linked Booking/Order/Mandate → operational handover → finance result → CRM outcome/follow-up. Normal flow should not require copying phone numbers manually between modules.
