# Corporate Bible Integration Plan

**Status:** Analysis complete, phased implementation ready  
**Document Reference:** Ignatev Estate Corporate Bible v9 (August 2026)  
**Last Updated:** August 13, 2026

This document outlines the integration of the Ignatev Estate Corporate Bible into the myUNO operating system. The Corporate Bible defines business model, brand architecture, customer lifecycle, and scaling strategy. This plan ensures the platform evolves to support all Corporate Bible requirements without breaking existing functionality.

## What the Corporate Bible Adds to myUNO

### Core Gaps Identified

| Gap | Corporate Bible Requirement | Current State | Priority |
|-----|---------------------------|---------------|----------|
| Customer Lifecycle | Guest→Repeat→Investor→Owner→Managed | Roles exist, no lifecycle state machine | HIGH |
| Asset Inventory Status | Managed/Partner/Suspended tracking | Units exist, no status field | HIGH |
| Owner Reporting | Monthly P&L, distributable cash, transparent fees | No statement concept | HIGH |
| Operational KPIs | Occupancy, ADR, direct%, response time, compliance | No tracking infrastructure | MEDIUM |
| Channel Attribution | Source, medium, campaign, referrer, CAC | No tracking | MEDIUM |
| Business Model | Fee tracking, performance calculations, contracts | No contract data model | MEDIUM |
| Brand Positioning | Four-layer brand (Ignatev/ClearView/myUNO/Asset) | Mentioned, not enforced | LOW |

### What's Already Built ✅

- ✅ Core identity & roles (identity → scoped roles per project/unit)
- ✅ CRM foundation (just shipped via CRM-1 patch)
- ✅ Communication layer (threads, tickets, announcements)
- ✅ Configuration & content management (no hardcoded strings)
- ✅ PDPA compliance framework (field-level encryption, access logging)

## Phased Implementation Plan

### Phase 1: Customer Lifecycle + Asset Status (2–3 weeks) [HIGH]

**Goal:** Foundation for all downstream systems.

**What Gets Built:**
- Customer lifecycle state machine: Contact → Guest → Repeat → Investor → Buyer → Owner → Managed
- Asset status tracking: Managed / Verified Partner / One-off Sourced / Suspended
- Admin pipeline dashboard showing customers by stage with owner assignment
- Audit log for every lifecycle transition

**Database Changes:**
```sql
-- crm_profile extensions
ALTER TABLE crm_profile ADD account_owner_identity_id TEXT;
ALTER TABLE crm_profile ADD next_step_at TIMESTAMP;
ALTER TABLE crm_profile ADD lifecycle_changed_at TIMESTAMP;
ALTER TABLE crm_profile ADD lifecycle_change_reason TEXT;
ALTER TABLE crm_profile ADD lifecycle_change_approved_by TEXT;

-- unit extensions
ALTER TABLE unit ADD asset_status ENUM('managed', 'verified_partner', 'one_off_sourced', 'suspended');
ALTER TABLE unit ADD asset_status_changed_at TIMESTAMP;
ALTER TABLE unit ADD asset_status_reason TEXT;

-- new table: audit log
CREATE TABLE lifecycle_transition_log (
  id TEXT PRIMARY KEY,
  profile_id TEXT REFERENCES crm_profile(id),
  from_stage TEXT,
  to_stage TEXT,
  reason TEXT,
  approved_by_identity_id TEXT,
  created_at TIMESTAMP
);
```

**APIs:**
- `POST /api/admin/crm/profiles/[profileId]/transition` — change lifecycle stage with reason
- `PUT /api/admin/units/[unitId]/status` — change asset status with audit
- `GET /api/admin/crm/pipeline` — view funnel by stage

**No Changes To:**
- Guest booking flow
- Reservation creation
- Payment processing
- CRM profile creation

**Tests:**
- Transition validation (only legal paths allowed)
- Audit log completeness
- Guest booking works unchanged

**Done When:**
- Can transition customer through full lifecycle
- Asset status is tracked and audited
- Admin pipeline shows all stages
- No breaking changes to existing APIs

---

### Phase 2: Owner Reporting & Transparency (2 weeks) [HIGH]

**Goal:** Monthly statements, fee transparency, distributable cash visibility.

**What Gets Built:**
- Owner statement schema (period, revenue, expenses, distributable cash, performance fee)
- Statement generation API that reconciles bookings + fees + expenses
- Admin statement browser with line-item drill-down
- Owner portal view of their statements (read-only, scoped)
- Transparent fee calculation display

**Database Changes:**
```sql
CREATE TABLE owner_statement (
  id TEXT PRIMARY KEY,
  unit_id TEXT REFERENCES unit(id),
  statement_period_start DATE,
  statement_period_end DATE,
  
  gross_bookings_amount INT,
  guest_payments_received INT,
  service_fees_amount INT,
  operating_expenses_amount INT,
  taxes_amount INT,
  adjusted_noi INT,
  distributable_cash INT,
  performance_fee_amount INT,
  performance_fee_basis_text TEXT,
  
  status ENUM('draft', 'pending_owner_review', 'signed_off', 'distributed'),
  signed_off_by_owner_at TIMESTAMP,
  signed_off_by_operator_at TIMESTAMP,
  created_at TIMESTAMP
);

CREATE TABLE statement_line_item (
  id TEXT PRIMARY KEY,
  statement_id TEXT REFERENCES owner_statement(id),
  category TEXT, -- "booking", "refund", "fee", "expense"
  description TEXT,
  amount INT,
  booking_id TEXT,
  created_at TIMESTAMP
);
```

**APIs:**
- `POST /api/admin/statements/generate` — create monthly statement from booking data
- `GET /api/admin/statements/[statementId]/line-items` — drill-down to every booking/fee/expense
- `PUT /api/admin/statements/[statementId]/sign-off` — owner approval
- `GET /api/owner/statements` — owner view of their statements (role-restricted)

**Owner Facing:**
- New section in owner dashboard: "Your Statements"
- Each statement shows: period, gross bookings, deductions breakdown, net distributable cash, performance fee
- Every line item is clickable → shows source booking or expense

**No Changes To:**
- Guest booking & payment flows
- Reservation schema
- Admin operations

**Tests:**
- Statement totals reconcile with sum of line items
- Performance fee calculation matches contract terms
- Owner cannot see other owners' statements
- Statement signature workflow

**Done When:**
- Monthly statement can be generated
- Every booking, fee, and expense is line-itemed
- Owner can review and sign off
- Totals reconcile with bank records

---

### Phase 3: Operational KPIs & Compliance (2 weeks) [MEDIUM]

**Goal:** Track occupancy, ADR, response time, compliance; spot problems early.

**What Gets Built:**
- KPI tracking (occupancy, ADR, direct%, response time, service quality)
- Incident log (guest complaints, maintenance, rule violations)
- Compliance checklist templates + instances (monthly/quarterly checks)
- Admin operational dashboard
- Alerts for threshold violations

**Database Changes:**
```sql
CREATE TABLE operational_kpi (
  id TEXT PRIMARY KEY,
  unit_id TEXT REFERENCES unit(id),
  metric_name TEXT, -- "occupancy_rate", "adr", "direct_booking_share"
  period_start DATE,
  period_end DATE,
  target_value NUMERIC,
  actual_value NUMERIC,
  status ENUM('on_track', 'at_risk', 'below_target'),
  created_at TIMESTAMP
);

CREATE TABLE incident_log (
  id TEXT PRIMARY KEY,
  unit_id TEXT REFERENCES unit(id),
  incident_type TEXT, -- "maintenance", "guest_complaint", "rule_violation"
  severity ENUM('low', 'medium', 'high', 'critical'),
  description TEXT,
  reported_by_identity_id TEXT,
  assigned_to_identity_id TEXT,
  status ENUM('open', 'in_progress', 'resolved', 'closed'),
  resolved_at TIMESTAMP,
  resolution_notes TEXT,
  created_at TIMESTAMP
);

CREATE TABLE compliance_checklist_template (
  id TEXT PRIMARY KEY,
  name TEXT,
  frequency ENUM('weekly', 'monthly', 'quarterly', 'annual'),
  items JSONB
);

CREATE TABLE compliance_checklist_instance (
  id TEXT PRIMARY KEY,
  unit_id TEXT REFERENCES unit(id),
  template_id TEXT REFERENCES compliance_checklist_template(id),
  due_date DATE,
  completed_date DATE,
  checked_by_identity_id TEXT,
  passed BOOLEAN,
  notes TEXT,
  created_at TIMESTAMP
);
```

**Admin Dashboard:**
- KPI cards per unit (occupancy, ADR, direct%, response time)
- Performance vs. target trend
- Incident queue (open + high-priority first)
- Compliance check calendar + upcoming due dates
- Alert threshold configuration

**No Changes To:**
- Booking flow
- Reservation data
- Guest experience

**Tests:**
- KPI calculation accuracy
- Incident tracking workflow
- Compliance checklist completion

**Done When:**
- Dashboard shows real-time KPI status
- Incidents are tracked to resolution
- Compliance checks are scheduled and tracked
- Alerts fire for threshold violations

---

### Phase 4: Channel Attribution & Go-to-Market (1 week) [MEDIUM]

**Goal:** Track how customers arrive; measure acquisition cost; manage prospecting pipeline.

**What Gets Built:**
- Channel master data (direct, referral, LinkedIn, organic search, etc.)
- Source tracking on every new identity (channel, medium, campaign, referrer)
- Prospecting account pipeline (target list, contact history, expected close date)
- Attribution reports (CAC by channel, payback period)

**Database Changes:**
```sql
CREATE TABLE channel (
  id TEXT PRIMARY KEY,
  name TEXT, -- "direct", "referral", "developer", "linkedin"
  category TEXT, -- "owned", "earned", "paid"
  description TEXT
);

ALTER TABLE crm_profile ADD source_channel_id TEXT REFERENCES channel(id);
ALTER TABLE crm_profile ADD source_medium TEXT; -- "email", "linkedin", "whatsapp"
ALTER TABLE crm_profile ADD source_campaign TEXT;
ALTER TABLE crm_profile ADD referrer_identity_id TEXT REFERENCES identity(id);

CREATE TABLE prospecting_account (
  id TEXT PRIMARY KEY,
  identity_id TEXT REFERENCES identity(id),
  account_type ENUM('owner', 'developer', 'institutional_partner'),
  status ENUM('new', 'contacted', 'interested', 'pitched', 'closed'),
  reason_for_contact TEXT,
  priority INT,
  assigned_to_identity_id TEXT,
  created_at TIMESTAMP,
  last_contacted_at TIMESTAMP,
  expected_close_at TIMESTAMP
);
```

**APIs:**
- `POST /api/leads` — now requires `source_channel`, `source_medium`, optional `referrer_id`
- `GET /api/admin/prospecting` — pipeline view by stage
- `POST /api/admin/prospecting/[accountId]/transition` — move account through stages
- `GET /api/admin/reports/attribution` — CAC and payback by channel

**No Changes To:**
- Booking flow
- CRM core
- Statement generation

**Tests:**
- Source is captured on every new identity
- Attribution is preserved across role transitions
- Prospecting pipeline is queryable
- CAC calculation is correct

**Done When:**
- Every new customer records source/channel
- Prospecting is managed in system (not spreadsheets)
- CAC reports show cost by channel
- Attribution survives role transitions

---

### Phase 5: Business Model Tracking (1 week) [MEDIUM]

**Goal:** Fee contracts, performance fee calculations, revenue recognition.

**What Gets Built:**
- Management contract schema (fee basis, performance terms, dates)
- Fee calculator that auto-computes monthly fees from contract
- Earned fee audit trail (every fee shows its calculation basis)
- Integration with owner statement generation

**Database Changes:**
```sql
CREATE TABLE management_contract (
  id TEXT PRIMARY KEY,
  unit_id TEXT REFERENCES unit(id),
  project_id TEXT REFERENCES project(id),
  owner_identity_id TEXT REFERENCES identity(id),
  
  management_fee_basis ENUM('percentage_gop', 'percentage_noi', 'percentage_gross_booking', 'fixed'),
  management_fee_rate NUMERIC,
  management_fee_fixed_amount INT,
  
  performance_fee_enabled BOOLEAN,
  performance_fee_basis TEXT,
  performance_fee_rate NUMERIC,
  performance_fee_baseline INT,
  
  contract_start_date DATE,
  contract_end_date DATE,
  status ENUM('active', 'pending_signature', 'expired', 'terminated'),
  signed_at TIMESTAMP,
  signed_by_owner_identity_id TEXT,
  created_at TIMESTAMP
);

CREATE TABLE earned_fee (
  id TEXT PRIMARY KEY,
  management_contract_id TEXT REFERENCES management_contract(id),
  fee_type ENUM('management', 'performance', 'transaction', 'distribution'),
  period_start DATE,
  period_end DATE,
  calculation_basis TEXT,
  amount INT,
  status ENUM('accrued', 'invoiced', 'paid'),
  invoice_id TEXT,
  paid_at TIMESTAMP,
  created_at TIMESTAMP
);
```

**APIs:**
- `POST /api/admin/contracts` — register new management contract
- `POST /api/admin/fees/calculate` — simulate fee for a period (before statement generation)
- `GET /api/admin/fees/[contractId]` — view all earned fees for contract
- Statement generation: auto-includes earned fees from contract

**Admin Tools:**
- Fee calculator UI (input: contract terms + period → shows calculated fees)
- Contract registry (view all active contracts, due for renewal, etc.)

**No Changes To:**
- Booking flow
- Statement generation (it will now *include* fees from contracts)

**Tests:**
- Fee calculations are accurate
- Calculation basis is transparent (every fee shows how it was computed)
- Fees appear in owner statement
- No missing or duplicate fees

**Done When:**
- Contract can be registered with fee terms
- Monthly fees auto-calculate from contract
- Every fee shows calculation basis
- Fee audit trail is immutable

---

### Phase 6: Documentation & Brand Positioning (1 week) [LOW]

**Goal:** Update CLAUDE.md, document brand layers, establish team understanding.

**What Gets Built:**
- Update CLAUDE.md with Corporate Bible sections
- Brand layer enforcement in code (what each layer owns)
- Data access policies by role
- Messaging guidelines (tone per brand layer)

**No Database/Code Changes.**

**Documentation:**
- Extend CLAUDE.md with sections:
  - **Ignatev Layer** — Founder, relationships, mandate decisions, judgment
  - **ClearView Layer** — Underwriting, risk, due diligence, proof
  - **myUNO Layer** — Operational standard, systems, guest/resident experience
  - **Asset Brand Layer** — Individual property identity, co-branding rules
  - **Customer Lifecycle** — Stages, transition rules, relationship ownership
  - **Data Governance** — Who sees what, audit logging, retention
  - **Business Model** — Fee types, recognition, transparency
  - **Brand Tone Guidelines** — How each layer communicates

**Done When:**
- CLAUDE.md references Corporate Bible sections
- Team knows which layer owns each decision
- Brand tone is consistent and enforceable
- Data policies are clear and tested

---

## Implementation Sequence

```
Week 1–3:  Phase 1 (Lifecycle + Asset Status)
           ↓ [Merge to main]
           
Week 4–5:  Phase 2 (Owner Reporting)
           ↓ [Merge to main]
           
Week 6–7:  Phase 3 (KPIs + Compliance)
           ↓ [Merge to main]
           
Week 8:    Phase 4 (Channel Attribution)
           ↓ [Merge to main]
           
Week 9:    Phase 5 (Business Model)
           ↓ [Merge to main]
           
Week 10:   Phase 6 (Documentation)
           ↓ [Merge to main]
```

Each phase is **independent**; later phases do not depend on earlier ones completing (except Phase 2 benefits from Phase 1's asset status). If priorities shift, phases can be reordered.

---

## Risk & Mitigation

| Risk | Mitigation |
|------|-----------|
| Breaking guest booking flow | Phase 1 touches only CRM tables; booking logic untouched. E2E test added. |
| Migration complexity (1000s of units) | Add `asset_status` with default 'managed'; no backfill required. |
| Performance regression on CRM | Add indices on `lifecycle_stage`, `account_owner_id`. Load test. |
| Scope creep | Each phase is gated. P1 ships → P2 starts only after P1 merged. |
| Owner confusion during launch | Release notes on statement page. Owner FAQ. Communication plan. |

---

## Success Metrics

✅ **Phase 1:** Lifecycle is auditable, asset status is tracked, no booking flow changes, tests pass  
✅ **Phase 2:** Owners access monthly statements, every line is traceable, sign-off workflow works  
✅ **Phase 3:** Dashboard shows KPI health, incidents tracked to resolution, compliance on schedule  
✅ **Phase 4:** Every new customer has source/channel, prospecting managed in system, CAC visible  
✅ **Phase 5:** Fee contracts auto-calculate, every fee shows basis, audit trail is immutable  
✅ **Phase 6:** CLAUDE.md is authoritative, brand layers enforced, team onboarded  

---

## Next Immediate Steps

1. **Approve Phase 1 scope** — Lifecycle + Asset Status
2. **Create migration 10** — Add schema fields for Phase 1
3. **Create API routes** — Transition + status change endpoints
4. **Build admin dashboard** — Pipeline by stage view
5. **Write tests** — Transition rules, audit log, booking unchanged
6. **Create PR** — Phase 1 implementation
7. **Merge & deploy** to Supabase production

---

## Out of Scope (Deferred)

- Real-time dashboard (polling ok for now; websockets later)
- Multi-currency fees (THB only)
- Complex revenue share logic (handled via contract terms for now)
- Marketing automation (separate tool; system captures data)
- ML-based forecasting (gather data first)
- Vendor/partner SLA dashboard (Phase 1.5, post-Phase 3)

---

**Maintained by:** Core Platform Team  
**Last Reviewed:** August 13, 2026  
**Next Review:** After Phase 1 merge
