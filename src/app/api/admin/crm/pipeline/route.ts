import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { can } from '@/modules/core';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { CrmLifecycleStage } from '@prisma/client';

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

interface PipelineStage {
  stage: CrmLifecycleStage;
  count: number;
  totalValue: number;
  avgValue: number;
  profiles: Array<{
    id: string;
    email: string | null;
    stage: CrmLifecycleStage;
    leadScore: number | null;
    totalValue: number;
  }>;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const identity = await prisma.identity.findUnique({ where: { id: user.identityId } });
  if (!identity) return NextResponse.json({ error: 'Identity not found' }, { status: 404 });

  if (
    !(await can({
      identity,
      action: 'admin:view_all',
      resource: { resourceType: 'platform' },
    }))
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0');

    const profiles = await prisma.crmProfile.findMany({
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
    });

    const total = await prisma.crmProfile.count();

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

    for (const profile of profiles) {
      const stage = profile.lifecycleStage;
      const stageData = stageMap.get(stage)!;
      const profileValue = profile.identity.crmOpportunities.reduce(
        (sum, opp) => sum + (opp.valueThb ?? 0),
        0
      );

      stageData.count += 1;
      stageData.totalValue += profileValue;
      stageData.profiles.push({
        id: profile.id,
        email: profile.identity?.email || null,
        stage: profile.lifecycleStage,
        leadScore: profile.leadScore,
        totalValue: profileValue,
      });
    }

    const pipeline: PipelineStage[] = Array.from(stageMap.values()).map((stage) => ({
      ...stage,
      avgValue: stage.count > 0 ? Math.round(stage.totalValue / stage.count) : 0,
      profiles: stage.profiles.sort((a, b) => b.totalValue - a.totalValue),
    }));

    const totals = {
      totalProfiles: profiles.length,
      totalValue: pipeline.reduce((sum, stage) => sum + stage.totalValue, 0),
      stageDistribution: pipeline.map((stage) => ({
        stage: stage.stage,
        count: stage.count,
        percentage: profiles.length > 0 ? ((stage.count / profiles.length) * 100).toFixed(1) : '0',
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
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('[CRM PIPELINE]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
