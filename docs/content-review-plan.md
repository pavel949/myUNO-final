# Content Key Audit & Review Prioritization Plan

**Document Date:** August 26, 2026  
**Status:** Active review phase  
**Owner:** Platform team + Founder (review gate)

---

## Executive Summary

The content layer comprises **1,612 content keys** organized in **42 namespaces**. All keys have English and Russian translations seeded (100% coverage), but:

- **Thai translations:** Only 231 keys (14.3%) — **~70% gap** for launch ⚠️
- **Chinese translations:** Only 113 keys (7.0%) — low priority for loop 1
- **Needs review:** Only 27 keys (1.7%) flagged `status: 'needs_review'` — most are seeded as `ok`

**Key finding:** The majority of keys *do* have EN/RU translations, but the **Thai launch** requires urgent translation of ~1,100+ keys. Keys marked `needs_review` are sparse and concentrated in legal/trust namespaces.

---

## Content Key Distribution by Namespace

| Namespace | Total | EN/RU | Thai % | ZH % | Needs Review | **Priority** | **User-Facing?** |
|-----------|-------|-------|--------|------|---|---|---|
| **admin** | 381 | ✅ | 1% | 0% | 0 | T3 | Staff only |
| **audience** | 133 | ✅ | 14% | 1% | 0 | T4 | Marketing pages |
| **owner** | 100 | ✅ | 50% | 0% | 0 | **T1** | **High** — owner statements, dashboards |
| **staff** | 78 | ✅ | 0% | 0% | 0 | **T2** | Operations team |
| **common** | 66 | ✅ | 70% | 0% | 0 | **T1** | **High** — buttons, states, labels |
| **services** | 57 | ✅ | 0% | 37% | 0 | **T2** | Guest booking flow |
| **mc** | 53 | ✅ | 0% | 0% | 0 | **T2** | Management company dashboards |
| **provider** | 49 | ✅ | 10% | 0% | 0 | T3 | Provider onboarding |
| **auth** | 47 | ✅ | 0% | 23% | 0 | **T1** | **High** — login, register, password reset |
| **nav** | 42 | ✅ | 0% | 0% | 0 | **T1** | **High** — navbar, menu labels |
| **booking** | 42 | ✅ | 0% | 0% | 0 | **T1** | **High** — stay booking flow |
| **catalog** | 41 | ✅ | 17% | 0% | 0 | T2 | Amenities, categories |
| **notify** | 34 | ✅ | 26% | 9% | 0 | **T1** | **High** — guest notifications |
| **home** | 33 | ✅ | 0% | 76% | 0 | **T1** | **High** — homepage UI |
| **listing** | 32 | ✅ | 0% | 0% | 0 | **T1** | **High** — unit detail pages |
| **project_page** | 31 | ✅ | 16% | 23% | 0 | T2 | Project landing pages |
| **account** | 29 | ✅ | 0% | 0% | 0 | **T1** | **High** — profile, settings |
| **finance** | 28 | ✅ | 100% | 0% | 0 | **T1** | **High** — owner statements, NOI |
| **service-order** | 28 | ✅ | 7% | 7% | 0 | **T2** | Service ordering UI |
| **landing** | 27 | ✅ | 59% | 0% | 0 | T3 | Onboarding pages |
| **legal** | 25 | ✅ | 32% | 68% | **17** | **T1** | **URGENT** — terms, policies (needs_review) |
| **search** | 25 | ✅ | 0% | 24% | 0 | **T2** | Search filters, results |
| **tickets** | 25 | ✅ | 0% | 0% | 0 | **T2** | Guest support tickets |
| **residence** | 23 | ✅ | 0% | 0% | 0 | T2 | Resident communications |
| **buying** | 22 | ✅ | 0% | 0% | 0 | T3 | Buyer inquiry flow |
| **orders** | 16 | ✅ | 0% | 0% | 0 | T3 | Order status, history |
| **juristic** | 15 | ✅ | 0% | 0% | 0 | T3 | Juristic entity portals |
| **trust** | 14 | ✅ | 29% | 71% | **10** | **T1** | **URGENT** — verify badge, safety (needs_review) |
| **payments** | 14 | ✅ | 0% | 0% | 0 | **T1** | **High** — checkout, receipts |
| **ops** | 14 | ✅ | 0% | 0% | 0 | **T2** | Internal SLA tracking, TM30 |
| **checkin** | 13 | ✅ | 0% | 0% | 0 | **T2** | Check-in flow (TM30, codes) |
| **projects** | 11 | ✅ | 0% | 0% | 0 | T2 | Project selector, listings |
| **ticket** | 10 | ✅ | 100% | 0% | 0 | T2 | Ticket type labels |
| **order** | 10 | ✅ | 40% | 0% | 0 | T3 | Order management |
| **service** | 9 | ✅ | 100% | 0% | 0 | T2 | Service labels |
| **guests** | 9 | ✅ | 0% | 100% | 0 | **T1** | **High** — guest messages, states |
| **messages** | 8 | ✅ | 0% | 0% | 0 | **T1** | **High** — messaging UI, read receipts |
| **announcement** | 5 | ✅ | 100% | 0% | 0 | T2 | Announcements from myUNO/MC |
| **email** | 4 | ✅ | 0% | 25% | 0 | **T1** | **HIGH** — transactional emails (critical!) |
| **area** | 4 | ✅ | 0% | 0% | 0 | T4 | Area/region labels |
| **thread** | 3 | ✅ | 100% | 0% | 0 | T2 | Thread status labels |
| **tm30** | 2 | ✅ | 50% | 0% | 0 | **T1** | **HIGH** — 24h SLA, escalation (legal!) |
| **TOTALS** | **1,612** | **100%** | **14.3%** | **7.0%** | **27** | — | — |

---

## Tier-Based Priority Roadmap

### **TIER 1: Must-Have for Launch** (253 keys)

These must be 100% complete (EN/RU/TH) + founder-reviewed before go-live.

#### High-risk / Legal / Compliance

- **legal** (25 keys) — Terms, PDPA, cancellation policies, house rules  
  - Status: 32% Thai, **17 marked needs_review** ⚠️  
  - Action: **BLOCK launch** until all reviewed + Thai complete
  
- **trust** (14 keys) — Verified badges, identity verification flow, safety items  
  - Status: 29% Thai, **10 marked needs_review** ⚠️  
  - Action: **BLOCK launch** until reviewed + Thai complete
  
- **tm30** (2 keys) — Immigration 24-hour SLA, escalation notifications  
  - Status: 50% Thai  
  - Action: Translate + brief founder on tone (regulatory compliance language)
  
- **payments** (14 keys) — Checkout, receipts, refund policy  
  - Status: 0% Thai  
  - Action: Translate (simple labels mostly)

#### Guest-Facing Core Flows

- **auth** (47 keys) — Login, register, email verification, password reset  
  - Status: 0% Thai  
  - Action: **Translate all** (critical guest funnel)
  
- **booking** (42 keys) — Booking request, pending payment, confirmation states  
  - Status: 0% Thai  
  - Action: **Translate all** (revenue flow)
  
- **email** (4 keys) — Transactional email templates  
  - Status: 0% Thai  
  - Action: **Translate all** (guest communications)
  
- **notify** (34 keys) — Booking alerts, message notifications, status updates  
  - Status: 26% Thai  
  - Action: Translate remaining 74%
  
- **messages** (8 keys) — Message thread UI, read receipts, "new message" label  
  - Status: 0% Thai  
  - Action: Translate all

- **guests** (9 keys) — Guest state labels, past bookings, availability  
  - Status: 0% Thai  
  - Action: Translate all

#### Owner Dashboard & Statements

- **owner** (100 keys) — Unit overview, bookings calendar, availability management  
  - Status: 50% Thai  
  - Action: Translate remaining 50%
  
- **finance** (28 keys) — Statement structure, earned fees, NOI, distributions  
  - Status: 100% Thai ✅  
  - Action: Founder review of tone (technical financial language)

#### Navigation & Core UI

- **common** (66 keys) — Buttons (Save, Cancel, Delete), status labels (Confirmed, Pending)  
  - Status: 70% Thai  
  - Action: Translate remaining 30%
  
- **nav** (42 keys) — Navbar, menu items, "My bookings", "My units"  
  - Status: 0% Thai  
  - Action: Translate all
  
- **home** (33 keys) — Homepage headings, hero section, call-to-action buttons  
  - Status: 0% Thai  
  - Action: Translate all (home is first impression)
  
- **account** (29 keys) — Profile, password settings, email preferences  
  - Status: 0% Thai  
  - Action: Translate all
  
- **listing** (32 keys) — Unit title, amenities, room type, rules  
  - Status: 0% Thai  
  - Action: Translate all

**TIER 1 Total: 253 keys | Thai Gap: ~180+ keys | Estimated Effort: 40-60 hours translation + 10-15 hours founder review**

---

### **TIER 2: High-Priority UX** (259 keys)

Complete after Tier 1; should be done before opening to staff.

- **staff** (78 keys) — Staff dashboards, SLA tracking, unit operations  
  - Status: 0% Thai  
  - Gap: 78 keys
  
- **services** (57 keys) — Guest service bookings, add-ons, pricing  
  - Status: 0% Thai  
  - Gap: 57 keys
  
- **mc** (53 keys) — Management company dashboards, building announcements  
  - Status: 0% Thai  
  - Gap: 53 keys
  
- **catalog** (41 keys) — Amenity labels, room types, amenity picker  
  - Status: 17% Thai  
  - Gap: 34 keys
  
- **ops** (14 keys) — Maintenance logs, TM30 filing, guest verification  
  - Status: 0% Thai  
  - Gap: 14 keys
  
- **checkin** (13 keys) — Door codes, check-in link, arrival date  
  - Status: 0% Thai  
  - Gap: 13 keys
  
- **search** (25 keys) — Filter labels, sort options, map view  
  - Status: 0% Thai  
  - Gap: 25 keys
  
- **tickets** (25 keys) — Support ticket statuses, categories  
  - Status: 0% Thai  
  - Gap: 25 keys
  
- **service-order** (28 keys) — Order confirmation, cancellation, refund status  
  - Status: 7% Thai  
  - Gap: 26 keys
  
- **project_page** (31 keys) — Project name, location, amenities, community highlights  
  - Status: 16% Thai  
  - Gap: 26 keys
  
- **residence** (23 keys) — Resident-only channels, house announcements  
  - Status: 0% Thai  
  - Gap: 23 keys
  
- **provider** (49 keys) — Provider onboarding, service catalog, service hours  
  - Status: 10% Thai  
  - Gap: 44 keys

**TIER 2 Total: 259 keys | Thai Gap: ~216+ keys | Estimated Effort: 50-70 hours translation**

---

### **TIER 3: Important but Not Launch-Critical** (224 keys)

Complete in weeks 2–4 of operations.

- **admin** (381 keys) — Admin panels, reports, system configuration  
  - Status: 1% Thai  
  - Gap: 377 keys  
  - Note: Staff-only; can ship in English initially
  
- **legal** (25 keys) — already in T1
  
- **landing** (27 keys) — Onboarding carousel, tips, welcome messages  
  - Status: 59% Thai  
  - Gap: 11 keys
  
- **buying** (22 keys) — Buyer inquiry forms, developer contact  
  - Status: 0% Thai  
  - Gap: 22 keys
  
- **orders** (16 keys) — Order types, status states  
  - Status: 0% Thai  
  - Gap: 16 keys
  
- **juristic** (15 keys) — Juristic entity role labels, permissions  
  - Status: 0% Thai  
  - Gap: 15 keys
  
- **trust** — already in T1

**TIER 3 Total: 224 keys | Thai Gap: ~208+ keys | Estimated Effort: 40-50 hours translation**

---

### **TIER 4: Nice-to-Have** (166 keys)

Post-launch; future phases.

- **audience** (133 keys) — Marketing pages, campaign messaging, copy variations  
  - Status: 14% Thai  
  - Gap: 114 keys  
  - Note: Can run EN/RU initially
  
- **area** (4 keys) — Area labels (Phuket, Patong, etc.)  
  - Status: 0% Thai  
  - Gap: 4 keys

**TIER 4 Total: 166 keys | Thai Gap: ~153+ keys | Estimated Effort: 20-30 hours translation**

---

## Thai Translation Gaps by Priority

| Tier | Namespace | Total | Thai Gap | % Gap |
|------|-----------|-------|----------|-------|
| **T1** | auth | 47 | 47 | 100% |
| **T1** | booking | 42 | 42 | 100% |
| **T1** | email | 4 | 4 | 100% |
| **T1** | messages | 8 | 8 | 100% |
| **T1** | guests | 9 | 9 | 100% |
| **T1** | nav | 42 | 42 | 100% |
| **T1** | home | 33 | 33 | 100% |
| **T1** | account | 29 | 29 | 100% |
| **T1** | listing | 32 | 32 | 100% |
| **T1** | payments | 14 | 14 | 100% |
| **T1** | common | 66 | 20 | 30% |
| **T1** | notify | 34 | 25 | 74% |
| **T1** | owner | 100 | 50 | 50% |
| **T1** | finance | 28 | 0 | 0% ✅ |
| **T1** | legal | 25 | 17 | 68% |
| **T1** | trust | 14 | 10 | 71% |
| **T1** | tm30 | 2 | 1 | 50% |
| **T2** | staff | 78 | 78 | 100% |
| **T2** | services | 57 | 57 | 100% |
| **T2** | mc | 53 | 53 | 100% |
| **T2** | catalog | 41 | 34 | 83% |
| **T2** | checkin | 13 | 13 | 100% |
| **T2** | search | 25 | 25 | 100% |
| **T2** | tickets | 25 | 25 | 100% |
| **T2** | service-order | 28 | 26 | 93% |
| **T2** | project_page | 31 | 26 | 84% |
| **T2** | residence | 23 | 23 | 100% |
| **T2** | provider | 49 | 44 | 90% |
| **T2** | ops | 14 | 14 | 100% |
| **T3+** | Other | 366 | 353 | 96% |
| **TOTAL** | — | 1,612 | 1,381 | **85.7%** |

---

## Content Review Workflow

### Who Reviews What

**Founder (Pavel / Ignatev) — Tone & Brand Voice Gate**

- **Must review before deployment:**
  - All `needs_review` (27 keys) — especially legal, trust, tone-critical
  - Finance keys (28 keys) — business terminology
  - Any updated copy in email templates
  - New keys added mid-phase
  
- **Process:**
  1. Content team marks key as ready: `status: 'reviewed'` in database
  2. Founder + Content manager sync weekly: 15-min review call on flagged keys
  3. Feedback → content team updates translations → re-marks as `reviewed`
  4. Confirmed keys may deploy

**Translation Team (Russian / Thai speakers)**

- **Scope:**
  - All 1,100+ missing Thai translations for T1 + T2
  - Quality check: idiomatic Thai, not word-for-word English
  - Validate against glossary (property types, roles, SLAs)
  
- **Process:**
  1. Weekly batches: ~150–200 keys per week
  2. Translator updates Translation rows: `locale: 'th'`, `value: '[Thai text]'`
  3. PM spot-checks 10% sample for tone + terminology
  4. Deploy batch to staging, visually verify UI

**Admin / Ops Team — Usage Validation**

- Test every flow in Thai (login → booking → payment → owner dashboard)
- Flag any untranslated strings that appear live
- Report back to translation team for quick fixes

### Status Field Usage

| Status | Meaning | Action |
|--------|---------|--------|
| `ok` | Seeded, translated, ready to deploy | None |
| `needs_review` | Draft copy, founder must review before shipping | Mark as `reviewed` after founder approval |
| `reviewed` | Founder approved, ready to deploy | Deploy |

---

## Execution Plan

### Phase 1: Launch Blockers (Week 1–2)

**Objective:** Unblock Thai for guest-facing core flows

1. **Founder review (2–3 hours)**
   - legal (25) — all 17 needs_review items + 8 new Thai
   - trust (14) — all 10 needs_review items + 4 new Thai
   - email (4) — review transactional email tone
   
2. **Translation team (30–35 hours)**
   - auth (47) — 100% Thai
   - booking (42) — 100% Thai
   - messages (8) — 100% Thai
   - email (4) — 100% Thai (coordinate with founder review)
   - Common high-frequency keys from `common` (20 keys)
   
3. **Validation (5–8 hours)**
   - Guest user test: register → login → search → book → message host
   - All Thai rendering correctly, no fallbacks to English
   
**Exit Criteria:** Guest can complete stay booking entirely in Thai

---

### Phase 2: Owner Dashboard (Week 2–3)

**Objective:** 100% Thai for owner-facing features

1. **Founder review (1–2 hours)**
   - finance (28) — verify business terminology tone
   
2. **Translation team (25–30 hours)**
   - owner (100) — 50% done, translate 50 remaining
   - finance (28) — 100% Thai if approved
   - notify (34) — 26% done, translate 74% remaining
   - nav (42) — 100% Thai
   - account (29) — 100% Thai
   - listing (32) — 100% Thai
   
3. **Validation (5 hours)**
   - Owner user test: login → check statements → manage booking → change availability

**Exit Criteria:** Owner can operate dashboard entirely in Thai

---

### Phase 3: Staff & Operations (Week 3–4)

**Objective:** 100% Thai for internal operations

1. **Translation team (40–45 hours)**
   - staff (78) — 100% Thai
   - ops (14) — 100% Thai
   - checkin (13) — 100% Thai
   - search (25) — 100% Thai
   - tickets (25) — 100% Thai
   - services (57) — 100% Thai
   - Other T2 (42) — remaining catalog, project_page, etc.
   
2. **Validation (10 hours)**
   - Staff test: check TM30 status → file → resolve ticket

**Exit Criteria:** All staff workflows in Thai

---

### Phase 4: Polish & Backfill (Week 4+)

**Scope:** T3 namespaces (admin, buying, landing, etc.)  
**Effort:** 40–50 hours translation  
**Timeline:** Parallel with operations, not blocking

---

## Estimated Timeline & Effort

| Phase | Team | Duration | Effort (hours) | Delivery |
|-------|------|----------|---|---|
| Phase 1: Launch Blockers | Founder + Translation | 2 weeks | 40–45 | Guest core flows 100% Thai |
| Phase 2: Owner Dashboard | Translation | 1 week | 30–35 | Owner 100% Thai |
| Phase 3: Staff & Ops | Translation | 1 week | 40–45 | Ops 100% Thai |
| Phase 4: Polish | Translation | 1 week | 40–50 | Admin + nice-to-have |
| **Total** | — | **4–5 weeks** | **150–175** | **Full platform Thai** |

**Parallel founder review:** 10–15 hours spread across phases

---

## Open Questions & Risks

| ID | Question | Owner | Impact |
|----|----|---|----|
| Q1 | Who is the translation team? (in-house, vendor, freelancer?) | Pavel | Affects timeline + quality control |
| Q2 | Should we hire a native Thai copywriter for tone alignment? | Pavel | Brand voice consistency for Thai market |
| Q3 | Glossary: agreed terms for roles (owner, guest, residence)? | Content team | Translation consistency |
| Q4 | Admin (381 keys, 1% Thai) — acceptable to ship in EN initially? | Pavel | Scope creep vs. launch date |
| Q5 | Which content keys can fall back to English vs. must be Thai? | Product | Locale chain logic in code |
| Q6 | TM30 language — legal translation or operational? | Pavel | Tone (formal compliance vs. friendly) |

---

## Key Findings & Recommendations

### ✅ Strengths

1. **EN/RU is 100% complete** — all 1,612 keys seeded with English and Russian
2. **Finance (28) fully Thai** — no translation work needed for owner statements
3. **Finance tone approved** — `finance` keys are not flagged `needs_review`
4. **Common UI already 70% Thai** — buttons, states, labels mostly translated
5. **Modest needs_review backlog** — only 27 keys; mostly in legal + trust (manageable)

### ⚠️ Critical Gaps for Launch

1. **~1,100 Thai translations missing** across 1,612 keys (85.7% gap overall)
2. **Core guest flows mostly untranslated:**
   - auth (0%), booking (0%), email (0%), messages (0%) — **must ship Thai**
3. **Legal + Trust marked needs_review** — cannot deploy until founder approves
4. **TM30 (2 keys) — regulatory language** — needs founder + legal review

### 📋 Recommendations

1. **Unfreeze translation immediately:** Assign 1–2 Thai translators; start Phase 1 now
2. **Define glossary:** Create a 50-key reference glossary (roles, statuses, financial terms) before bulk translation
3. **Daily founder sync on T1:** 15-min daily stand-up first 2 weeks to unblock legal/trust/tone
4. **Thai QA checklist:** Build test cases for each namespace's Thai rendering (no fallbacks, proper line breaks)
5. **Founder approval gate:** All deployed copy must have founder sign-off; none ships with `needs_review` status
6. **Admin can ship English initially:** 381 keys at 1% Thai; staff speak English; defer to Phase 4
7. **Weekly translation batches:** Organize work in 150-key batches; test each Friday; deploy Mondays
8. **Hire native copywriter:** Consider full-time Thai copywriter post-launch for tone alignment (brand voice > literal translation)

---

## Content Key Validation Checklist

Before deploying any translated batch:

- [ ] All translations have `status: 'ok'` or `status: 'reviewed'` (none `needs_review`)
- [ ] Thai text does not fall back to English in any UI (test in app)
- [ ] Line length and line breaks render correctly (no truncation)
- [ ] Special characters (₿, €, ฿) render properly in locale context
- [ ] Numbers/dates format correctly per locale
- [ ] HTML tags (if `supportsRich: true`) render without breaking layout
- [ ] 10% random sample reviewed by founder (spot-check tone)
- [ ] PM sign-off on translated batch
- [ ] Changelog updated (which keys added/changed this batch)

---

## Files & Configuration

- **Seed file:** `/src/modules/content/seed.ts` — all 1,612 keys + translations defined here
- **Schema:** `prisma/schema.prisma` — `ContentKey` + `Translation` models
- **Usage pattern:** `t('namespace.key')` in components/templates
- **Admin panel:** TBD — content keys edited here post-launch (not in seed)
- **Translation service:** TBD — if multi-locale support grows, swap for i18n library (currently seeded)

---

## Next Steps (Immediate)

1. **Founder approval:** Review this plan + confirm timeline expectations
2. **Hire translation team:** 1–2 Thai speakers; start onboarding
3. **Create glossary:** Founder + PM + translator create 50-key reference document
4. **Set up batch process:** PM assigns 150-key batches weekly; translator completes by Friday
5. **Founder review sync:** Schedule 15-min daily reviews first 2 weeks

---

**Approved by:** [Founder signature]  
**Last updated:** August 26, 2026  
**Next review:** [Date]
