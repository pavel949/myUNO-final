import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { registerPurchaseInterest } from '@/modules/analytics';

/**
 * "I am thinking about buying." (doc 07 F-BUY.)
 *
 * Open to anyone signed in, deliberately — the whole point of the buyer journey
 * is that a guest becomes a prospect on the same identity, so requiring the
 * `buyer` role first would mean nobody could ever ask. The role is what an
 * admin grants *after* the conversation, not a gate in front of it.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  try {
    const result = await registerPurchaseInterest(prisma, {
      identityId: user.identityId,
      unitId: typeof body.unitId === 'string' ? body.unitId : null,
      message: typeof body.message === 'string' ? body.message : '',
    });

    return NextResponse.json({ threadId: result.threadId }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
