import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { accountSummary, managePlatformAccount, platformAccountAuthority } from '@/modules/core/administration.service';
import { administrationResponse } from '@/app/api/ops/spaces/administration-response';

export async function GET(_request: NextRequest, props: { params: Promise<{ identityId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { target } = await platformAccountAuthority(prisma, user.identityId, (await props.params).identityId);
    return NextResponse.json({ account: accountSummary(target) });
  } catch (error) { return administrationResponse(error); }
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ identityId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const target = await managePlatformAccount(prisma, user.identityId, (await props.params).identityId, await request.json());
    return NextResponse.json({ account: accountSummary(target) });
  } catch (error) { return administrationResponse(error); }
}
