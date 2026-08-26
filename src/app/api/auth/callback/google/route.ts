import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  createSessionToken,
  sessionCookieOptions,
  SESSION_COOKIE_NAME,
} from '@/modules/auth';

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
    throw new Error(`Failed to fetch Google user info: ${response.status}`);
  }

  return response.json();
}

/**
 * Google OAuth 2.0 callback handler.
 * Exchanges authorization code for tokens, retrieves user info, and creates/links identity.
 *
 * Flow:
 * 1. User clicks "Sign in with Google"
 * 2. Redirected to Google consent screen
 * 3. Google redirects back to /api/auth/callback/google?code=...&state=...
 * 4. This handler exchanges code for access token
 * 5. Fetches user info from Google
 * 6. Finds or creates identity with that email
 * 7. Creates or updates AuthAccount linking Google ID to identity
 * 8. Creates session cookie and redirects to /app
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  // Handle user rejection or errors from Google
  if (error) {
    const errorDesc = searchParams.get('error_description') || error;
    console.warn('Google OAuth error:', errorDesc);
    return NextResponse.redirect(`/auth/login?error=${encodeURIComponent(errorDesc)}`);
  }

  if (!code) {
    return NextResponse.redirect('/auth/login?error=missing_authorization_code');
  }

  try {
    // Step 1: Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/callback/google`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Google token exchange failed:', error);
      return NextResponse.redirect(
        '/auth/login?error=' + encodeURIComponent('Token exchange failed. Please try again.')
      );
    }

    const tokenData: GoogleTokenResponse = await tokenResponse.json();

    // Step 2: Get user info from Google
    const googleUser = await getGoogleUserInfo(tokenData.access_token);

    if (!googleUser.email) {
      console.error('Google user has no email:', googleUser);
      return NextResponse.redirect(
        '/auth/login?error=' + encodeURIComponent('Google account has no email. Please use a different account.')
      );
    }

    // Step 3: Find or create identity
    let identity = await prisma.identity.findUnique({
      where: { email: googleUser.email },
    });

    if (!identity) {
      // Create new identity from Google user info
      identity = await prisma.identity.create({
        data: {
          email: googleUser.email,
          firstName: googleUser.given_name || googleUser.name?.split(' ')[0] || 'User',
          lastName:
            googleUser.family_name ||
            googleUser.name?.split(' ').slice(1).join(' ') ||
            '',
          emailVerifiedAt: new Date(), // Google verifies emails before providing them
          status: 'active',
          preferredLocale: 'en', // Could derive from Google user locale if available
        },
      });
    } else if (identity.status === 'blocked') {
      return NextResponse.redirect(
        '/auth/login?error=' + encodeURIComponent('This account has been blocked.')
      );
    }

    // Step 4: Upsert auth account (link Google ID to identity)
    await prisma.authAccount.upsert({
      where: {
        provider_providerAccountId: {
          provider: 'google',
          providerAccountId: googleUser.id,
        },
      },
      update: {}, // No-op if already exists
      create: {
        identityId: identity.id,
        provider: 'google',
        providerAccountId: googleUser.id,
      },
    });

    // Step 5: Create session
    const sessionToken = await createSessionToken(identity.id);

    // Step 6: Redirect to app with session cookie
    const response = NextResponse.redirect(new URL('/app', request.nextUrl.origin));
    response.cookies.set(
      SESSION_COOKIE_NAME,
      sessionToken,
      sessionCookieOptions()
    );

    return response;
  } catch (error) {
    console.error('Google auth callback error:', error);
    return NextResponse.redirect(
      '/auth/login?error=' + encodeURIComponent('Authentication failed. Please try again.')
    );
  }
}
