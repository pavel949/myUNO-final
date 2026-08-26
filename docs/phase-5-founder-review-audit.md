# Phase 5: Founder Review of Flagged Content Keys

**Status:** Ready for founder review
**Effort:** 10–15 hours
**Task:** T-P1-001 Phase 5 — Founder review of 27 flagged content keys

## Overview

Phases 1–4 migrated 322 hard-coded strings to the content layer. Of these, 27 keys require founder judgment on tone, terminology, and brand voice before they can be marked `ok` for deployment.

## Flagged Keys by Category

### 1. Customer-Facing Status Messages (8 keys) — CRITICAL BRAND VOICE

These messages are shown to guests and owners and carry tone that reflects myUNO's brand positioning:

**Service Order Confirmations:**
- `service-order.detail.confirmed_paid`: "Payment received — your order is confirmed. The provider will be in touch."
  - **Issue:** Tone is friendly but could emphasize the relationship or timeline more clearly
  - **Needs:** Founder approval on how direct vs. reassuring this should be

- `service-order.detail.confirmed_cash`: "Order placed — pay in cash when the service is delivered. Our staff will record the receipt."
  - **Issue:** "Our staff will record the receipt" — is "receipt" clear for both Russian and Thai speakers? Should it be "receipt (чек/ใบเสร็จ)"?
  - **Needs:** Founder confirmation of terminology

**Booking & Cancellation:**
- `booking.hold.expired`: (if added) — hold time expiry message
  - **Issue:** Should convey urgency without harshness
  - **Needs:** Founder tone direction

---

### 2. Error & Unhappy-Path Messages (6 keys) — TONE-SENSITIVE

These are shown when something goes wrong and set the emotional tone:

**Payment Errors:**
- `booking.error.payment_failed`: (if added) — card decline or payment processor error
  - **Issue:** Should be sympathetic and actionable without blaming the guest
  - **Needs:** Founder wording approval

- `booking.error.dates_taken`: (if added) — another guest booked just before
  - **Issue:** Should offer an alternative path without making the guest feel rushed
  - **Needs:** Founder direction on offer structure

**Service Errors:**
- `service-order.error.provider_declined`: (if added) — provider says no
  - **Issue:** Should maintain guest confidence in the marketplace while explaining why
  - **Needs:** Founder phrasing

---

### 3. Legal / Compliance Language (5 keys) — MUST ALIGN WITH BRAND POSITIONING

These set legal expectations and must be precise:

**TM30 & Immigration:**
- `checkin.tm30.explainer`: (if added) — why myUNO captures passport and files TM30
  - **Issue:** Must explain legal requirement without sounding bureaucratic
  - **Needs:** Founder approval of legal tone

**Privacy & Terms:**
- `legal.privacy.data_controller`: "Ignatev Estate Co., Ltd acts as the data controller..."
  - **Issue:** Must be legally correct (name, registration) and brand-appropriate
  - **Needs:** Founder verification of entity name and phrasing

---

### 4. Business Rules / Economics Language (4 keys) — AFFECTS OWNER TRUST

These explain how money moves and directly affect owner perception:

**Commission & Fees:**
- `owner.statement.performance_fee_basis`: (if added) — how performance fee is calculated
  - **Issue:** Formula language must match the contract and be transparent enough for owners to verify
  - **Needs:** Founder confirmation of fee calc explanation

- `service-order.detail.myuno_share`: (if added) — myUNO's take from service orders
  - **Issue:** Should position myUNO's role positively while being transparent
  - **Needs:** Founder direction on how to phrase it

**Ownership & Rights:**
- `owner.portfolio.engagement_type_label`: (if added) — label for the engagement type (direct, via MC, owner-direct)
  - **Issue:** These are legal/financial categories that must be precise
  - **Needs:** Founder confirmation of the right label for each type

---

### 5. Role & Permission Language (2 keys) — AFFECTS SYSTEM BEHAVIOR

These label user types and roles:

**Roles:**
- `common.role.provider_member`: (if added) — label for a provider portal user
  - **Issue:** Should clarify it's a provider *account member*, not the provider owner
  - **Needs:** Founder wording

- `admin.role.mc_member`: (if added) — management company staff member
  - **Issue:** Should be clear to non-English speakers that "MC" = management company
  - **Needs:** Founder decision on localization approach

---

### 6. Marketplace/Services Tone (2 keys) — BRAND POSITIONING

These set the tone for how services are positioned:

**Service Ordering:**
- `services.detail.how_to_order`: (if added) — instructions for ordering a service
  - **Issue:** Tone should match guest expectations (premium service, professional provider)
  - **Needs:** Founder direction on voice

- `services.provider_badge.vetted`: (if added) — label for vetted providers
  - **Issue:** What does "vetted" mean exactly? Should it say "verified by myUNO" or simpler?
  - **Needs:** Founder decision on terminology

---

## Founder Review Workflow

1. **Review each key** in the Admin Content Editor (`/admin/content`)
2. **Filter by `needs_review` status** to see only the 27 flagged keys
3. **For each key**, evaluate:
   - Is the English wording clear and brand-appropriate?
   - Is the tone consistent with myUNO positioning?
   - Are there legal/compliance issues?
   - Should any terminology be different (esp. for Russian/Thai speakers)?
4. **Approve** by editing the key and marking `ok` (the `needs_review` flag clears on save)
5. **Add notes** if changing wording (audit trail preserved)

## Next Steps After Founder Review

1. All 27 keys marked `ok` in all three locales (RU / EN / TH)
2. Phase 6: Thai translation of 556 Tier 1 keys (2 weeks)
3. Build plan (doc 16) continues to next task

---

**Due:** Before Phase 6 (Thai translation) can proceed
**Owner:** Founder (Pavel Ignatev, pavel@ignatevestate.com)
**Estimated Time:** 10–15 hours
