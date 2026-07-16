import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { approveProvider } from '@/modules/services';
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

    await approveProvider(prisma, params.id, user.identityId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Provider approval error:', error);
    return NextResponse.json(
      { error: 'Failed to approve provider' },
      { status: 500 }
    );
  }
}
