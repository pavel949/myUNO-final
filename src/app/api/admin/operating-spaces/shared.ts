import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { requireGovernanceFounder } from '@/modules/ops/operating-space-governance.service';
import { OperatingAccessError } from '@/modules/ops/operating-space-access.service';

export async function governanceActor() {
  const user = await getCurrentUser();
  if (!user) throw new OperatingAccessError('Sign in required', 401);
  await requireGovernanceFounder(prisma, user.identityId);
  return user.identityId;
}
export function governanceError(error: unknown) {
  if (error instanceof OperatingAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
  if ((error as { code?: string })?.code === 'P2002') return NextResponse.json({ error: 'That workspace key already exists' }, { status: 409 });
  if ((error as { code?: string })?.code === 'P2034') return NextResponse.json({ error: 'Scope changed concurrently. Refresh and review before saving.' }, { status: 409 });
  return NextResponse.json({ error: 'Could not save workspace access' }, { status: 400 });
}
