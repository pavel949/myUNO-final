import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { AdministrationError, workspaceAdministrator } from '@/modules/core/administration.service';
import { administrationResponse } from '@/app/api/ops/spaces/administration-response';

export async function GET(request: NextRequest, props: { params: Promise<{ spaceId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { spaceId } = await props.params;
    await workspaceAdministrator(prisma, user.identityId, spaceId);
    const offset = Number(request.nextUrl.searchParams.get('offset') ?? 0);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000) throw new AdministrationError('Invalid page', 400);
    const members = await prisma.operatingSpaceMember.findMany({ where: { operatingSpaceId: spaceId },
      take: 100, skip: offset, orderBy: { id: 'asc' }, select: { id: true, identityId: true, active: true,
        isAdministrator: true, displayName: true, updatedAt: true,
        identity: { select: { firstName: true, lastName: true } },
      } });
    return NextResponse.json({ members });
  } catch (error) { return administrationResponse(error); }
}
