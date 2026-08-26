# P1 Maturity Fixes: Execution Plan

**Status:** In Progress  
**Owner:** Platform Team  
**Target:** Complete all 5 P1 items + document findings

---

## Overview

Five interconnected P1 tasks to complete platform for soft launch:

| Task | Effort | Dependencies | Status |
|------|--------|-------------|--------|
| **Hard-coded String Migration** | 1–2 days | None | 🔍 Scoping |
| **Auth Consistency Standardization** | 1 day | Hard-coded strings (for error messages) | 🔍 Scoping |
| **Breadcrumb Navigation** | 1 day | None (parallel) | 🔍 Scoping |
| **Founder Review (27 Keys)** | 10–15 hours | Complete + list flagged keys | 📋 Blocked (waiting for scope) |
| **Thai Translation (TIER 1)** | 2 weeks | Complete key inventory + owner review | 📋 Blocked (waiting for scope) |

---

## Task 1: Hard-Coded String Migration

### Scope
Find all user-facing hard-coded strings that should be content keys per doc 05.

**Strings to migrate:**
- UI labels (buttons, form fields, headings, status labels)
- Error messages
- Toast/notification text
- Empty states ("No results", "No data")
- Help text, placeholders
- Confirmation dialogs
- Success messages

**Exclusions (keep as-is):**
- IDs, slugs, database values
- Code comments
- URLs, email addresses
- CSS class names
- Technical jargon in logs
- Format strings (dates, numbers)

### Files to Scan (by priority)
1. **Authentication & User Core** (highest impact)
   - `src/app/login/**`
   - `src/app/register/**`
   - `src/app/auth/**`
   - `src/app/account/**`

2. **Guest Booking & Trips** (revenue flow)
   - `src/app/search/**`
   - `src/app/units/[id]/**`
   - `src/app/trips/**`
   - `src/app/messages/**`

3. **Owner Dashboard** (owner experience)
   - `src/app/owner/**`
   - `src/app/properties/**`

4. **Admin & Operations** (staff tools)
   - `src/app/admin/**`
   - `src/app/ops/**`

5. **Components Library** (reusable UI)
   - `src/app/components/**`

### Deliverables
- [ ] CSV report: file, line, string, component, namespace, priority
- [ ] Content key definitions (namespace + key structure)
- [ ] Updated components with `t()` calls
- [ ] Updated `getLabels()` calls on page components
- [ ] Build + lint pass
- [ ] Commit with message: "Migrate hard-coded strings to content keys (T-P1-001)"

---

## Task 2: Auth Consistency Standardization

### Scope
Standardize how authentication is enforced across all routes.

**Current State (Audit Findings TBD):**
- Some routes check `getCurrentUser()` at start
- Some routes use client-side checks
- Inconsistent error codes/messages
- Mixed HTTP status codes (401 vs 403)

### Target State
1. **All mutations (POST/PUT/DELETE) must check auth server-side**
   - First line of every route handler
   - Return 401 if missing
   - Return 403 if forbidden

2. **Consistent error response shape**
   ```typescript
   { error: string, code: string } // never leak user details
   ```

3. **Standard status codes**
   - `401 Unauthorized` — no session/invalid token
   - `403 Forbidden` — session valid but permission denied
   - `400 Bad Request` — validation failed
   - `404 Not Found` — resource doesn't exist
   - `409 Conflict` — state conflict (e.g., double-book)

4. **Consistent error codes**
   - `not_authenticated` (401)
   - `forbidden` (403)
   - `invalid_input` (400)
   - `not_found` (404)
   - `conflict` (409)

### Files to Update (by priority)
1. Routes that mutate user data
2. Routes that mutate financial data (payments, statements)
3. Routes that mutate admin/system data

### Deliverables
- [ ] Auth guard utility function (reusable)
- [ ] Error response builder
- [ ] Audit report: which routes needed fixes
- [ ] Updated route handlers
- [ ] Tests verifying auth checks
- [ ] Build + lint pass
- [ ] Commit: "Standardize auth checks and error responses across all routes (T-P1-002)"

---

## Task 3: Breadcrumb Navigation

### Scope
Add breadcrumb navigation to key pages for wayfinding.

**Page Categories:**

#### High-Priority (Nested Deep)
- `/properties/[id]/calendar` → Home > Properties > [Unit Name] > Calendar
- `/trips/[id]` → Home > Trips > [Trip Title]
- `/messages/[threadId]` → Home > Messages > [Contact Name]
- `/owner/statements/[statementId]` → Home > Owner > Statements > [Statement No.]
- `/admin/crm/opportunity/[id]` → Home > Admin > CRM > [Opportunity Name]

#### Medium-Priority
- `/services/[id]` → Home > Services > [Service Name]
- `/projects/[slug]` → Home > Projects > [Project Name]
- `/units/[id]` → Home > Units > [Unit Name]

#### Admin
- `/admin/crm` → Home > Admin > CRM
- `/admin/bookings` → Home > Admin > Bookings
- `/admin/units` → Home > Admin > Units

### Breadcrumb Component Design
- Location: Top of page, below navbar
- Format: Home > Level1 > Level2 > Current Page
- Last item: not a link (current page)
- Previous items: links to those pages
- Responsive: hide intermediate items on mobile if needed

### Files to Create/Update
- [ ] `src/components/Breadcrumb.tsx` — reusable component
- [ ] Update 8+ page components to include breadcrumb
- [ ] Update page layouts to accept breadcrumb items via props or context

### Deliverables
- [ ] Breadcrumb component with TypeScript types
- [ ] Integrated into high-priority pages
- [ ] Design system tokens used (colors, spacing, typography)
- [ ] Tests: breadcrumb renders, links work, responsive
- [ ] Build + lint pass
- [ ] Commit: "Add breadcrumb navigation to key user journeys (T-P1-003)"

---

## Task 4: Founder Review (27 Flagged Keys)

### Scope
Collect the 27 keys marked `needs_review` and present for founder decision.

**Known Flagged Keys (from content audit):**
- **legal** (17 keys) — Terms, PDPA, policies
  - Legal tone, regulatory language
  - May need legal review before launch
  
- **trust** (10 keys) — Identity verification, safety
  - Verification badge copy
  - Safety item descriptions
  - User-facing trust signals

### Key Questions for Founder
1. Legal terms: Does tone match Ignatev positioning?
2. Trust/verification: Is copy clear to Russian-speaking users?
3. Regulatory: Does PDPA language satisfy Thai legal requirements?
4. Brand: Are warnings/disclaimers appropriately firm?

### Deliverables
- [ ] Document listing all 27 keys with context
- [ ] SQL query to export flagged keys for founder
- [ ] Founder review + approval captured
- [ ] Move keys to `status: ok` once approved
- [ ] Commit: "Mark founder-reviewed content keys as approved (T-P1-004)"

---

## Task 5: Thai Translation (TIER 1)

### Scope
Translate 180+ Tier 1 keys to Thai (blocking launch).

**Tier 1 Namespaces:**
- **legal** (25) — Terms, policies
- **trust** (14) — Verification, safety
- **auth** (47) — Login, register, password reset
- **booking** (42) — Booking states, confirmations
- **nav** (42) — Navigation labels
- **common** (66) — Buttons, status labels
- **home** (33) — Homepage
- **account** (29) — Account settings
- **listing** (32) — Unit details
- **owner** (100) — Owner dashboard
- **email** (4) — Transactional emails
- **notify** (34) — Notifications
- **messages** (8) — Messaging UI
- **guests** (9) — Guest labels
- **payments** (14) — Payment UI
- **finance** (28) — Statements, NOI
- **tm30** (2) — Immigration compliance
- **services** (57) — Service booking
- **catalog** (41) — Amenities, filters
- **project_page** (31) — Project pages

**Total: 556 keys** (higher than initial estimate due to some overlap)

### Translation Guidelines
1. **Register Thai translator** with:
   - Background in hospitality/real estate
   - Familiarity with Thai legal terms
   - Understanding of Phuket context
   - Experience with US English → Thai (not British)

2. **Translation process:**
   - Translator works from EN/RU context
   - For legal/compliance keys: compare with RU/EN for intent
   - For hospitality keys: use common Thai terms (check competitor apps)
   - For financial: use Thai accounting terminology
   - For common UI: standardize against popular Thai apps (Grab, Agoda, AirBnB TH)

3. **Reviewer:**
   - Have a Thai native speaker review for:
     - Tone consistency (warm, professional, clear)
     - Correctness (no machine-translation artifacts)
     - Completeness (no missing tone markers like polite endings)

### Deliverables
- [ ] Thai translator onboarded
- [ ] 556 keys translated in batches
- [ ] Thai reviewer validates 10% sample
- [ ] All keys updated in content_key table with `translations.th`
- [ ] QA: Load app in Thai locale, verify all text renders correctly
- [ ] No mixed-language pages
- [ ] Commit: "Complete Thai translation for Tier 1 launch keys (T-P1-005)"

### Effort Estimate
- **Translation:** 150–180 hours (~3–4 weeks for professional translator)
- **Review:** 20–30 hours (5% of translation time)
- **QA + fixes:** 10–15 hours

**Total: 3–5 weeks** (depends on translator availability)

---

## Execution Order

### Phase 1 (This Week): Scope & Discovery
- [ ] **Task 1:** Agents scan and report hard-coded strings
- [ ] **Task 2:** Agents audit auth inconsistencies
- [ ] **Task 3:** Agents identify breadcrumb locations
- [ ] **Task 4:** Export 27 flagged keys for founder review
- [ ] **Task 5:** Prepare Thai translation brief + timeline

### Phase 2 (Week 2): Implementation
- [ ] **Task 1:** Migrate hard-coded strings → content keys (2 days)
- [ ] **Task 2:** Standardize auth checks & error handling (1 day)
- [ ] **Task 3:** Build & integrate breadcrumbs (1 day)
- [ ] **Task 4:** Founder reviews & approves 27 keys (async, 1–2 days)
- [ ] **Task 5:** Engage Thai translator (parallel, ongoing)

### Phase 3 (Weeks 3–7): Translation & Final Polish
- [ ] **Task 5:** Thai translator delivers batches (ongoing)
- [ ] **Task 5:** QA & refinement
- [ ] All tasks: Final build, lint, tests, deployment

---

## Success Criteria

✅ All P1 tasks complete when:
1. Zero hard-coded user-facing strings in UI code
2. All auth routes consistently guarded server-side
3. Breadcrumbs present on 8+ critical nested pages
4. All 27 flagged keys founder-approved and marked `ok`
5. 556 Tier 1 keys fully translated to Thai
6. Build passes with zero lint/test errors
7. App loads in EN/RU/TH with correct text rendering
8. All changes committed and pushed to main

---

## File Manifest (Will Update as Tasks Progress)

| Task | Files Created | Files Modified | Commits |
|------|------|-----|---------|
| Hard-coded strings | — | src/app/**/*.tsx | T-P1-001 |
| Auth consistency | — | src/app/api/**/*.ts | T-P1-002 |
| Breadcrumbs | src/components/Breadcrumb.tsx | src/app/**/page.tsx | T-P1-003 |
| Founder review | docs/founder-review.md | — | T-P1-004 |
| Thai translation | — | prisma/seed.ts | T-P1-005 |

---

**Next Step:** Await agent findings on Tasks 1–3. When agents report, begin implementation Phase 2.
