import { NextRequest, NextResponse } from 'next/server';
import { CrmOpportunityType } from '@prisma/client';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { createOpportunity, getPipeline } from '@/modules/crm';

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json(await getPipeline(prisma));
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await req.json();
    if (!Object.values(CrmOpportunityType).includes(body.type)) {
      return NextResponse.json({ error: 'invalid_type' }, { status: 400 });
    }
    const opportunity = await createOpportunity(prisma, {
      identityId: body.identityId,
      assignedToIdentityId: body.assignedToIdentityId ?? user.identityId,
      projectId: body.projectId,
      unitId: body.unitId,
      type: body.type,
      title: body.title,
      source: body.source,
      valueThb: body.valueThb,
      probability: body.probability,
      requirements: body.requirements,
      expectedCloseAt: body.expectedCloseAt ? new Date(body.expectedCloseAt) : null,
      nextActionAt: body.nextActionAt ? new Date(body.nextActionAt) : null,
      externalPartner: body.externalPartner,
    });
    return NextResponse.json(opportunity, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'invalid_request' },
      { status: 400 }
    );
  }
}

