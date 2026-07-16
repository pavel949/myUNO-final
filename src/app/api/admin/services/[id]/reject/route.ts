import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { rejectService } from '@/modules/services';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { reason } = await req.json();

    await rejectService(prisma, params.id, user.identityId, reason);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Service rejection error:', error);
    return NextResponse.json(
      { error: 'Failed to reject service' },
      { status: 500 }
    );
  }
}
