import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { CrmLifecycleStage } from '@prisma/client';
import { requireAdmin } from '@/app/libs/onboardingGuard';

export const dynamic = 'force-dynamic';

const STAGE_ORDER = [
  'contact',
  'guest',
  'repeat',
  'prospect',
  'investor',
  'buyer',
  'owner',
  'managed',
  'seller',
  'former_client',
] as const;

interface PipelineProfileRow {
  id: string;
  email: string | null;
  stage: CrmLifecycleStage;
  leadScore: number | null;
  totalValue: number;
}

interface PipelineStage {
  stage: CrmLifecycleStage;
  count: number;
  totalValue: number;
  avgValue: number;
  // This array is page-scoped for backward-compatible UI rendering.
  // The count/value metrics above are computed over the full permitted dataset.
  profiles: PipelineProfileRow[];
}

function profileValue(profile: {
  identity: { crmOpportunities: Array<{ valueThb: number | null }> };
}) {
  return profile.identity.crmOpportunities.reduce((sum, opp) => sum + (opp.valueThb ?? 0), 0);
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  try {
    const limit = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get('limit') || '50'), 1), 100);
    const offset = Math.max(parseInt(req.nextUrl.searchParams.get('offset') || '0'), 0);

    // Page data and aggregate data are intentionally separate. The previous
    // implementation built totals from this paginated page, which made the
    // CRM summary change as the user paged through the same permitted dataset.
    const [pageProfiles, aggregateProfiles, total] = await Promise.all([
      prisma.crmProfile.findMany({
        include: {
          identity: {
            select: {
              id: true,
              email: true,
              crmOpportunities: { select: { valueThb: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.crmProfile.findMany({
        select: {
          id: true,
          lifecycleStage: true,
          identity: {
            select: { crmOpportunities: { select: { valueThb: true } } },
          },
        },
      }),
      prisma.crmProfile.count(),
    ]);

    const stageMap = new Map<CrmLifecycleStage, PipelineStage>();
    for (const stage of STAGE_ORDER) {
      stageMap.set(stage as CrmLifecycleStage, {
        stage: stage as CrmLifecycleStage,
        count: 0,
        totalValue: 0,
        avgValue: 0,
        profiles: [],
      });
    }

    // Full-scope aggregates first.
    for (const profile of aggregateProfiles) {
      const stageData = stageMap.get(profile.lifecycleStage);
      if (!stageData) continue;
      stageData.count += 1;
      stageData.totalValue += profileValue(profile);
    }

    // Only the current page's profile cards are attached to each stage.
    for (const profile of pageProfiles) {
      const stageData = stageMap.get(profile.lifecycleStage);
      if (!stageData) continue;
      stageData.profiles.push({
        id: profile.id,
        email: profile.identity?.email || null,
        stage: profile.lifecycleStage,
        leadScore: profile.leadScore,
        totalValue: profileValue(profile),
      });
    }

    const pipeline: PipelineStage[] = Array.from(stageMap.values()).map((stage) => ({
      ...stage,
      avgValue: stage.count > 0 ? Math.round(stage.totalValue / stage.count) : 0,
      profiles: stage.profiles.sort((a, b) => b.totalValue - a.totalValue),
    }));

    const totalValue = pipeline.reduce((sum, stage) => sum + stage.totalValue, 0);
    const totals = {
      totalProfiles: total,
      totalValue,
      stageDistribution: pipeline.map((stage) => ({
        stage: stage.stage,
        count: stage.count,
        percentage: total > 0 ? ((stage.count / total) * 100).toFixed(1) : '0',
      })),
    };

    return NextResponse.json({
      success: true,
      pipeline,
      totals,
      pagination: {
        limit,
        offset,
        total,
        returned: pageProfiles.length,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('[CRM PIPELINE]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
