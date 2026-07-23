# Local Setup & Deployment Steps

**Status:** Remote environment prepared. Schema application must be done locally.

## Why?

The remote Claude Code environment has network policies that block raw TCP connections to Supabase (port 5432). The schema must be applied from your Windows machine where Supabase is accessible.

---

## Step 1: Copy .env to Your Local Machine

The .env file in this repository has been updated with Supabase credentials. Since `.env` is in `.gitignore` (for security), you need to manually copy it:

```bash
# On Windows (PowerShell):
# Navigate to your local myUNO-final folder and copy from git:
# You can copy the values from the remote .env or from this summary:

# Create .env locally with these values:
DATABASE_URL=postgresql://postgres:dUi0YrbssaTOy06W@db.burcnghheyzbzffzgmjz.supabase.co:5432/postgres
DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5432/myuno_test
NEXTAUTH_SECRET=a667a1ece20e86b65665ff9300f40f43232d14db947801599ca130c19e04b595
NEXTAUTH_URL=http://localhost:3000
ENCRYPTION_KEY=c119da0672967ae76c54b1cc82265a4fbeeea97a23d72442014e089beec77567
SESSION_SECRET=0SLnH9QUhWhDhO9i855yDviBHy8cCkzGV6ql609vtPQ=
CRON_SECRET=117598ae99568389403fedd63116a977ca07f1f6976a83473c82224507ff0651
```

### Option A: Manual Creation
```powershell
# In PowerShell, navigate to your myUNO-final folder:
cd C:\Users\pavel\OneDrive\Apps\myUNO-final\myUNO-final

# Copy .env.example to .env (if it doesn't exist):
copy .env.example .env

# Edit .env with the Supabase credentials above
# Use Notepad or VS Code:
code .env
```

### Option B: Via Git (If .env is in Remote)
```powershell
# If you just pulled from the remote:
# The .env won't be there because it's in .gitignore
# Copy the values manually from SETUP_LOCAL_DEPLOYMENT.md or the remote repo
```

---

## Step 2: Install Dependencies (If Not Done)

```powershell
npm install
```

---

## Step 3: Apply Schema to Supabase (CRITICAL)

This applies all pending Prisma migrations to the Supabase database:

```powershell
npx prisma db push
```

**Expected output:**
```
Prisma schema loaded
✔ Your database is now in sync with your schema. Done in 2.34s
```

If you get any errors:
- Verify DATABASE_URL points to the correct Supabase project
- Ensure the password in the connection string is correct
- Check that the Supabase project is active and accessible

---

## Step 4: Verify Schema Applied

```powershell
npx prisma studio
```

This opens Prisma Studio in your browser, showing all tables and data. Verify that all tables from `prisma/schema.prisma` are present (Project, Unit, Identity, RoleAssignment, etc.).

Close the studio after verifying (Ctrl+C).

---

## Step 5: Ensure Vercel Environment Variables Are Complete

Log in to Vercel (https://vercel.com/pavel949/myuno-final):

1. **Settings** → **Environment Variables**
2. Verify these are set for **Production** and **Preview**:

### Core Secrets (Already Added)
- `NEXTAUTH_SECRET` ✓
- `ENCRYPTION_KEY` ✓
- `SESSION_SECRET` ✓
- `CRON_SECRET` ✓

### Database Connection (Must Add If Missing)
- **Key:** `DATABASE_URL`
- **Value:** `postgresql://postgres:dUi0YrbssaTOy06W@db.burcnghheyzbzffzgmjz.supabase.co:5432/postgres`
- **Environments:** Production + Preview

### NextAuth Configuration (Must Match Local)
- **Key:** `NEXTAUTH_URL`
- **Value:** `https://myuno-final.vercel.app` (production) or leave for auto-detect
- **Environments:** Production

---

## Step 6: Redeploy on Vercel

1. Go to Vercel dashboard: https://vercel.com/pavel949/myuno-final
2. **Deployments** tab
3. Click the latest deployment → **Redeploy** button
   - OR push a git commit to trigger auto-redeploy

**Wait 2–3 minutes for the build to complete.**

---

## Step 7: Test End-to-End

1. Open https://myuno-final.vercel.app
2. Try to search or navigate to trigger database queries
3. Verify no "Something went wrong" errors
4. Check the Network tab in browser DevTools for successful API responses

---

## Step 8: Push Your Changes to Git

Once everything is working locally:

```powershell
git pull origin claude/project-repo-clarification-bavpp0
git add .
git commit -m "SB-3/SB-4: Local schema application via Supabase + Vercel redeploy"
git push -u origin claude/project-repo-clarification-bavpp0
```

---

## Troubleshooting

### "Can't reach database server" Error
- Network policy is blocking raw TCP (this is expected in remote environments)
- **Solution:** Must run `npx prisma db push` on Windows

### "Vercel deployment still says database error"
- DATABASE_URL not set in Vercel environment variables
- **Solution:** Add it to Vercel Settings → Environment Variables

### "npm install failed"
- Run `npm clean-install` to reset node_modules
- Verify Node.js version is 18+ (check with `node --version`)

### "Prisma Studio won't open"
- Make sure you're using a fresh PowerShell window
- Kill any existing Node processes: `Get-Process node | Stop-Process`

---

## Summary of What Happened

1. ✅ Remote setup: Generated fresh secrets (NEXTAUTH_SECRET, ENCRYPTION_KEY, SESSION_SECRET, CRON_SECRET)
2. ✅ Added secrets to Vercel environment
3. ✅ Updated remote .env with Supabase DATABASE_URL
4. ❌ Cannot apply schema from remote (network policy blocks TCP)
5. ⏳ **YOU** must: Run `npx prisma db push` locally to sync schema
6. ⏳ **YOU** must: Add DATABASE_URL to Vercel environment variables
7. ⏳ **YOU** must: Trigger Vercel redeploy
8. ✅ **THEN** we can: Verify end-to-end and proceed to SB-4 (final testing)

---

## Next Steps After Local Deployment

Once you've completed the above:

1. Let me know the result of `npx prisma db push`
2. Verify Vercel deployment is green
3. Test the app at https://myuno-final.vercel.app
4. We proceed to SB-4: full integration verification and PR creation

