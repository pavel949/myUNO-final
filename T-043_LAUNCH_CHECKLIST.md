# T-043 · Launch Checklist — Production Readiness

**Task:** Verify production environment setup, backup procedures, payment provider integration, monitoring/alerts, legal content, and TM30 staff rehearsal.

**Status:** Ready for founder sign-off  
**Date:** 2026-07-15

---

## 1. Production Environment Setup

- [ ] **Infrastructure provisioning**
  - [ ] Cloud hosting environment selected (doc 15 §2 — AWS/GCP/other)
  - [ ] Database (PostgreSQL) provisioned and replicated
  - [ ] S3/blob storage configured for media assets
  - [ ] DNS domain registered and CNAME configured
  - [ ] SSL certificate provisioned (Let's Encrypt or provider default)

- [ ] **Environment variables**
  - [ ] Production `.env` file configured (secrets in platform secret manager, not repo)
  - [ ] Database connection string validated
  - [ ] Auth session secret rotated
  - [ ] Payment provider keys configured (see §2 below)
  - [ ] Email provider API key configured (Resend or equivalent)
  - [ ] Monitoring API keys configured (see §4 below)

- [ ] **Deployment pipeline**
  - [ ] CI/CD workflow verified (`.github/workflows/ci.yml` runs on PR)
  - [ ] Build passes locally and in CI (tests + lint + type check)
  - [ ] Deployment script/workflow configured for main branch
  - [ ] Zero-downtime deployment strategy documented (blue-green or rolling)

---

## 2. Payment Provider Integration — Q8

⚠️ **This item is blocked by open question Q8** (doc `open_questions.md`):
> Which licensed payment provider (Opn/Omise, Stripe, other) for card + Thai payment methods in loop two?

**Status:** Q8 decision required from founder.

**Current state:**
- [ ] **Cash-first loop (complete):**
  - [ ] `recordCashPayment` flow implemented (doc 10 §1)
  - [ ] Staff cash-payment recording UI on ops board ✅
  - [ ] Ledger auto-entry on cash confirmation ✅
  - [ ] Mock provider adapter in place for testing ✅

- [ ] **Provider selection for loop two:**
  - [ ] Opn payment credentials (live merchant account + test keys) — OR
  - [ ] Omise payment credentials (live merchant account + test keys) — OR
  - [ ] Other provider (specify below)
  - [ ] Provider adapter implemented in `src/modules/finance/providers/`
  - [ ] Webhook handler configured and signed-secret verified
  - [ ] Callback URL registered with provider
  - [ ] Test transaction flow (order → checkout → confirm → ledger entry)

**Blockers waiting for founder:**
- [ ] Email: pavel@ignatevestate.com — "Which payment provider for card + Thai methods?"
- [ ] Once decided, wire provider credentials and verify live test transaction

---

## 3. Backup & Disaster Recovery

- [ ] **Database backups**
  - [ ] Automated daily backups enabled (cloud provider default)
  - [ ] Backup retention policy configured (minimum 30 days)
  - [ ] Backup location verified (geographic redundancy if applicable)
  - [ ] **Restore drill completed** — restore a backup to a test DB and verify:
    - [ ] All tables present and queryable
    - [ ] Foreign key constraints intact
    - [ ] Identity/Role data loaded correctly
    - [ ] Recent booking records present

- [ ] **Media asset backups**
  - [ ] S3/blob storage replication enabled (cross-region if critical)
  - [ ] Media asset integrity check (sample downloads verify no corruption)

- [ ] **Secrets rotation plan**
  - [ ] Database password rotation procedure documented
  - [ ] API key rotation schedule (quarterly for payment provider keys)
  - [ ] Emergency key revocation procedure documented

- [ ] **Incident recovery SLA**
  - [ ] RTO (Recovery Time Objective) documented (target: 1 hour)
  - [ ] RPO (Recovery Point Objective) documented (target: 1 hour of data loss)

---

## 4. Monitoring & Alerts

- [ ] **Application monitoring**
  - [ ] Error tracking configured (Sentry, Datadog, or equivalent)
  - [ ] Exception alerts wired to ops email
  - [ ] Dashboard created (API response times, error rates, booking completion)
  - [ ] Alert thresholds set (>5% error rate, >2s P95 latency, etc.)

- [ ] **Database monitoring**
  - [ ] Query performance monitoring enabled
  - [ ] Connection pool exhaustion alert configured
  - [ ] Disk space alert configured (80% threshold)
  - [ ] Replication lag monitored (if applicable)

- [ ] **Payment flow monitoring**
  - [ ] Webhook delivery success rate tracked
  - [ ] Payment confirmation latency monitored
  - [ ] Failed checkout alert configured

- [ ] **Infrastructure monitoring**
  - [ ] CPU/memory usage monitored
  - [ ] Disk I/O monitored
  - [ ] Network bandwidth monitored
  - [ ] SSL certificate expiry alert (30 days before expiration)

- [ ] **Uptime monitoring**
  - [ ] Synthetic health check (ping `/api/health` every 5 min)
  - [ ] Uptime SLA target: 99.5%
  - [ ] Alert on consecutive failures (>3 missed checks)

- [ ] **On-call & escalation**
  - [ ] On-call rotation configured (if multi-person ops team)
  - [ ] Escalation phone number configured
  - [ ] Alert routing to Slack/PagerDuty verified

---

## 5. Legal & Trust Content — Q15/Q16

⚠️ **This item is blocked by open questions Q15–Q16** (doc `open_questions.md`):

> **Q15:** What trust & safety content does the founder want to display (FAQ, guarantees, liability limits)?
> **Q16:** Who is the PDPA data controller and privacy officer (to display in `legal.privacy`)?

**Current state:**
- [x] Privacy notice content key structure exists (`legal.privacy.*`)
- [x] Terms of service structure exists (`legal.terms.*`)
- [x] Trust page routing configured (`/trust` → TrustPage)
- [x] Ombudsman contact page structure exists (`/trust/ombudsman`)

**Blocked waiting for founder:**
- [ ] Email: pavel@ignatevestate.com — "What trust/safety/liability content for public display?"
- [ ] Email: pavel@ignatevestate.com — "Confirm PDPA controller details (DBD #, address, contact)."
- [ ] Once provided, populate content keys via admin content editor

**Fallback (if Q15/Q16 not answered before launch):**
- [ ] Disable trust pages (404 or redirect to homepage)
- [ ] Display placeholder privacy notice with founder contact email
- [ ] Add log entry to `open_questions.md`: "Q15/Q16 content deferred to post-launch"

---

## 6. TM30 Process Rehearsal — Q10

⚠️ **This item is blocked by open question Q10** (doc `open_questions.md`):

> **Q10:** Who are the staff members trained on TM30 filing? What is the rehearsal schedule?

**TM30 System (built in T-024/T-025/T-026):**
- [x] Passport capture UI per guest (encrypted fields)
- [x] Pre-arrival verification deadline job
- [x] TM30 queue with SLA countdown
- [x] File/receipt recording flow
- [x] Failure + escalation path

**Required before go-live:**
- [ ] Staff briefing scheduled (ops manager + on-site host)
- [ ] Dry run on test booking:
  - [ ] Guest arrives → check-in confirm → TM30 row created
  - [ ] Passport captured → TM30 queue shows new filing
  - [ ] Staff files with real TM30 form (or test environment)
  - [ ] Receipt recorded → TM30 status → "filed"
  - [ ] Escalation flow tested (SLA time remaining decrements)
  - [ ] Failed filing path tested → escalation notification

- [ ] Founder decision: Q10 clarification
  - [ ] Staff roles/names
  - [ ] Rehearsal date (before go-live)
  - [ ] Backup procedure if primary staff unavailable

---

## 7. Go-Live Readiness Sign-Off

- [ ] **Founder verification**
  - [ ] All Q-blocked items addressed or explicitly waived
  - [ ] Staging environment walkthrough complete (every doc 07 flow)
  - [ ] Production database seeded (demo project + test units)
  - [ ] Payment flow tested (cash order → confirm → ledger entry)
  - [ ] Backup restore drill passed
  - [ ] Monitoring alerts validated (test alert → email/Slack)
  - [ ] TM30 rehearsal completed with staff

- [ ] **Launch signoff**
  - [ ] Founder: "Ready to go live" ✅
  - [ ] Deployment to production scheduled
  - [ ] Incident response team on standby
  - [ ] Customer support email monitored
  - [ ] Analytics/metrics baseline recorded for day-one comparison

---

## 8. Post-Launch Checklist (First 24 Hours)

- [ ] Monitor error tracking for any new exceptions
- [ ] Verify analytics events flowing correctly
- [ ] Check payment webhook delivery (>95% success rate)
- [ ] Review database slow-query logs
- [ ] Confirm backup jobs ran successfully
- [ ] Test end-to-end booking flow with real payment provider
- [ ] Verify TM30 queue for any filed bookings
- [ ] Check staff notifications working (booking, ticket escalations)

---

## Summary

| Item | Owner | Status | Due |
|------|-------|--------|-----|
| Production infrastructure | DevOps | ⏳ | Before deploy |
| Payment provider (Q8) | **Founder** | 🔴 Blocked | Decision needed |
| Backup & restore drill | DevOps | ⏳ | Before deploy |
| Monitoring & alerts | DevOps | ⏳ | Before deploy |
| Legal content (Q15/Q16) | **Founder** | 🔴 Blocked | Before public launch |
| TM30 rehearsal (Q10) | **Founder + ops** | 🔴 Blocked | Before go-live |
| Go-live sign-off | **Founder** | ⏳ | All items done |

**Notes:**
- Items marked **Blocked** require founder decision/input
- Items marked **⏳** are infrastructure/DevOps tasks (can be prepared in parallel)
- First loop is production-ready for cash-only bookings after founder answers Q8 (payment provider)
- Additional work post-launch: card + Thai payment methods, full analytics dashboard, Superhost system refinements

---

## Founder Checklist — Next Steps

1. **Decision Q8:** Which payment provider?
   - [ ] Reply with choice (Opn / Omise / other)
   - [ ] Provide live merchant credentials
   - [ ] Schedule provider integration testing

2. **Decision Q15/Q16:** Trust content + PDPA controller
   - [ ] Provide trust/safety/FAQ content (or approve placeholder)
   - [ ] Confirm DBD number, controller address, privacy officer contact
   - [ ] Provide liability/guarantee terms (if any)

3. **Decision Q10:** TM30 staff & rehearsal
   - [ ] Name ops manager + on-site host
   - [ ] Provide availability for dry-run
   - [ ] Confirm TM30 filing process (manual form vs. API integration)

4. **Scheduling:** Go-live date
   - [ ] Pick target date for public launch
   - [ ] Confirm 1-week lead time for infrastructure prep
   - [ ] Schedule 2-hour on-call window for day-one monitoring

**Contact:** pavel@ignatevestate.com with any of the above decisions.
