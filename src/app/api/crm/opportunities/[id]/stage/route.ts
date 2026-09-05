import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/app/libs/onboardingGuard';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  const { stage } = await req.json();

  if (!stage) {
    return NextResponse.json(
      { error: 'Stage is required' },
      { status: 400 }
    );
  }

  const validStages = [
    'new',
    'qualified',
    'discovery',
    'proposal',
    'negotiation',
    'nurture',
    'won',
    'lost',
  ];
  if (!validStages.includes(stage)) {
    return NextResponse.json(
      { error: 'Invalid stage' },
      { status: 400 }
    );
  }

  const opportunity = await prisma.crmOpportunity.update({
    where: { id: params.id },
    data: {
      stage,
      wonAt: stage === 'won' ? new Date() : null,
      lostAt: stage === 'lost' ? new Date() : null,
    },
    include: {
      identity: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  // Transform identity to contact
  const response = {
    ...opportunity,
    contact: opportunity.identity
      ? {
          id: opportunity.identity.id,
          name: `${opportunity.identity.firstName} ${opportunity.identity.lastName}`.trim(),
          email: opportunity.identity.email,
        }
      : null,
    identity: undefined,
  };

  return NextResponse.json(response);
}
