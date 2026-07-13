import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const tokenHash = hashToken(params.token);

    // Find the token
    const token = await prisma.oneTimeToken.findFirst({
      where: { tokenHash },
      include: { identity: true },
    });

    if (!token) {
      return NextResponse.json(
        { error: 'Invalid or expired claim link' },
        { status: 404 }
      );
    }

    if (token.consumedAt) {
      return NextResponse.json(
        { error: 'This claim link has already been used' },
        { status: 410 }
      );
    }

    if (new Date() > token.expiresAt) {
      return NextResponse.json(
        { error: 'This claim link has expired' },
        { status: 410 }
      );
    }

    if (token.identity.status !== 'invited') {
      return NextResponse.json(
        { error: 'Identity is not in invited status' },
        { status: 400 }
      );
    }

    // Return identity info for the claim page to show what they're claiming
    return NextResponse.json({
      valid: true,
      identity: {
        id: token.identity.id,
        email: token.identity.email,
        firstName: token.identity.firstName,
        lastName: token.identity.lastName,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to validate claim link' },
      { status: 400 }
    );
  }
}
