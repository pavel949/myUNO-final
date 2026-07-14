import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { can } from '@/modules/core';
import { people } from '@/modules/core';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const identity = await prisma.identity.findUnique({
    where: { id: user.identityId },
  });
  if (!identity) return NextResponse.json({ error: 'Identity not found' }, { status: 404 });

  // Check admin permission
  if (
    !can({
      identity,
      action: 'people:edit',
      resource: { resourceType: 'platform' },
    })
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { identityId, ttlMinutes } = body;

    if (!identityId) {
      return NextResponse.json(
        { error: 'identityId is required' },
        { status: 400 }
      );
    }

    const token = await people.generateClaimLink(prisma, {
      identityId,
      ttlMinutes,
    });

    // Build the claim URL (in production this would be the full public URL)
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const claimUrl = `${baseUrl}/auth/claim?token=${token}`;

    return NextResponse.json({ success: true, token, claimUrl });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to generate claim link' },
      { status: 400 }
    );
  }
}
