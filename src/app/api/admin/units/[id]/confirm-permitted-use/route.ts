import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { can } from '@/modules/core';
import { confirmPermittedUse } from '@/modules/projects';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const identity = await prisma.identity.findUnique({
    where: { id: user.identityId },
  });
  if (!identity) return NextResponse.json({ error: 'Identity not found' }, { status: 404 });

  // Check admin permission for compliance actions
  if (
    !can({
      identity,
      action: 'compliance:confirm_permitted_use',
      resource: { resourceType: 'platform' },
    })
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const unit = await confirmPermittedUse(params.id, user.identityId);
    return NextResponse.json(unit);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to confirm permitted use' },
      { status: 400 }
    );
  }
}
