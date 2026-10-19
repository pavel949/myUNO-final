import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateGovernedOperatingMember } from '@/modules/ops/operating-space-governance.service';
import { governanceActor, governanceError } from '@/app/api/admin/operating-spaces/shared';

export async function PUT(request: NextRequest, props: { params: Promise<{ spaceId: string }> }) {
  const params = await props.params;
  try {
    const actorId = await governanceActor();
    const member = await updateGovernedOperatingMember(prisma, actorId, params.spaceId, await request.json());
    return NextResponse.json({ member });
  } catch (error) { return governanceError(error); }
}
