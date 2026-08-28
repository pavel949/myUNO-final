# myUNO Deployment Checklist

## STATUS: READY FOR DEPLOYMENT

All code is committed. Follow this checklist to deploy to Vercel.

---

## 1. Vercel Environment Variables

Go to: **Vercel Dashboard → myUNO Project → Settings → Environment Variables**

Add/verify these variables exist with the exact values shown:

### Database Connection
- **Name:** `DATABASE_URL`
- **Value:** `postgresql://postgres.burcnghheyzbzffzgmjz:V%253AGni4CSUN%3FV%5E@aws-1-ap-south-1.pooler.supabase.com:5432/postgres`
- **Environments:** Production, Preview, Development
- **⚠️ CRITICAL:** Must use `.pooler.supabase.com` NOT `.supabase.co`

### Email Service (NEW - Add this)
- **Name:** `RESEND_API_KEY`
- **Value:** *(See Vercel Settings — already provided via shared secret)*
- **Environments:** Production, Preview, Development
- **⚠️ NOTE:** Do NOT commit the actual API key to git. Set this directly in Vercel UI.

### Email From Address
- **Name:** `EMAIL_FROM`
- **Value:** `onboarding@resend.dev`
- **Environments:** Production, Preview, Development

### Authentication
- **Name:** `NEXTAUTH_SECRET`
- **Value:** (keep existing)
- **Environments:** Production, Preview, Development

### Encryption
- **Name:** `ENCRYPTION_KEY`
- **Value:** (keep existing)
- **Environments:** Production, Preview, Development

### Node Environment
- **Name:** `NODE_ENV`
- **Value:** `development`
- **Environments:** Production, Preview, Development

---

## 2. Trigger Deployment

Option A: **Redeploy the last commit**
- Go to **Vercel Dashboard → myUNO Project → Deployments**
- Find the latest deployment
- Click **Redeploy** button

Option B: **Push a new commit**
```bash
git push origin main
```

Vercel will automatically trigger a new deployment.

---

## 3. Wait for Deployment

Watch the deployment progress in Vercel:
- Build should complete in 1-2 minutes
- Function logs will show if there are any errors

---

## 4. Test Registration Flow

Once "Ready" appears in Vercel:

1. Open https://myuno-final.vercel.app/register
2. Fill in registration form:
   - **First Name:** Test
   - **Last Name:** User
   - **Email:** test@example.com
   - **Password:** TestPassword123 (must have uppercase, lowercase, number, 8+ chars)
3. Click **Register**
4. Check email for verification link (should arrive via Resend)
5. Click the link to verify
6. Navigate to /login
7. Log in with test@example.com and password

---

## 5. Admin Login Test

1. Go to /forgot-password
2. Enter pavel@ignatevestate.com
3. Check email for reset link
4. Click link and set new password (e.g., AdminPassword123)
5. Go to /login
6. Log in with pavel@ignatevestate.com
7. Verify admin dashboard loads

---

## Troubleshooting

### "Registration failed" error
- Check Vercel logs: **Deployments → Latest → Functions**
- Look for error details in the console output
- Verify password meets requirements: 8+ chars, uppercase, lowercase, number
- Verify email is not already in database

### Email not arriving
- Verify `RESEND_API_KEY` is set in Vercel environment variables
- Check Vercel function logs for `[EMAIL SENT]` or `[EMAIL - DEV/MISSING_KEY]` messages
- If seeing "[EMAIL - DEV/MISSING_KEY]", the RESEND_API_KEY is not set in Vercel
- Contact admin for the correct Resend API key value

### Database connection errors
- Verify `DATABASE_URL` uses `.pooler.supabase.com` (not `.supabase.co`)
- Check Supabase dashboard to ensure database is running
- Verify the credentials in the connection string are correct

### Build fails
- Check Vercel build logs for specific errors
- Common causes: Content gate blocking (should be fixed now), missing environment variables
- Review `.github/workflows/ci.yml` for build steps

---

## Next Steps (After Admin Login Works)

1. Seed three premium projects: `npm run seed:three-projects`
2. Run end-to-end testing through booking flow
3. Verify owner statements and admin dashboards
4. Test all roles (admin, owner, staff, guest)
5. Verify email notifications work for key events

---

## Critical Notes

- **RESEND_API_KEY:** Do NOT commit this to git. Only set in Vercel environment.
- **DATABASE_URL:** Must use pooler connection for Vercel. Direct connection will timeout.
- **Password Requirements:** Minimum 8 characters, must include uppercase, lowercase, and number
- **Email Verification:** Emails are sent via Resend API. Without RESEND_API_KEY, registration succeeds but emails don't arrive.

---

Generated: 2026-08-28
