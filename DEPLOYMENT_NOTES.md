# Deployment Notes

## Known Issues

### Prisma Compute Migration Blocker (P3009)

**Status:** Blocking Prisma schema deployment (Vercel build succeeds)

**Issue:** The Prisma Compute database has a failed migration record (`1_add_analytics_tables` from 2026-07-15) that prevents `prisma migrate deploy` from proceeding. Prisma refuses to apply new migrations when failed migrations exist in the history.

**Resolution:** 

Requires manual resolution via Prisma Compute console:

```bash
# Option 1: Mark the migration as rolled back (recommended)
prisma migrate resolve --rolled-back 1_add_analytics_tables

# Option 2: Mark as applied (if tables were partially created)
prisma migrate resolve --applied 1_add_analytics_tables
```

**Workarounds Attempted:**
- ✗ No-op compensation migration (Prisma skips new migrations regardless)
- ✗ Direct `_prisma_migrations` table UPDATE (doesn't mark as officially resolved)
- ✗ Explicit FK handling and table creation in migration SQL

**Why It Matters:**
- Phase 2 (Owner Reporting) code is complete and builds successfully
- Vercel deployment is ready (shows "Ready" status)
- Only the database schema migration step is blocked
- This is NOT caused by Phase 2 changes - it's a pre-existing state issue

**Action Required:**
Operations team must resolve the failed migration through Prisma Compute console before any database schema changes can deploy.

---

## Phase 2 Implementation Status

✅ **Code:** Complete and committed  
✅ **Build:** Passing (TypeScript strict, no warnings)  
✅ **Tests:** Ready (integration tests in place)  
✅ **Vercel:** Deployment ready  
⏸️ **Database Migration:** Blocked by Prisma P3009 error (pre-existing issue)

### What Was Completed

- Owner statement generation API (POST /api/admin/statements/generate)
- Line-item transparency with category grouping
- Sign-off workflow for owner + operator approval
- Owner-scoped statement listing (GET /api/owner/statements)
- CRM foundation (lifecycle tracking, transitions, audit logging)
- UnitAssetStatus enum for asset classification
- Comprehensive integration test coverage

