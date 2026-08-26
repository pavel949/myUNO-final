# Authentication Setup Guide

This document covers password recovery email configuration, Google OAuth implementation, and evaluates Supabase auth options for myUNO.

## Current Status

**Password Recovery Issue (CRITICAL):** Users report not receiving password reset emails because `RESEND_API_KEY` is not configured in the environment. The system currently falls back to console logging instead of sending actual emails.

**Schema Support:** The database schema is already prepared for OAuth with:
- `AuthAccount` model (stores provider credentials)
- `AuthProvider` enum (supports `google` and `apple`)
- `Identity.authAccounts` relation

## Part 1: Password Recovery Email Fix

### Problem
Without `RESEND_API_KEY` set in `.env`, password reset emails are not sent. The system logs them to console instead (dev fallback).

### Solution
Set these environment variables in your hosting platform (Vercel, etc.):

```bash
# Required for password reset emails
RESEND_API_KEY=re_xxxx_xxxxxxxxxxxxxxxx
EMAIL_FROM=noreply@yourdomain.com
```

### Steps to Enable

1. **Get a Resend API Key:**
   - Go to https://resend.com/dashboard
   - Click "API Keys" → "Create API Key"
   - Copy the key (starts with `re_`)

2. **Verify your sender domain:**
   - In Resend dashboard, go to "Domains"
   - Add your domain (e.g., `myuno.local`, `app.myuno.com`)
   - Complete the DNS verification (varies by DNS provider)
   - Use the verified domain in `EMAIL_FROM` (e.g., `noreply@app.myuno.com`)

3. **Set environment variables:**
   - **Local:** Copy `RESEND_API_KEY` and `EMAIL_FROM` to your `.env` file
   - **Vercel:** Go to Project Settings → Environment Variables → add both keys
   - **Other hosts:** Use your platform's secrets/env management

4. **Test the flow:**
   ```bash
   # 1. Start the dev server
   npm run dev

   # 2. Go to http://localhost:3000/auth/forgot-password
   # 3. Enter an email address with an account
   # 4. Check your email inbox (real email now, not console log)
   ```

### Email Flow

1. User clicks "Forgot password" → enters email
2. `POST /api/auth/forgot-password` → `requestPasswordReset()`
3. Token generated, stored as hash in DB
4. `sendEmail()` called:
   - If `RESEND_API_KEY` set → posts to Resend API → actual email sent
   - If not set → logs to console (dev fallback, no real email)
5. User receives email with reset link (24 hours valid)
6. User clicks link → `/auth/reset-password?token=...`
7. `POST /api/auth/reset-password` → `confirmPasswordReset()`
8. Token validated, password hashed with bcrypt (cost 12), token marked consumed

**Files involved:**
- `src/app/api/auth/forgot-password/route.ts` (rate-limited, always returns 200)
- `src/app/api/auth/reset-password/route.ts` (validates token, updates password)
- `src/modules/auth/auth.ts` (core `requestPasswordReset`, `confirmPasswordReset`)
- `src/modules/auth/email.ts` (sends via Resend or console)

---

## Part 2: Google OAuth Implementation

### Schema is Ready
The database already supports OAuth:
```prisma
model AuthAccount {
  id                String       @id @default(uuid())
  identityId        String
  provider          AuthProvider  // enum: google, apple
  providerAccountId String       // Google's user ID

  identity Identity @relation(fields: [identityId], references: [id])
  @@unique([provider, providerAccountId])
}
```

### Implementation Steps

#### 1. Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or use existing)
3. Enable **Google+ API**
4. Create **OAuth 2.0 Client ID** (Application type: Web)
5. Add authorized redirect URIs:
   ```
   http://localhost:3000/api/auth/callback/google
   https://yourdomain.com/api/auth/callback/google
   ```
6. Copy the **Client ID** and **Client Secret**

#### 2. Add Route Handler for Google Callback

Create `src/app/api/auth/callback/google/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSessionToken, sessionCookieOptions } from '@/modules/auth';
import crypto from 'crypto';

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  expires_in: number;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  given_name: string;
  family_name: string;
  picture?: string;
}

async function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch Google user info');
  }
  return response.json();
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code) {
    return NextResponse.redirect('/auth/login?error=no_code');
  }

  try {
    // Exchange code for token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/callback/google`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Google token exchange failed:', error);
      return NextResponse.redirect('/auth/login?error=token_exchange_failed');
    }

    const tokenData: GoogleTokenResponse = await tokenResponse.json();

    // Get user info
    const googleUser = await getGoogleUserInfo(tokenData.access_token);

    // Find or create identity + auth account
    let identity = await prisma.identity.findUnique({
      where: { email: googleUser.email },
    });

    if (!identity) {
      // Create new identity from Google user info
      identity = await prisma.identity.create({
        data: {
          email: googleUser.email,
          firstName: googleUser.given_name || googleUser.name.split(' ')[0],
          lastName: googleUser.family_name || googleUser.name.split(' ').slice(1).join(' ') || '',
          emailVerifiedAt: new Date(), // Google verifies emails
          status: 'active',
        },
      });
    }

    // Upsert auth account
    await prisma.authAccount.upsert({
      where: { provider_providerAccountId: { provider: 'google', providerAccountId: googleUser.id } },
      update: {},
      create: {
        identityId: identity.id,
        provider: 'google',
        providerAccountId: googleUser.id,
      },
    });

    // Create session
    const sessionToken = await createSessionToken(identity.id);
    const response = NextResponse.redirect('/app');
    response.cookies.set(sessionCookieOptions('SESSION_ID'), sessionToken);

    return response;
  } catch (error) {
    console.error('Google auth callback error:', error);
    return NextResponse.redirect('/auth/login?error=auth_failed');
  }
}
```

#### 3. Add Google Login Button

Update `src/app/(public)/auth/login/page.tsx` to include:

```typescript
'use client';

import { useState } from 'react';

export function GoogleLoginButton() {
  const handleGoogleLogin = () => {
    const scope = encodeURIComponent('openid email profile');
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const redirectUri = encodeURIComponent(`${window.location.origin}/api/auth/callback/google`);
    const state = Math.random().toString(36).substring(7);
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}` +
      `&redirect_uri=${redirectUri}` +
      `&response_type=code` +
      `&scope=${scope}` +
      `&state=${state}`;
    
    window.location.href = authUrl;
  };

  return (
    <button
      onClick={handleGoogleLogin}
      className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 text-center font-medium text-gray-700 hover:bg-gray-50"
    >
      Sign in with Google
    </button>
  );
}
```

#### 4. Environment Variables

Add to `.env`:
```bash
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxx
```

And to Vercel Environment Variables.

#### 5. Content Keys for Google Auth

Add to your content_key table (for i18n support):
```sql
INSERT INTO content_key (namespace, key, needs_review, translations)
VALUES 
  ('auth', 'google_login_button', false, '{"en": "Sign in with Google", "ru": "Войти через Google", "th": "เข้าสู่ระบบด้วย Google"}'),
  ('auth', 'google_login_error', false, '{"en": "Google sign-in failed. Please try again.", "ru": "Вход через Google не удался. Пожалуйста, попробуйте снова.", "th": "การเข้าสู่ระบบด้วย Google ล้มเหลว โปรดลองอีกครั้ง"}');
```

---

## Part 3: Supabase Auth Evaluation

### Overview
Supabase Auth is a PostgreSQL-native auth solution. myUNO already uses Supabase for the database (PostgreSQL), so Supabase Auth is a tight fit.

### Supabase Auth Options (Free Tier)

| Feature | Free Tier | Limit | Notes |
|---------|-----------|-------|-------|
| **Email/Password** | ✅ | Unlimited | Built-in, works out of the box |
| **Magic Links** | ✅ | Unlimited | Email-based passwordless |
| **OAuth Providers** | ✅ | Google, GitHub, Discord, etc. | 10+ providers pre-built |
| **SMS** | ❌ | — | Paid feature |
| **SAML** | ❌ | — | Enterprise only |
| **MFA** | ❌ | — | Coming soon |
| **User Quotas** | — | 50K MAU (Monthly Active Users) | Upgrades at scale |

### How Supabase Auth Works

1. **Native to PostgreSQL:** Auth state stored in your database
2. **JWT Sessions:** Stateless, signed tokens (no session table needed)
3. **RLS (Row-Level Security):** Fine-grain access control at DB level
4. **Webhook Events:** Trigger on signup/signin/logout for custom logic

### Comparison: Current vs. Supabase

#### Current Stack (Status Quo)
- ✅ Full control, auditable
- ✅ Custom token generation, session storage
- ✅ Works with any email provider (Resend, SendGrid, etc.)
- ❌ Password reset, email verification, OAuth all built from scratch
- ❌ No SMS/TOTP without custom code

#### Supabase Auth
- ✅ Battle-tested, handles edge cases (token refresh, logout timing, CSRF)
- ✅ Pre-built OAuth for 10+ providers (Google, Apple, GitHub, etc.)
- ✅ Email magic links + password reset built-in
- ✅ Webhook integration for custom flows (lifecycle, notifications)
- ❌ Migrating existing users requires careful import
- ❌ Lock-in: Tightly coupled to Supabase projects

### Migration Path (If Chosen)

**Phase 1: Hybrid (3–4 weeks)**
- Keep current auth, add Supabase OAuth alongside
- New users can sign up with Google (Supabase Auth)
- Existing users continue with current credentials
- Both auth systems coexist, gradual migration

**Phase 2: Full Cutover (2–3 weeks)**
- Offer password reset via Supabase
- Migrate existing identities to Supabase Auth
- Test all flows in staging
- Deprecate old auth, direct users to Supabase paths

**Phase 3: Cleanup (1 week)**
- Remove old password storage, token tables
- Simplify session management
- Archive old code paths

### Recommendation for myUNO

**Current approach is BETTER for myUNO because:**

1. **Russian-speaking users expect transparency** — Supabase is SaaS-hosted in Vercel's zones (US-based); myUNO data is in Supabase DB (Thailand), but auth goes through US auth servers. PDPA/AMLO concern for user data.

2. **Full audit trail required** — myUNO needs to log every auth event (doc 12 security/privacy). Custom auth allows internal logging; Supabase webhooks add latency/complexity.

3. **Custom lifecycle management** — Linking auth to `identity.status` (active/invited/blocked/merged) requires hooks that fire synchronously before the user is created. Supabase webhooks are async.

4. **Email already configured** — You have Resend (free tier). Supabase Auth uses Resend for transactional emails anyway, but adds extra dependency.

5. **Cost:** Current stack is cheaper at scale (free for email + auth code you own). Supabase Auth starts at $25/mo for advanced features.

### IF You Choose Supabase Auth Anyway

Use the **hybrid approach** (Supabase Auth for new Google logins, current stack for password):

1. Deploy Supabase Auth alongside current auth
2. Add Google OAuth via Supabase (official provider, pre-built)
3. Keep password reset on Resend (proven, auditable)
4. Store `AuthAccount` as-is for OAuth credentials
5. Migrate users gradually when they change password

**Cost:** Supabase free tier covers 50K MAU; myUNO will scale beyond free tier in Q2–Q3 2027 (projection: 8K–15K users in first year). Plan for `$25–100/mo` growth.

---

## Summary of Actions

### Immediate (This Session)
- [ ] Set `RESEND_API_KEY` and `EMAIL_FROM` in Vercel (test password recovery)
- [ ] Implement Google OAuth route handler + button
- [ ] Test Google login flow end-to-end

### Phase 1 (Next Session)
- [ ] Add content keys for Google button
- [ ] Test OAuth with existing identities (link to same user)
- [ ] Add logout route handler

### Phase 2 (Future, Optional)
- [ ] Evaluate Supabase Auth further (set up test project)
- [ ] If adopting Supabase: Plan hybrid migration strategy
- [ ] Implement Apple OAuth (same pattern as Google)

---

## Quick Reference: File Locations

| Task | File |
|------|------|
| Password reset request | `src/app/api/auth/forgot-password/route.ts` |
| Password reset confirm | `src/app/api/auth/reset-password/route.ts` |
| Email sending | `src/modules/auth/email.ts` |
| Core auth logic | `src/modules/auth/auth.ts` |
| Auth types | `src/modules/auth/types.ts` |
| Session management | `src/modules/auth/session.ts` |
| DB Schema | `prisma/schema.prisma` (AuthProvider enum, AuthAccount model) |

---

## Testing Commands

```bash
# Test password reset in dev
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com"}'

# Test reset password confirm
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token":"<token>","newPassword":"NewPass123"}'
```

---

**Maintained by:** Platform Team | **Last Updated:** 2026-08-26
