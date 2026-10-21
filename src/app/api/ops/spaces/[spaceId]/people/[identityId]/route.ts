import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { manageWorkspaceAccount } from '@/modules/core/administration.service';
import { administrationResponse } from '@/app/api/ops/spaces/administration-response';

export async function PATCH(request: NextRequest, props: { params: Promise<{ spaceId: string; identityId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { spaceId, identityId } = await props.params;
    const member = await manageWorkspaceAccount(prisma, user.identityId, spaceId, identityId, await request.json());
    return NextResponse.json({ member });
  } catch (error) { return administrationResponse(error); }
}
