import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/app/libs/onboardingGuard';

const STAGES = [
  'new',
  'qualified',
  'discovery',
  'proposal',
  'negotiation',
  'nurture',
  'won',
  'lost',
] as const;

// Canonical CRM v3 definitions. `nurture` remains active relationship work,
// but it is deliberately excluded from weighted forecast until re-qualified.
const ACTIVE_STAGES = new Set(['new', 'qualified', 'discovery', 'proposal', 'negotiation', 'nurture']);
const FORECAST_STAGES = new Set(['qualified', 'discovery', 'proposal', 'negotiation']);
const CLOSED_STAGES = new Set(['won', 'lost']);

export async function GET(_req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

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

  const stageBreakdown = STAGES.reduce((acc, stage) => {
    const rows = opportunities.filter((o) => o.stage === stage);
    acc[stage] = {
      count: rows.length,
      value: rows.reduce((sum, o) => sum + (o.valueThb ?? 0), 0),
      weightedValue: rows.reduce(
        (sum, o) => sum + ((o.valueThb ?? 0) * o.probability) / 100,
        0
      ),
    };
    return acc;
  }, {} as Record<string, { count: number; value: number; weightedValue: number }>);

  const activeOpportunities = opportunities.filter((o) => ACTIVE_STAGES.has(o.stage));
  const forecastOpportunities = opportunities.filter((o) => FORECAST_STAGES.has(o.stage));
  const closedOpportunities = opportunities.filter((o) => CLOSED_STAGES.has(o.stage));
  const wonDeals = closedOpportunities.filter((o) => o.stage === 'won');

  // Backward-compatible `totalDeals` now means what the UI labels it as:
  // active deals. `totalOpportunities` exposes the all-time count explicitly.
  const totalDeals = activeOpportunities.length;
  const totalOpportunities = opportunities.length;
  const totalValue = activeOpportunities.reduce((sum, o) => sum + (o.valueThb ?? 0), 0);
  const weightedForecast = forecastOpportunities.reduce(
    (sum, o) => sum + ((o.valueThb ?? 0) * o.probability) / 100,
    0
  );
  const winRate =
    closedOpportunities.length > 0
      ? ((wonDeals.length / closedOpportunities.length) * 100).toFixed(1)
      : '0';

  const now = new Date();
  const overdueTasks = await prisma.crmActivity.findMany({
    where: {
      type: 'task',
      status: 'open',
      dueAt: { lt: now },
    },
    include: {
      identity: { select: { id: true, firstName: true, lastName: true } },
      opportunity: { select: { id: true, title: true } },
    },
    orderBy: { dueAt: 'asc' },
    take: 10,
  });

  const recentActivities = await prisma.crmActivity.findMany({
    include: {
      identity: { select: { id: true, firstName: true, lastName: true } },
      opportunity: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  return NextResponse.json({
    summary: {
      totalDeals,
      totalOpportunities,
      totalValue,
      weightedForecast,
      winRate,
      stageBreakdown,
      definitions: {
        activeStages: Array.from(ACTIVE_STAGES),
        forecastStages: Array.from(FORECAST_STAGES),
        winRate: 'won / (won + lost)',
      },
    },
    overdueTasks,
    recentActivities,
  });
}
