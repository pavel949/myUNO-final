import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/app/libs/onboardingGuard';

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  const { searchParams } = new URL(req.url);
  const stage = searchParams.get('stage');
  const type = searchParams.get('type');
  const assignedTo = searchParams.get('assignedTo');
  const projectId = searchParams.get('projectId');
  const limit = parseInt(searchParams.get('limit') || '100', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  const where: any = {};

  if (stage) {
    where.stage = stage;
  }
  if (type) {
    where.type = type;
  }
  if (assignedTo) {
    where.assignedToIdentityId = assignedTo;
  }
  if (projectId) {
    where.projectId = projectId;
  }

  const [opportunities, total] = await Promise.all([
    prisma.crmOpportunity.findMany({
      where,
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
            email: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        unit: {
          select: {
            id: true,
            name: true,
          },
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            type: true,
            subject: true,
            createdAt: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.crmOpportunity.count({ where }),
  ]);

  // Transform identity to contact for frontend
  const serialized = opportunities.map((opp) => ({
    ...opp,
    contact: opp.identity
      ? {
          id: opp.identity.id,
          name: `${opp.identity.firstName} ${opp.identity.lastName}`.trim(),
          email: opp.identity.email,
          phone: opp.identity.phone,
          avatar: null,
        }
      : null,
    identity: undefined,
    assignedTo: opp.assignedTo
      ? {
          id: opp.assignedTo.id,
          name: `${opp.assignedTo.firstName} ${opp.assignedTo.lastName}`.trim(),
          email: opp.assignedTo.email,
        }
      : null,
  }));

  return NextResponse.json({
    opportunities: serialized,
    total,
    limit,
    offset,
    hasMore: offset + limit < total,
  });
}
