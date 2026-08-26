import { getCurrentUser } from '@/app/actions/getCurrentUser'
import { NextRequest, NextResponse } from 'next/server'
import { AssetStatus } from '@prisma/client'
import prismadb from '@/app/libs/prismadb'
import {} from '@/modules/core'
import { logAudit } from '@/modules/audit';

export const dynamic = 'force-dynamic'

interface AssetStatusRequest {
  status: AssetStatus
  reason: string
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const unitId = params.id
    const body: AssetStatusRequest = await req.json()

    if (!body.status || !body.reason) {
      return NextResponse.json(
        { error: 'Missing required fields: status, reason' },
        { status: 400 }
      )
    }

    // Validate status is a valid AssetStatus enum value
    const validStatuses = ['managed', 'verified_partner', 'one_off_sourced', 'suspended']
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        {
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        },
        { status: 400 }
      )
    }

    // Fetch current unit
    const unit = await prismadb.unit.findUnique({
      where: { id: unitId },
    })

    if (!unit) {
      return NextResponse.json(
        { error: 'Unit not found' },
        { status: 404 }
      )
    }

    const currentStatus = unit.assetStatus

    // Update unit with new status
    const updatedUnit = await prismadb.unit.update({
      where: { id: unitId },
      data: {
        assetStatus: body.status,
        assetStatusChangedAt: new Date(),
        assetStatusReason: body.reason,
      },
    })

    // The row records *why* the status changed but not *who* changed it, and
    // suspending an asset is exactly the kind of state change CLAUDE.md's
    // audit-logging section expects to be traceable to a person.
    await logAudit({
      actorIdentityId: currentUser.identityId,
      action: 'units:asset_status_changed',
      entityType: 'Unit',
      entityId: unitId,
      data: { from: currentStatus, to: body.status, reason: body.reason },
    })

    return NextResponse.json({
      success: true,
      unit: updatedUnit,
      message: `Asset status changed from ${currentStatus} to ${body.status}`,
    })
  } catch (error) {
    console.error('[UNIT ASSET STATUS]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
