import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateGovernedOperatingMember } from '@/modules/ops/operating-space-governance.service';
import { governanceActor, governanceError } from '../../shared';

export async function PUT(request: NextRequest, { params }: { params: { spaceId: string } }) {
  try {
    const actorId = await governanceActor();
    const member = await updateGovernedOperatingMember(prisma, actorId, params.spaceId, await request.json());
    return NextResponse.json({ member });
  } catch (error) { return governanceError(error); }
}
