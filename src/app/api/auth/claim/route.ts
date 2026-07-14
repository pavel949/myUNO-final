import { people } from '@/modules/core';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json(
        { error: 'token and password are required' },
        { status: 400 }
      );
    }

    const tokenHash = hashToken(token);

    // Claim the identity
    const identity = await people.claimIdentity(prisma, {
      tokenHash,
      password,
    });

    return NextResponse.json({
      success: true,
      identity: {
        id: identity.id,
        email: identity.email,
        firstName: identity.firstName,
        lastName: identity.lastName,
        status: identity.status,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to claim identity' },
      { status: 400 }
    );
  }
}
