import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/app/libs/onboardingGuard';

export async function GET(_req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  // Get all opportunities grouped by stage
  const opportunities = await prisma.crmOpportunity.findMany({
    select: {
      id: true,
      stage: true,
      valueThb: true,
      probability: true,
      createdAt: true,
      wonAt: true,
    },
  });

  // Calculate metrics
  const stages = [
    'new',
    'qualified',
    'discovery',
    'proposal',
    'negotiation',
    'nurture',
    'won',
    'lost',
  ];

  const stageBreakdown = stages.reduce((acc, stage) => {
    const oppsInStage = opportunities.filter((o) => o.stage === stage);
    acc[stage] = {
      count: oppsInStage.length,
      value: oppsInStage.reduce((sum, o) => sum + (o.valueThb ?? 0), 0),
      weightedValue: oppsInStage.reduce(
        (sum, o) => sum + ((o.valueThb ?? 0) * o.probability) / 100,
        0
      ),
    };
    return acc;
  }, {} as Record<string, { count: number; value: number; weightedValue: number }>);

  const totalDeals = opportunities.length;
  const totalValue = opportunities.reduce((sum, o) => sum + (o.valueThb ?? 0), 0);
  const weightedForecast = opportunities.reduce(
    (sum, o) => sum + ((o.valueThb ?? 0) * o.probability) / 100,
    0
  );

  const wonDeals = opportunities.filter((o) => o.stage === 'won');
  const winRate =
    totalDeals > 0 ? ((wonDeals.length / totalDeals) * 100).toFixed(1) : '0';

  // Get next actions (overdue tasks)
  const now = new Date();
  const overdueTasks = await prisma.crmActivity.findMany({
    where: {
      type: 'task',
      status: 'open',
      dueAt: {
        lt: now,
      },
    },
    include: {
      identity: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      opportunity: {
        select: {
          id: true,
          title: true,
        },
      },
    },
    orderBy: { dueAt: 'asc' },
    take: 10,
  });

  // Get recent activities
  const recentActivities = await prisma.crmActivity.findMany({
    include: {
      identity: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      opportunity: {
        select: {
          id: true,
          title: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  return NextResponse.json({
    summary: {
      totalDeals,
      totalValue,
      weightedForecast,
      winRate,
      stageBreakdown,
    },
    overdueTasks,
    recentActivities,
  });
}
