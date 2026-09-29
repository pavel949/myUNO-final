# Static Repository Route Baseline — 2026-09-29

**Source:** GitHub main commit 4a8ed81b24aee51020486fc049e9ef0af329ffd8. Generated from the Git tree and Prisma source, not by exercising the application. **This is not an E2E, production or authorization pass.** Re-run npm run audit:inventory on latest checkout and compare changed paths and PR branches. See AI_FULL_PLATFORM_AUDIT.md.

## Static counts

| Item | Count |
|---|---:|
| Page files | 110 |
| API handler files | 183 |
| Other route handlers | 3 |
| Domain modules | 17 |
| Source test files | 219 |
| Prisma models | 94 |
| Migration SQL files | 48 |

## All page route candidates

- / — src/app/(public)/page.tsx
- /about — src/app/(public)/about/page.tsx
- /account — src/app/account/page.tsx
- /admin/finance/reconciliation — src/app/admin/finance/reconciliation/page.tsx
- /announcements — src/app/announcements/page.tsx
- /app — src/app/app/page.tsx
- /app/admin — src/app/(admin)/app/admin/page.tsx
- /app/admin/announcements — src/app/(admin)/app/admin/announcements/page.tsx
- /app/admin/areas — src/app/(admin)/app/admin/areas/page.tsx
- /app/admin/audit — src/app/(admin)/app/admin/audit/page.tsx
- /app/admin/bookings — src/app/(admin)/app/admin/bookings/page.tsx
- /app/admin/claims — src/app/(admin)/app/admin/claims/page.tsx
- /app/admin/compliance — src/app/(admin)/app/admin/compliance/page.tsx
- /app/admin/compliance-checklists — src/app/(admin)/app/admin/compliance-checklists/page.tsx
- /app/admin/config — src/app/(admin)/app/admin/config/page.tsx
- /app/admin/content — src/app/(admin)/app/admin/content/page.tsx
- /app/admin/contracts — src/app/(admin)/app/admin/contracts/page.tsx
- /app/admin/crm — src/app/(admin)/app/admin/crm/page.tsx
- /app/admin/crm/opportunities/[id] — src/app/(admin)/app/admin/crm/opportunities/[id]/page.tsx
- /app/admin/developers/[id] — src/app/(admin)/app/admin/developers/[id]/page.tsx
- /app/admin/disputes — src/app/(admin)/app/admin/disputes/page.tsx
- /app/admin/incidents — src/app/(admin)/app/admin/incidents/page.tsx
- /app/admin/integrations — src/app/(admin)/app/admin/integrations/page.tsx
- /app/admin/ledger — src/app/(admin)/app/admin/ledger/page.tsx
- /app/admin/operational-kpis — src/app/(admin)/app/admin/operational-kpis/page.tsx
- /app/admin/organizations — src/app/(admin)/app/admin/organizations/page.tsx
- /app/admin/payouts — src/app/(admin)/app/admin/payouts/page.tsx
- /app/admin/people — src/app/(admin)/app/admin/people/page.tsx
- /app/admin/projects — src/app/(admin)/app/admin/projects/page.tsx
- /app/admin/projects/[id] — src/app/(admin)/app/admin/projects/[id]/page.tsx
- /app/admin/properties/[id]/onboarding — src/app/(admin)/app/admin/properties/[id]/onboarding/page.tsx
- /app/admin/properties/new — src/app/(admin)/app/admin/properties/new/page.tsx
- /app/admin/prospecting — src/app/(admin)/app/admin/prospecting/page.tsx
- /app/admin/providers — src/app/(admin)/app/admin/providers/page.tsx
- /app/admin/reports/attribution — src/app/(admin)/app/admin/reports/attribution/page.tsx
- /app/admin/scheduler — src/app/(admin)/app/admin/scheduler/page.tsx
- /app/admin/service-orders — src/app/(admin)/app/admin/service-orders/page.tsx
- /app/admin/services — src/app/(admin)/app/admin/services/page.tsx
- /app/admin/signals — src/app/(admin)/app/admin/signals/page.tsx
- /app/admin/statements — src/app/(admin)/app/admin/statements/page.tsx
- /app/admin/tickets — src/app/(admin)/app/admin/tickets/page.tsx
- /app/admin/units — src/app/(admin)/app/admin/units/page.tsx
- /app/admin/units/[id] — src/app/(admin)/app/admin/units/[id]/page.tsx
- /auth/claim — src/app/auth/claim/page.tsx
- /auth/reset-password — src/app/auth/reset-password/page.tsx
- /auth/verify — src/app/auth/verify/page.tsx
- /book/review — src/app/book/review/page.tsx
- /bookings/[bookingId]/home-space — src/app/bookings/[bookingId]/home-space/page.tsx
- /bookings/[bookingId]/home-space/handbook — src/app/bookings/[bookingId]/home-space/handbook/page.tsx
- /bookings/[bookingId]/passports — src/app/bookings/[bookingId]/passports/page.tsx
- /buyers — src/app/(public)/buyers/page.tsx
- /buying — src/app/buying/page.tsx
- /checkout/[sessionId] — src/app/checkout/[sessionId]/page.tsx
- /design — src/app/design/page.tsx
- /developers — src/app/(public)/developers/page.tsx
- /guests — src/app/(public)/guests/page.tsx
- /guests/access — src/app/(public)/guests/access/page.tsx
- /juristic — src/app/juristic/page.tsx
- /legal — src/app/(public)/legal/page.tsx
- /legal/privacy — src/app/(public)/legal/privacy/page.tsx
- /legal/terms — src/app/(public)/legal/terms/page.tsx
- /login — src/app/login/page.tsx
- /management-companies — src/app/(public)/management-companies/page.tsx
- /mc — src/app/mc/page.tsx
- /mc/calendar — src/app/mc/calendar/page.tsx
- /mc/costs — src/app/mc/costs/page.tsx
- /mc/mobilization — src/app/mc/mobilization/page.tsx
- /mc/mobilization/[unitId] — src/app/mc/mobilization/[unitId]/page.tsx
- /mc/requests — src/app/mc/requests/page.tsx
- /mc/tm30 — src/app/mc/tm30/page.tsx
- /mc/units/[unitId] — src/app/mc/units/[unitId]/page.tsx
- /messages — src/app/messages/page.tsx
- /messages/[threadId] — src/app/messages/[threadId]/page.tsx
- /ops — src/app/ops/page.tsx
- /ops/calendar — src/app/ops/calendar/page.tsx
- /ops/calendar/[unitId] — src/app/ops/calendar/[unitId]/page.tsx
- /ops/claims — src/app/ops/claims/page.tsx
- /ops/costs — src/app/ops/costs/page.tsx
- /ops/mobilization — src/app/ops/mobilization/page.tsx
- /ops/mobilization/[unitId] — src/app/ops/mobilization/[unitId]/page.tsx
- /ops/requests — src/app/ops/requests/page.tsx
- /ops/tm30 — src/app/ops/tm30/page.tsx
- /owner — src/app/owner/page.tsx
- /owner/statements — src/app/owner/statements/page.tsx
- /owner/statements/[statementId] — src/app/owner/statements/[statementId]/page.tsx
- /owner/units/[unitId] — src/app/owner/units/[unitId]/page.tsx
- /owners — src/app/(public)/owners/page.tsx
- /projects — src/app/(public)/projects/page.tsx
- /projects/[slug] — src/app/(public)/projects/[slug]/page.tsx
- /provider — src/app/provider/page.tsx
- /provider/apply — src/app/provider/apply/page.tsx
- /provider/remittances — src/app/provider/remittances/page.tsx
- /provider/services — src/app/provider/services/page.tsx
- /providers — src/app/(public)/providers/page.tsx
- /register — src/app/register/page.tsx
- /residence — src/app/residence/page.tsx
- /saved — src/app/saved/page.tsx
- /search — src/app/search/page.tsx
- /services — src/app/services/page.tsx
- /services/[id] — src/app/services/[id]/page.tsx
- /services/orders — src/app/services/orders/page.tsx
- /services/orders/[orderId] — src/app/services/orders/[orderId]/page.tsx
- /tickets — src/app/tickets/page.tsx
- /tickets/[id] — src/app/tickets/[id]/page.tsx
- /tickets/new — src/app/tickets/new/page.tsx
- /trips — src/app/trips/page.tsx
- /trips/[id] — src/app/trips/[id]/page.tsx
- /trust — src/app/(public)/trust/page.tsx
- /trust/ombudsman — src/app/(public)/trust/ombudsman/page.tsx
- /units/[id] — src/app/units/[id]/page.tsx

## Non-API route handlers

- /[vanitySlug] — src/app/[vanitySlug]/route.ts
- /[vanitySlug]/guest — src/app/[vanitySlug]/guest/route.ts
- /llms.txt — src/app/llms.txt/route.ts

## All API handlers

- /api/account/consent — src/app/api/account/consent/route.ts
- /api/account/notifications — src/app/api/account/notifications/route.ts
- /api/account/password — src/app/api/account/password/route.ts
- /api/account/profile — src/app/api/account/profile/route.ts
- /api/admin/areas — src/app/api/admin/areas/route.ts
- /api/admin/areas/[id] — src/app/api/admin/areas/[id]/route.ts
- /api/admin/audit/export — src/app/api/admin/audit/export/route.ts
- /api/admin/bookings — src/app/api/admin/bookings/route.ts
- /api/admin/compliance-checklists — src/app/api/admin/compliance-checklists/route.ts
- /api/admin/compliance-checklists/[id] — src/app/api/admin/compliance-checklists/[id]/route.ts
- /api/admin/config — src/app/api/admin/config/route.ts
- /api/admin/config/[paramKey] — src/app/api/admin/config/[paramKey]/route.ts
- /api/admin/config/[paramKey]/history — src/app/api/admin/config/[paramKey]/history/route.ts
- /api/admin/content — src/app/api/admin/content/route.ts
- /api/admin/content/[keyId] — src/app/api/admin/content/[keyId]/route.ts
- /api/admin/content/export — src/app/api/admin/content/export/route.ts
- /api/admin/content/import — src/app/api/admin/content/import/route.ts
- /api/admin/content/namespace/[namespace] — src/app/api/admin/content/namespace/[namespace]/route.ts
- /api/admin/contracts — src/app/api/admin/contracts/route.ts
- /api/admin/crm/activities — src/app/api/admin/crm/activities/route.ts
- /api/admin/crm/opportunities — src/app/api/admin/crm/opportunities/route.ts
- /api/admin/crm/opportunities/[opportunityId]/transition — src/app/api/admin/crm/opportunities/[opportunityId]/transition/route.ts
- /api/admin/crm/pipeline — src/app/api/admin/crm/pipeline/route.ts
- /api/admin/crm/profiles/[profileId]/transition — src/app/api/admin/crm/profiles/[profileId]/transition/route.ts
- /api/admin/deposit-claims/[id] — src/app/api/admin/deposit-claims/[id]/route.ts
- /api/admin/disputes — src/app/api/admin/disputes/route.ts
- /api/admin/disputes/[id]/decide — src/app/api/admin/disputes/[id]/decide/route.ts
- /api/admin/fees/[contractId] — src/app/api/admin/fees/[contractId]/route.ts
- /api/admin/fees/calculate — src/app/api/admin/fees/calculate/route.ts
- /api/admin/finance/reconciliation — src/app/api/admin/finance/reconciliation/route.ts
- /api/admin/finance/refunds/[refundId]/resolve — src/app/api/admin/finance/refunds/[refundId]/resolve/route.ts
- /api/admin/incidents — src/app/api/admin/incidents/route.ts
- /api/admin/incidents/[id] — src/app/api/admin/incidents/[id]/route.ts
- /api/admin/ledger — src/app/api/admin/ledger/route.ts
- /api/admin/ledger/[entryId]/reverse — src/app/api/admin/ledger/[entryId]/reverse/route.ts
- /api/admin/operational-kpis — src/app/api/admin/operational-kpis/route.ts
- /api/admin/organizations — src/app/api/admin/organizations/route.ts
- /api/admin/organizations/[organizationId] — src/app/api/admin/organizations/[organizationId]/route.ts
- /api/admin/payouts/[payoutId]/reconcile — src/app/api/admin/payouts/[payoutId]/reconcile/route.ts
- /api/admin/payouts/owner — src/app/api/admin/payouts/owner/route.ts
- /api/admin/payouts/provider — src/app/api/admin/payouts/provider/route.ts
- /api/admin/payouts/provider/preview — src/app/api/admin/payouts/provider/preview/route.ts
- /api/admin/people/[identityId]/block — src/app/api/admin/people/[identityId]/block/route.ts
- /api/admin/people/[identityId]/roles — src/app/api/admin/people/[identityId]/roles/route.ts
- /api/admin/people/[identityId]/unblock — src/app/api/admin/people/[identityId]/unblock/route.ts
- /api/admin/people/invite — src/app/api/admin/people/invite/route.ts
- /api/admin/people/search — src/app/api/admin/people/search/route.ts
- /api/admin/projects — src/app/api/admin/projects/route.ts
- /api/admin/projects/[id] — src/app/api/admin/projects/[id]/route.ts
- /api/admin/projects/[id]/catalog — src/app/api/admin/projects/[id]/catalog/route.ts
- /api/admin/projects/[id]/media — src/app/api/admin/projects/[id]/media/route.ts
- /api/admin/prospecting — src/app/api/admin/prospecting/route.ts
- /api/admin/prospecting/[id]/transition — src/app/api/admin/prospecting/[id]/transition/route.ts
- /api/admin/providers — src/app/api/admin/providers/route.ts
- /api/admin/providers/[id] — src/app/api/admin/providers/[id]/route.ts
- /api/admin/reports/attribution — src/app/api/admin/reports/attribution/route.ts
- /api/admin/roles/grant — src/app/api/admin/roles/grant/route.ts
- /api/admin/roles/revoke — src/app/api/admin/roles/revoke/route.ts
- /api/admin/service-orders — src/app/api/admin/service-orders/route.ts
- /api/admin/services — src/app/api/admin/services/route.ts
- /api/admin/services/[id] — src/app/api/admin/services/[id]/route.ts
- /api/admin/statements/[statementId]/line-items — src/app/api/admin/statements/[statementId]/line-items/route.ts
- /api/admin/statements/[statementId]/sign-off — src/app/api/admin/statements/[statementId]/sign-off/route.ts
- /api/admin/statements/generate — src/app/api/admin/statements/generate/route.ts
- /api/admin/units — src/app/api/admin/units/route.ts
- /api/admin/units/[id] — src/app/api/admin/units/[id]/route.ts
- /api/admin/units/[id]/compliance — src/app/api/admin/units/[id]/compliance/route.ts
- /api/admin/units/[id]/compliance/[recordId] — src/app/api/admin/units/[id]/compliance/[recordId]/route.ts
- /api/admin/units/[id]/confirm-permitted-use — src/app/api/admin/units/[id]/confirm-permitted-use/route.ts
- /api/admin/units/[id]/engagement — src/app/api/admin/units/[id]/engagement/route.ts
- /api/admin/units/[id]/media — src/app/api/admin/units/[id]/media/route.ts
- /api/admin/units/[id]/mobilization — src/app/api/admin/units/[id]/mobilization/route.ts
- /api/admin/units/[id]/mobilization/[itemId] — src/app/api/admin/units/[id]/mobilization/[itemId]/route.ts
- /api/admin/units/[id]/owner — src/app/api/admin/units/[id]/owner/route.ts
- /api/admin/units/[id]/property-details — src/app/api/admin/units/[id]/property-details/route.ts
- /api/admin/units/[id]/status — src/app/api/admin/units/[id]/status/route.ts
- /api/announcements — src/app/api/announcements/route.ts
- /api/announcements/[id] — src/app/api/announcements/[id]/route.ts
- /api/announcements/[id]/publish — src/app/api/announcements/[id]/publish/route.ts
- /api/auth/callback/google — src/app/api/auth/callback/google/route.ts
- /api/auth/claim — src/app/api/auth/claim/route.ts
- /api/auth/claim/[token] — src/app/api/auth/claim/[token]/route.ts
- /api/auth/claim/generate-link — src/app/api/auth/claim/generate-link/route.ts
- /api/auth/forgot-password — src/app/api/auth/forgot-password/route.ts
- /api/auth/guest-access — src/app/api/auth/guest-access/route.ts
- /api/auth/login — src/app/api/auth/login/route.ts
- /api/auth/logout — src/app/api/auth/logout/route.ts
- /api/auth/me — src/app/api/auth/me/route.ts
- /api/auth/register — src/app/api/auth/register/route.ts
- /api/auth/reset-password — src/app/api/auth/reset-password/route.ts
- /api/auth/verify-email — src/app/api/auth/verify-email/route.ts
- /api/bookings — src/app/api/bookings/route.ts
- /api/bookings/[id] — src/app/api/bookings/[id]/route.ts
- /api/bookings/[id]/cancel — src/app/api/bookings/[id]/cancel/route.ts
- /api/bookings/[id]/check-out — src/app/api/bookings/[id]/check-out/route.ts
- /api/bookings/[id]/checkin — src/app/api/bookings/[id]/checkin/route.ts
- /api/bookings/[id]/checkout — src/app/api/bookings/[id]/checkout/route.ts
- /api/bookings/[id]/deposit-claim — src/app/api/bookings/[id]/deposit-claim/route.ts
- /api/bookings/[id]/guests — src/app/api/bookings/[id]/guests/route.ts
- /api/bookings/[id]/internal-note — src/app/api/bookings/[id]/internal-note/route.ts
- /api/bookings/[id]/modify — src/app/api/bookings/[id]/modify/route.ts
- /api/bookings/[id]/record-cash-payment — src/app/api/bookings/[id]/record-cash-payment/route.ts
- /api/bookings/[id]/record-transfer — src/app/api/bookings/[id]/record-transfer/route.ts
- /api/bookings/[id]/respond — src/app/api/bookings/[id]/respond/route.ts
- /api/bookings/[id]/stay-review — src/app/api/bookings/[id]/stay-review/route.ts
- /api/bookings/[id]/transfer-instructions — src/app/api/bookings/[id]/transfer-instructions/route.ts
- /api/bookings/[id]/verify-passports — src/app/api/bookings/[id]/verify-passports/route.ts
- /api/bookings/me — src/app/api/bookings/me/route.ts
- /api/buyer-signals/[signalId]/transition — src/app/api/buyer-signals/[signalId]/transition/route.ts
- /api/buying/interest — src/app/api/buying/interest/route.ts
- /api/checkout/[sessionId] — src/app/api/checkout/[sessionId]/route.ts
- /api/checkout/confirm — src/app/api/checkout/confirm/route.ts
- /api/content/translate — src/app/api/content/translate/route.ts
- /api/crm/activities/[id] — src/app/api/crm/activities/[id]/route.ts
- /api/crm/dashboard/next-actions — src/app/api/crm/dashboard/next-actions/route.ts
- /api/crm/dashboard/summary — src/app/api/crm/dashboard/summary/route.ts
- /api/crm/opportunities — src/app/api/crm/opportunities/route.ts
- /api/crm/opportunities/[id] — src/app/api/crm/opportunities/[id]/route.ts
- /api/crm/opportunities/[id]/activities — src/app/api/crm/opportunities/[id]/activities/route.ts
- /api/crm/opportunities/[id]/stage — src/app/api/crm/opportunities/[id]/stage/route.ts
- /api/cron/check-tm30-escalations — src/app/api/cron/check-tm30-escalations/route.ts
- /api/cron/check-verification-deadlines — src/app/api/cron/check-verification-deadlines/route.ts
- /api/cron/expire-service-orders — src/app/api/cron/expire-service-orders/route.ts
- /api/cron/retention-jobs — src/app/api/cron/retention-jobs/route.ts
- /api/cron/rollup-metrics — src/app/api/cron/rollup-metrics/route.ts
- /api/cron/run-all — src/app/api/cron/run-all/route.ts
- /api/cron/run-frequent — src/app/api/cron/run-frequent/route.ts
- /api/cron/sync-ical-imports — src/app/api/cron/sync-ical-imports/route.ts
- /api/deposit-claims/[id]/dispute — src/app/api/deposit-claims/[id]/dispute/route.ts
- /api/disputes — src/app/api/disputes/route.ts
- /api/health — src/app/api/health/route.ts
- /api/leads — src/app/api/leads/route.ts
- /api/ledger/record-cost — src/app/api/ledger/record-cost/route.ts
- /api/mc/fee-report — src/app/api/mc/fee-report/route.ts
- /api/media/upload — src/app/api/media/upload/route.ts
- /api/messages/[messageId]/flag-as-purchase — src/app/api/messages/[messageId]/flag-as-purchase/route.ts
- /api/notifications — src/app/api/notifications/route.ts
- /api/notifications/stream — src/app/api/notifications/stream/route.ts
- /api/owner-stays — src/app/api/owner-stays/route.ts
- /api/owner/statements — src/app/api/owner/statements/route.ts
- /api/owner/statements/[statementId]/question — src/app/api/owner/statements/[statementId]/question/route.ts
- /api/owner/statements/[statementId]/sign-off — src/app/api/owner/statements/[statementId]/sign-off/route.ts
- /api/owner/units/[unitId]/contract — src/app/api/owner/units/[unitId]/contract/route.ts
- /api/pricing/breakdown — src/app/api/pricing/breakdown/route.ts
- /api/profile/export — src/app/api/profile/export/route.ts
- /api/provider/me — src/app/api/provider/me/route.ts
- /api/provider/orders — src/app/api/provider/orders/route.ts
- /api/provider/remittances — src/app/api/provider/remittances/route.ts
- /api/provider/services — src/app/api/provider/services/route.ts
- /api/provider/services/[id] — src/app/api/provider/services/[id]/route.ts
- /api/providers/apply — src/app/api/providers/apply/route.ts
- /api/search/units — src/app/api/search/units/route.ts
- /api/service-orders — src/app/api/service-orders/route.ts
- /api/service-orders/[id] — src/app/api/service-orders/[id]/route.ts
- /api/service-orders/[id]/accept — src/app/api/service-orders/[id]/accept/route.ts
- /api/service-orders/[id]/cancel — src/app/api/service-orders/[id]/cancel/route.ts
- /api/service-orders/[id]/checkout — src/app/api/service-orders/[id]/checkout/route.ts
- /api/service-orders/[id]/decline — src/app/api/service-orders/[id]/decline/route.ts
- /api/service-orders/[id]/detail — src/app/api/service-orders/[id]/detail/route.ts
- /api/service-orders/[id]/fulfil — src/app/api/service-orders/[id]/fulfil/route.ts
- /api/service-orders/[id]/no-show — src/app/api/service-orders/[id]/no-show/route.ts
- /api/service-orders/[id]/rate — src/app/api/service-orders/[id]/rate/route.ts
- /api/service-orders/[id]/record-cash-payment — src/app/api/service-orders/[id]/record-cash-payment/route.ts
- /api/services — src/app/api/services/route.ts
- /api/services/[id] — src/app/api/services/[id]/route.ts
- /api/threads — src/app/api/threads/route.ts
- /api/threads/[threadId] — src/app/api/threads/[threadId]/route.ts
- /api/threads/[threadId]/stream — src/app/api/threads/[threadId]/stream/route.ts
- /api/tickets — src/app/api/tickets/route.ts
- /api/tickets/[id] — src/app/api/tickets/[id]/route.ts
- /api/tickets/[id]/assign — src/app/api/tickets/[id]/assign/route.ts
- /api/tickets/[id]/status — src/app/api/tickets/[id]/status/route.ts
- /api/tm30/[id]/fail — src/app/api/tm30/[id]/fail/route.ts
- /api/tm30/[id]/file — src/app/api/tm30/[id]/file/route.ts
- /api/tm30/[id]/passport — src/app/api/tm30/[id]/passport/route.ts
- /api/tm30/queue — src/app/api/tm30/queue/route.ts
- /api/units/[unitId] — src/app/api/units/[unitId]/route.ts
- /api/units/[unitId]/availability-blocks — src/app/api/units/[unitId]/availability-blocks/route.ts
- /api/units/[unitId]/availability-blocks/[blockId] — src/app/api/units/[unitId]/availability-blocks/[blockId]/route.ts
- /api/units/[unitId]/ical/export — src/app/api/units/[unitId]/ical/export/route.ts
- /api/units/[unitId]/pricing-rules — src/app/api/units/[unitId]/pricing-rules/route.ts
- /api/units/[unitId]/pricing-rules/[ruleId] — src/app/api/units/[unitId]/pricing-rules/[ruleId]/route.ts
- /api/webhooks/opn — src/app/api/webhooks/opn/route.ts

## Domain modules

analytics, audit, auth, booking, browse, comms, compliance, config, content, core, crm, finance, integrations, media, ops, projects, services

## Prisma model names

AnalyticsEvent, Announcement, AnnouncementRead, Area, AuditLog, AuthAccount, Bed, BlockedDate, Booking, BookingChange, BookingGuest, BookingReschedule, BuyerSignal, Channel, ChannelMapping, CommercialOffering, ComplianceChecklistInstance, ComplianceChecklistTemplate, ComplianceRecord, ConditionReport, ConditionReportMedia, ConfigChange, ConfigOverride, ConfigParameter, ContentKey, CrmActivity, CrmAttributionTouch, CrmConsent, CrmOpportunity, CrmProfile, DepositClaim, DepositPreauth, Dispute, EarnedFee, ExternalAggregateCheckpoint, ExternalEventInbox, ExternalMapping, ExternalSystem, Identity, IncidentLog, IntegrationAccount, InventoryCategory, JobRun, LedgerEntry, LifecycleTransitionLog, ManagementContract, MediaAsset, Message, MetricDaily, MobilizationChecklistItem, Notification, NotificationDelivery, NotificationPreference, OneTimeToken, OperationalKpi, Organization, OwnerStatement, OwnershipPeriod, Payment, Payout, PricingRule, Project, ProjectMedia, ProjectOnboardingDraft, ProjectOrganizationRole, PropertyOnboardingTemplate, ProspectingAccount, Provider, ProviderProject, RatePlan, Refund, RegulatoryCredential, Review, RoleAssignment, SavedSearch, SavedUnit, Service, ServiceMedia, ServiceOrder, ServiceProject, ServiceQuoteRequest, ServiceQuoteVersion, SleepingSpace, StatementLineItem, Thread, ThreadParticipant, Ticket, TicketEvent, TicketMedia, Tm30Filing, Translation, Unit, UnitEngagement, UnitMedia

## Interpretation rules

- A page file may be inaccessible by navigation or role; its existence does not prove a usable flow.
- A handler may be a stub or have incorrect permissions; an API file does not prove working business logic.
- Models and migration files do not prove migration deployment or production data/config.
- Audit every surface against CO01–CO30 and AT01–AT30, role-state-mobile-language matrix and branch/deploy identity.
- Compare PR #144 and its dependencies separately; this snapshot describes main only.
