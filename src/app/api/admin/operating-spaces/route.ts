import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createGovernedOperatingSpace } from '@/modules/ops/operating-space-governance.service';
import { governanceActor, governanceError } from './shared';

export async function POST(request: NextRequest) {
  try {
    const actorId = await governanceActor();
    const body = await request.json();
    const space = await createGovernedOperatingSpace(prisma, actorId, body);
    return NextResponse.json({ space: { id: space.id, key: space.key, name: space.name, updatedAt: space.updatedAt } }, { status: 201 });
  } catch (error) { return governanceError(error); }
}
