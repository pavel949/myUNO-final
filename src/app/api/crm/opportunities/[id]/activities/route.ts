import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/app/libs/onboardingGuard';
import type { CrmActivityType, CrmActivityStatus } from '@prisma/client';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  const { searchParams } = new URL(req.url);
  const typeFilter = searchParams.get('type') as CrmActivityType | null;
  const statusFilter = searchParams.get('status') as CrmActivityStatus | null;
  const sortBy = searchParams.get('sort') ?? 'recent';
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100);
  const offset = parseInt(searchParams.get('offset') ?? '0');

  const where: any = {
    opportunityId: params.id,
  };

  if (typeFilter) {
    where.type = typeFilter;
  }

  if (statusFilter) {
    where.status = statusFilter;
  }

  const orderBy: any = {};
  if (sortBy === 'recent') {
    orderBy.createdAt = 'desc';
  } else if (sortBy === 'oldest') {
    orderBy.createdAt = 'asc';
  } else if (sortBy === 'due') {
    orderBy.dueAt = 'asc';
  }

  const [activities, total] = await Promise.all([
    prisma.crmActivity.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy,
      take: limit,
      skip: offset,
    }),
    prisma.crmActivity.count({ where }),
  ]);

  return NextResponse.json({
    activities: activities.map((activity) => ({
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
    total,
    limit,
    offset,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  const body = await req.json();
  const { type, subject, body: bodyText, dueAt } = body;

  if (!type || !subject) {
    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 }
    );
  }

  const opportunity = await prisma.crmOpportunity.findUnique({
    where: { id: params.id },
  });

  if (!opportunity) {
    return NextResponse.json(
      { error: 'Opportunity not found' },
      { status: 404 }
    );
  }

  const activity = await prisma.crmActivity.create({
    data: {
      type,
      subject,
      body: bodyText || null,
      opportunityId: params.id,
      identityId: opportunity.identityId,
      createdByIdentityId: guard.actorIdentityId,
      dueAt: dueAt ? new Date(dueAt) : null,
      status: 'open',
    },
    include: {
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  return NextResponse.json(
    {
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
    },
    { status: 201 }
  );
}
