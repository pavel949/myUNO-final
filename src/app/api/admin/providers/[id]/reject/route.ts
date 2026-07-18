import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { rejectProvider } from '@/modules/services';
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

    await rejectProvider(prisma, params.id, user.identityId, reason);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Provider rejection error:', error);
    return NextResponse.json(
      { error: 'Failed to reject provider' },
      { status: 500 }
    );
  }
}
