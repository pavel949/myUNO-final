import { getCurrentUser } from '@/app/actions/getCurrentUser'
import { NextRequest, NextResponse } from 'next/server'
import prismadb from '@/app/libs/prismadb'
import { OwnerStatementStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

interface GenerateStatementRequest {
  unitId: string
  periodStart: string // ISO date YYYY-MM-DD
  periodEnd: string   // ISO date YYYY-MM-DD
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser || !currentUser.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      )
    }

    const body: GenerateStatementRequest = await req.json()

    if (!body.unitId || !body.periodStart || !body.periodEnd) {
      return NextResponse.json(
        { error: 'Missing required fields: unitId, periodStart, periodEnd' },
        { status: 400 }
      )
    }

    // Validate date format and order
    const startDate = new Date(body.periodStart)
    const endDate = new Date(body.periodEnd)

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      )
    }

    if (startDate > endDate) {
      return NextResponse.json(
        { error: 'periodStart must be before periodEnd' },
        { status: 400 }
      )
    }

    // Fetch unit
    const unit = await prismadb.unit.findUnique({
      where: { id: body.unitId },
      include: {
        engagements: {
          where: { status: 'active' },
          include: {
            owner: true,
          },
          take: 1,
        },
      },
    })

    if (!unit) {
      return NextResponse.json(
        { error: 'Unit not found' },
        { status: 404 }
      )
    }

    const engagement = unit.engagements[0]
    if (!engagement) {
      return NextResponse.json(
        { error: 'Unit has no active engagement configuration' },
        { status: 400 }
      )
    }


    // Query bookings for the period
    // This is a simplified calculation - a real implementation would include:
    // - All booking-related revenue and refunds
    // - Operating expenses from ledger
    // - Taxes per jurisdiction
    // - Performance fees based on NOI basis
    const bookings = await prismadb.booking.findMany({
      where: {
        unitId: body.unitId,
        startDate: {
          gte: startDate,
        },
        endDate: {
          lte: endDate,
        },
        status: 'confirmed',
      },
      include: {
        ledgerEntries: true,
      },
    })

    // Calculate gross revenue (sum of confirmed bookings)
    let grossRevenue = 0
    bookings.forEach((booking) => {
      grossRevenue += booking.totalThb || 0
    })

    // Calculate costs (simplified - would be from ledger entries in real system)
    let totalCosts = 0
    const costCategories = [
      'cleaning_cost',
      'maintenance_cost',
      'consumables_cost',
      'utilities_cost',
      'setup_fee',
      'service_commission',
      'ota_commission_cost',
      'mc_platform_fee',
      'owner_direct_fee',
      'tax_collected',
      'refund_out',
    ]
    bookings.forEach((booking) => {
      booking.ledgerEntries.forEach((entry) => {
        if (costCategories.includes(entry.entryType)) {
          totalCosts += Math.abs(entry.amountThb)
        }
      })
    })

    // Calculate NOI
    const noi = grossRevenue - totalCosts

    // Split based on engagement type
    // In real system, this would come from config and engagement terms
    let ownerShare = 0
    let estateShare = 0
    let capApplied = false

    if (engagement.engagementType === 'direct_managed') {
      // Owner gets: NOI - management fee %
      const managementFeeRate = 0.15 // 15% placeholder
      estateShare = Math.round(grossRevenue * managementFeeRate)
      ownerShare = noi - estateShare
    } else if (engagement.engagementType === 'via_management_company') {
      // Split with management company per agreement
      ownerShare = Math.round(noi * 0.7)
      estateShare = noi - ownerShare
    } else {
      // owner_direct: owner keeps everything
      ownerShare = noi
      estateShare = 0
    }

    // Create statement
    const statement = await prismadb.ownerStatement.create({
      data: {
        unitId: body.unitId,
        ownerIdentityId: engagement.ownerIdentityId,
        engagementId: engagement.id,
        periodStart: startDate,
        periodEnd: endDate,
        grossRevenueTh: grossRevenue,
        totalCostsTh: totalCosts,
        noiTh: noi,
        ownerShareTh: ownerShare,
        estateShareTh: estateShare,
        capApplied,
        status: 'draft' as OwnerStatementStatus,
      },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        unit: true,
      },
    })

    return NextResponse.json({
      success: true,
      statement: {
        id: statement.id,
        unitId: statement.unitId,
        ownerEmail: statement.owner.email,
        periodStart: statement.periodStart.toISOString(),
        periodEnd: statement.periodEnd.toISOString(),
        grossRevenue: statement.grossRevenueTh,
        totalCosts: statement.totalCostsTh,
        noi: statement.noiTh,
        ownerShare: statement.ownerShareTh,
        estateShare: statement.estateShareTh,
        status: statement.status,
      },
    })
  } catch (error) {
    console.error('[STATEMENT GENERATION]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
