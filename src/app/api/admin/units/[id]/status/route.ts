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
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser || !currentUser.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      )
    }

    const unitId = params.id
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
        assetStatus: body.status,
        assetStatusChangedAt: new Date(),
        assetStatusReason: body.reason,
      },
    })

    return NextResponse.json({
      success: true,
      unit: updatedUnit,
      message: `Asset status changed to ${body.status}`,
      previousStatus: unit.assetStatus || 'unknown',
    })
  } catch (error) {
    console.error('[UNIT STATUS]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
