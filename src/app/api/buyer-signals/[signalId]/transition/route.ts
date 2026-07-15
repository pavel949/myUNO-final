import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { BuyerSignalStatus } from '@prisma/client';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { transitionBuyerSignal } from '@/modules/analytics';

export async function POST(
  req: NextRequest,
  { params }: { params: { signalId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.identityId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await prisma.identity.findUnique({
      where: { id: user.identityId },
      select: { isAdmin: true },
    });

    if (!isAdmin?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { newStatus, notes } = await req.json();

    if (!Object.values(BuyerSignalStatus).includes(newStatus)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }

    const signal = await prisma.buyerSignal.findUnique({
      where: { id: params.signalId },
    });

    if (!signal) {
      return NextResponse.json(
        { error: 'Signal not found' },
        { status: 404 }
      );
    }

    const updated = await transitionBuyerSignal(
      prisma,
      params.signalId,
      newStatus,
      user.identityId,
      notes
    );

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[Signal transition] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
