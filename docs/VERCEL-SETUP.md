# Vercel Deployment Setup Guide

This document outlines the complete Vercel setup for myUNO platform deployment.

## Current Status

✅ **Code Ready**
- Build succeeds locally with npm run build
- All environment configuration documented in vercel.json
- Seed scripts prepared for database population
- Error resilience improved for build-time database connectivity

⚠️ **Pending Actions**
- Verify DATABASE_URL in Vercel uses the session pooler (not direct connection)
- Redeploy to test with improved error handling
- Seed three projects once deployment is live

## Critical: Database Connection URL Format

**The most common cause of Vercel build failures is using the wrong connection string.**

### ✅ CORRECT: Session Pooler (Use This)
```
postgresql://user:password@db.XXXXXXX.pooler.supabase.com:5432/postgres
                                  ^^^^^^
                            .pooler.supabase.com
```
- Port: 5432
- Best for: Vercel, serverless, short connections
- Connection pooling: Enabled
- Cost: Included in Supabase free tier

### ❌ WRONG: Direct Connection (Do Not Use)
```
postgresql://user:password@db.XXXXXXX.supabase.co:5432/postgres
                                  ^^
                           (no .pooler)
```
- Vercel build environment cannot reach this from their infrastructure
- Will timeout: "Can't reach database server"
- Should only be used for local development with persistent connections

## Vercel Environment Variables

Set these in Vercel Project Settings → Environment Variables:

### Required (Production)
```bash
# Do NOT set NODE_ENV. Next.js sets production for `next build`.
# NODE_ENV=development on Vercel breaks prerender (React dual-instance).
DATABASE_URL=postgresql://postgres.<ref>:...@aws-1-ap-south-1.pooler.supabase.com:5432/postgres
SESSION_SECRET=<openssl rand -base64 32>
ENCRYPTION_KEY=<openssl rand -hex 32>
NEXTAUTH_SECRET=<same as SESSION_SECRET>
NEXTAUTH_URL=https://my-uno-final.vercel.app
NEXT_PUBLIC_APP_URL=https://my-uno-final.vercel.app
CRON_SECRET=<openssl rand -hex 24>
```

**Git:** Production Branch must be `main`. The live hostname is
`my-uno-final.vercel.app` (hyphens). `myuno-final.vercel.app` is not a
deployment.

**Supabase:** Link via Vercel Marketplace / Supabase → Integrations → Vercel,
or paste the session-pooler URL yourself. Either way the hostname must be
`*.pooler.supabase.com` port 5432. See `DEPLOYMENT-CHECKLIST.md` §0.

### Optional
```bash
RESEND_API_KEY=<your Resend API key>
EMAIL_FROM=onboarding@resend.dev  # or your verified domain
CONTENT_REVIEW_GATE_ENABLED=true
```

## Build Process (Improved)

The build now runs in this order:

1. **Repair failed migrations** (`npm run build` → `scripts/repair-failed-migrations.mjs`)
   - Idempotent: Safe to run multiple times
   - Fixes any broken migration states

2. **Generate Prisma Client** (`prisma generate`)
   - Does NOT connect to database
   - Generates TypeScript types from schema.prisma

3. **Check content review gate** (`scripts/check-content-review-gate.mjs`)
   - **NEW**: Pre-checks database connectivity
   - Blocks production deployments only if database IS reachable AND content is pending review
   - Allows development builds to proceed if database is unreachable
   - Clear error messages for troubleshooting

4. **Build Next.js** (`next build`)
   - Standard Next.js build process
   - No database connectivity required

## Deployment Procedure

### 1. Verify Database Connection
```bash
# From your terminal, test the pooler connection:
psql "postgresql://user:password@db.XXXXXXX.pooler.supabase.com:5432/postgres"
# Should connect successfully

# Test direct connection (for reference):
psql "postgresql://user:password@db.XXXXXXX.supabase.co:5432/postgres"
# Will likely timeout or be rejected from Vercel's build environment
```

### 2. Update Vercel Settings

1. Go to https://vercel.com/pavel949s-projects/my-uno-final
2. Settings → Git → Production Branch = `main`
3. Settings → Environment Variables
4. Ensure `DATABASE_URL` uses the **.pooler.supabase.com** session pooler (port 5432)
5. Do not set `NODE_ENV`
6. Save and redeploy

### 3. Redeploy
- Option A: Click "Redeploy" button in Vercel dashboard
- Option B: Merge to `main`
- Option C: Run via CLI: `vercel --prod`

### 4. Verify Deployment
```bash
curl -sS https://my-uno-final.vercel.app/api/health
# Test password reset email
curl -X POST https://my-uno-final.vercel.app/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"pavel@ignatevestate.com"}'

# Should receive password reset email (or see console logs if RESEND_API_KEY not set)
```

## Next Steps: Seeding Data

Once Vercel deployment succeeds, seed the three projects:

### Local Seeding (for testing)
```bash
# Ensure DATABASE_URL points to your local/test database
npm run seed:three-projects
```

### Production Seeding
```bash
# Use the Supabase connection string with PROPER POOLER format
DATABASE_URL="postgresql://...@db.XXXXXXX.pooler.supabase.com:5432/postgres" \
  npx ts-node scripts/seed-three-projects.ts
```

### What Gets Seeded
1. **The Title Legendary** - 3 luxury villas (฿40k-75k/night)
2. **Layantara Villa Resort** - 4 units (2 villas + 2 condos, ฿8.5k-35k/night)
3. **The Title Heritage** - 3 boutique units (1 villa + 2 rooms, ฿6k-28k/night)

Total: 10 units across 3 projects with:
- Owner roles assigned (pavel@ignatevestate.com)
- Staff roles assigned (ops@ignatevestate.com)
- Unit engagements configured
- Seasonal pricing (Dec-Mar +30%)

## Troubleshooting

### Build Fails: "Can't reach database server"
1. Check DATABASE_URL ends with `.pooler.supabase.com` (not `.supabase.co`)
2. Verify credentials are correct (including URL-encoded special characters)
3. Test connection from terminal: `psql "..."`
4. Set `CONTENT_REVIEW_GATE_ENABLED=false` temporarily to skip gate and isolate the issue

### Password Reset Not Sending
1. Verify RESEND_API_KEY is set in Vercel
2. Check EMAIL_FROM is set to `onboarding@resend.dev` (test domain) or a verified custom domain
3. Test locally: `npm run dev` and try password reset flow
4. Check Resend dashboard for failed deliveries

### Admin Login Failing
1. Verify the Identity record exists in Supabase:
   ```sql
   SELECT id, email, is_admin FROM identity WHERE email = 'pavel@ignatevestate.com';
   ```
2. Use "Forgot your password?" to reset via email (now working with Resend)
3. Set a new password via the reset link

### Deployment Takes Too Long
- First deployment: 2-3 minutes (npm install, Prisma generate, build)
- Subsequent: 30-60 seconds if dependencies cached
- If timing out: Check Vercel Logs tab for stuck processes

## Maintenance

### Monthly
- Monitor Vercel build durations (should stay under 1 minute)
- Check Supabase connection metrics
- Review any failed content-review-gate deployments

### Before Major Deployment
1. Run local build: `npm run build`
2. Run tests: `npm test`
3. Run lint: `npm run lint`
4. Verify no content keys have `needs_review=true`

## Questions?

See:
- `.env.example` - All environment variables explained
- `vercel.json` - Build configuration
- `scripts/seed-three-projects.ts` - Seeding implementation
- `docs/` - Technical architecture and specifications
