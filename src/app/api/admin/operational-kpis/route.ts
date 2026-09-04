import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { can } from '@/modules/core';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { KPIStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

interface CreateKPIRequest {
  unitId: string;
  metricName: string;
  periodStart: string;
  periodEnd: string;
  targetValue?: number;
  actualValue?: number;
  status?: KPIStatus;
}

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const identity = await prisma.identity.findUnique({ where: { id: user.identityId } });
  if (!identity) {
    return { error: NextResponse.json({ error: 'Identity not found' }, { status: 404 }) };
  }

  if (
    !(await can({
      identity,
      action: 'admin:view_all',
      resource: { resourceType: 'platform' },
    }))
  ) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { user, identity };
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return auth.error;

  try {
    const url = new URL(req.url);
    const unitId = url.searchParams.get('unitId');
    const metricName = url.searchParams.get('metricName');
    const status = url.searchParams.get('status') as KPIStatus | null;

    const where: { unitId?: string; metricName?: string; status?: KPIStatus } = {};
    if (unitId) where.unitId = unitId;
    if (metricName) where.metricName = metricName;
    if (status) where.status = status;

    const kpis = await prisma.operationalKpi.findMany({
      where,
      include: {
        unit: { select: { id: true, name: true, projectId: true } },
      },
      orderBy: [{ unitId: 'asc' }, { createdAt: 'desc' }],
      take: 100,
    });

    return NextResponse.json({
      success: true,
      kpis: kpis.map((kpi) => ({
        id: kpi.id,
        unitId: kpi.unitId,
        unitName: kpi.unit.name,
        metricName: kpi.metricName,
        periodStart: kpi.periodStart.toISOString(),
        periodEnd: kpi.periodEnd.toISOString(),
        targetValue: kpi.targetValue ? parseFloat(kpi.targetValue.toString()) : null,
        actualValue: kpi.actualValue ? parseFloat(kpi.actualValue.toString()) : null,
        status: kpi.status,
        createdAt: kpi.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('[OPERATIONAL KPIS GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return auth.error;

  try {
    const body: CreateKPIRequest = await req.json();

    if (!body.unitId || !body.metricName || !body.periodStart || !body.periodEnd) {
      return NextResponse.json(
        { error: 'Missing required fields: unitId, metricName, periodStart, periodEnd' },
        { status: 400 }
      );
    }

    const startDate = new Date(body.periodStart);
    const endDate = new Date(body.periodEnd);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    if (startDate > endDate) {
      return NextResponse.json({ error: 'periodStart must be before periodEnd' }, { status: 400 });
    }

    const unit = await prisma.unit.findUnique({ where: { id: body.unitId } });
    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    const kpi = await prisma.operationalKpi.create({
      data: {
        unitId: body.unitId,
        metricName: body.metricName,
        periodStart: startDate,
        periodEnd: endDate,
        targetValue: body.targetValue ?? null,
        actualValue: body.actualValue ?? null,
        status: body.status || 'on_track',
      },
      include: {
        unit: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      success: true,
      kpi: {
        id: kpi.id,
        unitId: kpi.unitId,
        unitName: kpi.unit.name,
        metricName: kpi.metricName,
        periodStart: kpi.periodStart.toISOString(),
        periodEnd: kpi.periodEnd.toISOString(),
        targetValue: kpi.targetValue ? parseFloat(kpi.targetValue.toString()) : null,
        actualValue: kpi.actualValue ? parseFloat(kpi.actualValue.toString()) : null,
        status: kpi.status,
        createdAt: kpi.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[OPERATIONAL KPIS POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
