import { NextRequest, NextResponse } from 'next/server';
import { CrmOpportunityStage } from '@prisma/client';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { transitionOpportunity } from '@/modules/crm';

export async function POST(
  req: NextRequest,
  { params }: { params: { opportunityId: string } }
) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await req.json();
    if (!Object.values(CrmOpportunityStage).includes(body.stage)) {
      return NextResponse.json({ error: 'invalid_stage' }, { status: 400 });
    }
    const opportunity = await transitionOpportunity(
      prisma,
      params.opportunityId,
      body.stage,
      user.identityId,
      {
        lostReason: body.lostReason,
        nextActionAt: body.nextActionAt ? new Date(body.nextActionAt) : null,
      }
    );
    return NextResponse.json(opportunity);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid_request';
    return NextResponse.json(
      { error: message },
      { status: message === 'opportunity_not_found' ? 404 : 400 }
    );
  }
}

