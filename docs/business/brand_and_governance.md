# Ignatev Estate — brand architecture, lifecycle, data governance, fee transparency

Moved verbatim from CLAUDE.md on 2026-10-05 so it is read on demand (CRM, owner statements, copy, permissions work) instead of loaded into every agent session. Content unchanged except the luxury-villa tone example, which contradicted the no-24/7-promises rule.

myUNO operates within Ignatev Estate's owner-side model, which manages real estate economics from acquisition through operation to exit. **Four brand layers, each with distinct decision-making authority and audience:**

## Brand Layer Architecture

**Ignatev Estate (Founder / Mandate Layer)**
- **Who decides:** Founder, board.
- **What they own:** Business model (fee structure, cash distribution policy, investor relations, expansion strategy), brand positioning, corporate relationships, legal mandate for all operations.
- **Enforced by:** Founder review gates in docs/01_architecture_decisions.md; any change to D1–D10 requires founder approval before specs or code follow.
- **System responsibility:** Document all decisions, trace requirements through decision IDs, surface blockers (open_questions.md) for founder judgment.

**ClearView (Underwriting / Proof Layer)**
- **Who decides:** ClearView team (due diligence, risk assessment, asset qualification).
- **What they own:** Asset qualification (is this asset suitable for the Ignatev model?), proof of value (title audit, condition survey, market assessment), risk rating, GO/NO-GO on new acquisitions.
- **Data in system:** ComplianceRecord (permitted_use, insurance, license), ConditionReport (baseline, inspections), MobilizationChecklistItem (legal audit, standards uplift gates).
- **System responsibility:** Provide proof-of-evidence dashboard; block unit go-live until permitted_use confirmed; audit trail on every clearance change.

**myUNO (Operations / Standards Layer)**
- **Who decides:** Operations team (day-to-day, process design, system configuration).
- **What they own:** How guests are welcomed, how staff work, how stays run reliably, customer SLAs, guest experience standards, direct booking availability.
- **Configuration:** Config parameters (SLAs, thresholds, catalogs), content keys (tone, messaging), design system (UX consistency).
- **System responsibility:** All operational logic lives in code + config; no hard-coded decisions; every SLA and policy is configurable and auditable.

**Asset Brand (Individual Property Layer)**
- **Who decides:** Asset ownership (owner, management company per engagement type).
- **What they own:** Co-branding (property name, local imagery, house rules, amenities positioning), guest policies for their unit, pricing and availability.
- **Scoped access:** Each asset owner sees and configures only their own units; project-wide announcements routed through management company.
- **System responsibility:** Enforce ownership scopes; surface project/unit configuration to the right roles; reject cross-asset visibility unless explicitly shared.

**Interaction Flow:** Ignatev decides the model → ClearView qualifies the asset → myUNO operates it → Asset owner customizes within bounds.

## Customer Lifecycle & Ownership

**Lifecycle Stages** (each an explicit state in `crm_profile.lifecycle_stage`):
1. **Contact** — External prospect, not yet booked or verified. Source: lead form, referral, prospecting account.
2. **Guest** — Has completed at least one stay; guest identity confirmed. May book again.
3. **Repeat** — Multiple bookings, demonstrates stability and intent. Candidate for owner-side relationship.
4. **Investor** — Expressed interest in purchasing or managing a property; under evaluation.
5. **Buyer** — Active purchase negotiation or due diligence underway.
6. **Owner** — Holds title to at least one unit; receives owner statements and management reporting.
7. **Managed** — Owner with multiple units or portfolio complexity requiring proactive management.
8. **Seller** — Divesting; used to filter from future owner outreach.
9. **Former Client** — Completed divestment or relationship wind-down.

**Lifecycle Ownership** (audit trail in `lifecycle_transition_log`):
- Every stage transition is logged with `changed_by_identity_id` + `reason_text`.
- Transitions gate on data readiness: e.g., contact → guest requires a completed booking; guest → owner requires title proof (compliance record).
- Only staff (ops/on-site host) and admin can initiate transitions; founder approves policy changes.
- Each transition triggers a notification to the owner's assigned account manager (CRM).

**Account Ownership** (`crm_profile.account_owner_identity_id`):
- One identity per account (a staff member) is designated as the account owner.
- All transitions, extensions, and deal updates are attributed to the account owner.
- If an account owner leaves, their accounts are re-assigned; history traces through the audit log.

**No Silos:** A single identity can be a guest, owner, and buyer simultaneously — same identity record, multiple roles scoped by unit/project.

## Data Governance & Access Policies

**Core Principle:** Visibility is role + scope. No one sees data outside their scope; server-side enforcement on every query.

**Access Matrix** (enforced by `core.can()` + query scoping):

| Data | Owner (own unit) | Owner (guest booking) | MC Member | Staff | Admin |
|------|-----|-----|-----|-----|-----|
| Own unit details | ✅ R/W | ✅ R | ❌ | ✅ R/W | ✅ R/W |
| Own bookings | ✅ R | ✅ R | ❌ | ✅ R/W | ✅ R/W |
| Own statements | ✅ R | ❌ | ❌ | ✅ R/W | ✅ R/W |
| Managed units (MC) | ❌ | ❌ | ✅ R/W | ✅ R/W | ✅ R/W |
| All units (admin) | ❌ | ❌ | ❌ | ❌ | ✅ R/W |
| Guest PII (passports) | ❌ | ❌ | ❌ | ⚠️ Access logged | ✅ R/W |
| Financial audit trail | ❌ | ❌ | Limited | ✅ R/W | ✅ R/W |

**PII Handling:**
- 🔒 Encrypted fields (passports, date of birth): AES-256-GCM, `ENCRYPTION_KEY` immutable post-go-live.
- Every access to 🔒 fields is logged in `AuditLog` with identity, timestamp, purpose.
- Retention: Passports deleted `retention_days` after stay checkout (config param).
- Export: Data export (PDPA right) excludes other identities' PII automatically.

**Audit Logging:**
- Every role grant/revoke → `AuditLog`.
- Every config parameter change → `ConfigChange` + `changedBy` identity.
- Every lifecycle transition → `LifecycleTransitionLog`.
- Every guest PII access → `AuditLog` (identity, timestamp, action).
- Monthly audit report exported for compliance review (doc 12 §6).

**Retention & Deletion:**
- Guest PII (passports, full names) deleted after `config.get('retention.guest_pii_days')` (default 7 years per Thailand law).
- Booking records: kept permanently for financial audit.
- Message archives: kept per policy; threads can be archived by participants.
- PDPA deletion requests: identity anonymization in-place (no cascade delete; preserves audit trail).

## Business Model & Fee Transparency

**Revenue Model** (Ignatev decision, myUNO-enforced):
- **Management Fee** — Fixed or percentage-based (GOP, NOI, gross booking). Calc basis stored per contract (`earned_fee.calculation_basis`).
- **Performance Fee** — Percentage of NOI exceeding baseline (only if enabled in contract). Shows in statement as separate line.
- **Transaction Fee** — On sale/purchase; negotiable per deal.
- **Distribution Partner Commission** — From referral partners; tracked in ledger.

**Fee Transparency for Owners:**
1. **Contract visibility** — Every owner sees their unit's management contract (fee basis, rates, performance terms) in owner dashboard.
2. **Monthly statement** — Each statement shows:
   - Gross bookings (revenue from stays)
   - Service fees (commission, refund allowances)
   - Expenses (recorded by ops, itemized)
   - Adjusted NOI (net operating income for performance fee calc)
   - Distributable cash (amount ready for payout)
   - Performance fee (if earned; shows calc basis)
3. **Line-item drill-down** — Every statement line traces to source (booking ID, expense receipt, fee contract).
4. **Audit trail** — Fee calculations are immutable; `earned_fee` records show timestamp, calculation basis, status (accrued → invoiced → paid).

**No Surprises:**
- Fee basis and rates are in the contract before any bookings.
- Calculation basis is shown on every fee record.
- If a fee changes (rate update), old contracts stay at old rate; new contracts use new rate.
- Owner can dispute any fee within 30 days of statement (future: dispute workflow).

## Brand Tone Guidelines

**Tone by Layer:**

**Ignatev tone** (founder communications):
- Authoritative, long-term vision. Used in: board updates, policy announcements, investor relations.
- Example: "Our model is designed for 20-year wealth building, not short-term arbitrage."
- Never: apologize, hedge, admit uncertainty in public statements.

**ClearView tone** (asset qualification):
- Professional due diligence. Used in: clearance reports, risk assessments, compliance emails.
- Example: "Title audit complete; no encumbrances found. Unit approved for myUNO operations."
- Never: casual, overly friendly; this is legal/financial communication.

**myUNO tone** (operational, guest-facing):
- Warm, helpful, transparent. Used in: guest emails, check-in instructions, ticket responses, booking confirmations.
- Example: "Your check-in is on Aug 20. We'll send door codes 2 hours before arrival. Questions? Reply here."
- Never: formal legalese; assume guests are busy and want brevity.

**Asset tone** (owner/property-specific):
- Flexible per property brand. Used in: property listing, house rules, announcements from owner.
- Constraint: Must not contradict Ignatev positioning or myUNO standards.
- Example (luxury villa): "Your private sanctuary awaits. Your host is a message away." (never promise 24/7 — AI_AGENT_RULES §3)
- Example (urban condo): "Smart living in the heart of the city. Full kitchen, workspace, laundry."

**Content Keys** (enforced by `no-literal-ui-text` lint):
- Every message template is a content key (doc 05), not hard-coded.
- Keys are versioned; translations are independently maintained (RU/EN/TH).
- `needs_review` drafts block deployment until founder reviews tone + terminology.

