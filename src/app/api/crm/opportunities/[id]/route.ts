import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/app/libs/onboardingGuard';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  const opportunity = await prisma.crmOpportunity.findUnique({
    where: { id: params.id },
    include: {
      identity: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      assignedTo: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      unit: {
        select: {
          id: true,
          name: true,
        },
      },
      activities: {
        select: {
          id: true,
          type: true,
          status: true,
          subject: true,
          body: true,
          dueAt: true,
          completedAt: true,
          createdAt: true,
          updatedAt: true,
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!opportunity) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: opportunity.id,
    type: opportunity.type,
    stage: opportunity.stage,
    title: opportunity.title,
    source: opportunity.source,
    valueThb: opportunity.valueThb,
    probability: opportunity.probability,
    requirements: opportunity.requirements,
    expectedCloseAt: opportunity.expectedCloseAt?.toISOString() ?? null,
    nextActionAt: opportunity.nextActionAt?.toISOString() ?? null,
    wonAt: opportunity.wonAt?.toISOString() ?? null,
    lostAt: opportunity.lostAt?.toISOString() ?? null,
    lostReason: opportunity.lostReason,
    externalPartner: opportunity.externalPartner,
    createdAt: opportunity.createdAt.toISOString(),
    updatedAt: opportunity.updatedAt.toISOString(),
    contact: {
      id: opportunity.identity.id,
      name: `${opportunity.identity.firstName} ${opportunity.identity.lastName}`,
      email: opportunity.identity.email,
      phone: opportunity.identity.phone,
    },
    assignedTo: opportunity.assignedTo
      ? {
          id: opportunity.assignedTo.id,
          name: `${opportunity.assignedTo.firstName} ${opportunity.assignedTo.lastName}`,
        }
      : null,
    project: opportunity.project
      ? {
          id: opportunity.project.id,
          name: opportunity.project.name,
          slug: opportunity.project.slug,
        }
      : null,
    unit: opportunity.unit
      ? {
          id: opportunity.unit.id,
          name: opportunity.unit.name,
        }
      : null,
    activities: opportunity.activities.map((activity) => ({
      id: activity.id,
      type: activity.type,
      status: activity.status,
      subject: activity.subject,
      body: activity.body,
      dueAt: activity.dueAt?.toISOString() ?? null,
      completedAt: activity.completedAt?.toISOString() ?? null,
      createdAt: activity.createdAt.toISOString(),
      updatedAt: activity.updatedAt.toISOString(),
      createdBy: activity.createdBy
        ? {
            id: activity.createdBy.id,
            name: `${activity.createdBy.firstName} ${activity.createdBy.lastName}`,
          }
        : null,
    })),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  const body = await req.json();
  const { requirements } = body;

  const opportunity = await prisma.crmOpportunity.findUnique({
    where: { id: params.id },
  });

  if (!opportunity) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const updated = await prisma.crmOpportunity.update({
    where: { id: params.id },
    data: {
      requirements: requirements || {},
    },
  });

  return NextResponse.json({
    id: updated.id,
    requirements: updated.requirements,
  });
}
