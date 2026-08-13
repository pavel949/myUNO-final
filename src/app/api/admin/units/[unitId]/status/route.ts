import { getCurrentUser } from '@/app/actions/getCurrentUser'
import { NextRequest, NextResponse } from 'next/server'
import prismadb from '@/app/libs/prismadb'

export const dynamic = 'force-dynamic'

type AssetStatus = 'managed' | 'verified_partner' | 'one_off_sourced' | 'suspended'

interface StatusChangeRequest {
  status: AssetStatus
  reason: string
  notes?: Record<string, unknown>
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { unitId: string } }
) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'founder')) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      )
    }

    const unitId = params.unitId
    const body: StatusChangeRequest = await req.json()

    if (!body.status || !body.reason) {
      return NextResponse.json(
        { error: 'Missing required fields: status, reason' },
        { status: 400 }
      )
    }

    const validStatuses: AssetStatus[] = ['managed', 'verified_partner', 'one_off_sourced', 'suspended']
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        {
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        },
        { status: 400 }
      )
    }

    // Fetch unit
    const unit = await prismadb.unit.findUnique({
      where: { id: unitId },
    })

    if (!unit) {
      return NextResponse.json(
        { error: 'Unit not found' },
        { status: 404 }
      )
    }

    // Update unit with new status
    const updatedUnit = await prismadb.unit.update({
      where: { id: unitId },
      data: {
        asset_status: body.status,
        asset_status_changed_at: new Date(),
        asset_status_reason: body.reason,
      },
    })

    return NextResponse.json({
      success: true,
      unit: updatedUnit,
      message: `Asset status changed to ${body.status}`,
      previousStatus: unit.asset_status || 'unknown',
    })
  } catch (error) {
    console.error('[UNIT STATUS]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
