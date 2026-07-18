import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { approveService } from '@/modules/services';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await approveService(prisma, params.id, user.identityId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Service approval error:', error);
    return NextResponse.json(
      { error: 'Failed to approve service' },
      { status: 500 }
    );
  }
}
