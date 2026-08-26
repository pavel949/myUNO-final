import { getCurrentUser } from '@/app/actions/getCurrentUser'
import { NextRequest, NextResponse } from 'next/server'
import { KPIStatus } from '@prisma/client'
import prismadb from '@/app/libs/prismadb'

export const dynamic = 'force-dynamic'

interface CreateKPIRequest {
  unitId: string
  metricName: string
  periodStart: string
  periodEnd: string
  targetValue?: number
  actualValue?: number
  status?: KPIStatus
}

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    if (!currentUser.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 401 }
      )
    }

    const url = new URL(req.url)
    const unitId = url.searchParams.get('unitId')
    const metricName = url.searchParams.get('metricName')
    const status = url.searchParams.get('status') as KPIStatus | null

    const where: any = {}
    if (unitId) where.unitId = unitId
    if (metricName) where.metricName = metricName
    if (status) where.status = status

    const kpis = await prismadb.operationalKpi.findMany({
      where,
      include: {
        unit: {
          select: {
            id: true,
            name: true,
            projectId: true,
          },
        },
      },
      orderBy: [{ unitId: 'asc' }, { createdAt: 'desc' }],
    })

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
    })
  } catch (error) {
    console.error('[OPERATIONAL KPIS GET]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    if (!currentUser.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 401 }
      )
    }

    const body: CreateKPIRequest = await req.json()

    if (!body.unitId || !body.metricName || !body.periodStart || !body.periodEnd) {
      return NextResponse.json(
        { error: 'Missing required fields: unitId, metricName, periodStart, periodEnd' },
        { status: 400 }
      )
    }

    // Validate dates
    const startDate = new Date(body.periodStart)
    const endDate = new Date(body.periodEnd)

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      )
    }

    if (startDate > endDate) {
      return NextResponse.json(
        { error: 'periodStart must be before periodEnd' },
        { status: 400 }
      )
    }

    // Verify unit exists
    const unit = await prismadb.unit.findUnique({
      where: { id: body.unitId },
    })

    if (!unit) {
      return NextResponse.json(
        { error: 'Unit not found' },
        { status: 404 }
      )
    }

    const kpi = await prismadb.operationalKpi.create({
      data: {
        unitId: body.unitId,
        metricName: body.metricName,
        periodStart: startDate,
        periodEnd: endDate,
        targetValue: body.targetValue ? parseFloat(body.targetValue.toString()) : null,
        actualValue: body.actualValue ? parseFloat(body.actualValue.toString()) : null,
        status: body.status || 'on_track',
      },
      include: {
        unit: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

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
    })
  } catch (error) {
    console.error('[OPERATIONAL KPIS POST]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
