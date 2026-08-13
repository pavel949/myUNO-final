import { getCurrentUser } from '@/app/actions/getCurrentUser'
import { NextRequest, NextResponse } from 'next/server'
import prismadb from '@/app/libs/prismadb'

export const dynamic = 'force-dynamic'

interface GenerateStatementRequest {
  unitId: string
  periodStart: string // ISO date string
  periodEnd: string   // ISO date string
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

    const periodStart = new Date(body.periodStart)
    const periodEnd = new Date(body.periodEnd)

    if (isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format for periodStart or periodEnd' },
        { status: 400 }
      )
    }

    // Verify unit exists
    const unit = await prismadb.unit.findUnique({
      where: { id: body.unitId },
      select: {
        id: true,
        ownerIdentityId: true,
        projectId: true,
        engagements: {
          where: { status: 'active' },
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

    if (!unit.ownerIdentityId) {
      return NextResponse.json(
        { error: 'Unit has no owner assigned' },
        { status: 400 }
      )
    }

    if (unit.engagements.length === 0) {
      return NextResponse.json(
        { error: 'Unit has no active engagement' },
        { status: 400 }
      )
    }

    const engagement = unit.engagements[0]

    // Check if statement already exists for this period
    const existingStatement = await prismadb.ownerStatement.findFirst({
      where: {
        unitId: body.unitId,
        periodStart,
        periodEnd,
      },
    })

    if (existingStatement) {
      return NextResponse.json(
        { error: 'Statement already exists for this period' },
        { status: 409 }
      )
    }

    // Fetch all bookings in the period to calculate revenue
    const bookings = await prismadb.booking.findMany({
      where: {
        unitId: body.unitId,
        startDate: {
          lte: periodEnd,
        },
        endDate: {
          gte: periodStart,
        },
        status: {
          in: ['confirmed', 'checked_in', 'checked_out'],
        },
      },
      include: {
        payments: {
          where: { status: 'succeeded' },
        },
      },
    })

    // Calculate revenue components
    let grossBookingsThb = 0
    let guestPaymentsReceivedThb = 0

    for (const booking of bookings) {
      // Gross bookings is the booking total price
      grossBookingsThb += booking.totalThb

      // Guest payments is successful payments
      for (const payment of booking.payments) {
        if (payment.succeededAt) {
          guestPaymentsReceivedThb += payment.amountThb
        }
      }
    }

    // Calculate fees (simplified: based on config)
    // In production, this would pull from the config layer per project/unit
    const serviceFeesThb = Math.round(grossBookingsThb * 0.12) // 12% service fee
    const taxesThb = 0 // Would be calculated based on occupancy tax rules per country
    const operatingExpensesThb = 0 // Would be pulled from ledger entries

    // Calculate NOI and distributable cash
    const adjustedNoiThb = grossBookingsThb - serviceFeesThb - taxesThb - operatingExpensesThb
    const distributableCashThb = adjustedNoiThb // Before performance fee
    const performanceFeeThb = Math.max(0, adjustedNoiThb - 0) // Would be based on baseline calculation

    // Create owner statement
    const statement = await prismadb.ownerStatement.create({
      data: {
        unitId: body.unitId,
        ownerIdentityId: unit.ownerIdentityId,
        engagementId: engagement.id,
        periodStart,
        periodEnd,

        // Existing payout fields (kept for backward compatibility)
        grossRevenueTh: grossBookingsThb,
        totalCostsTh: serviceFeesThb + taxesThb + operatingExpensesThb,
        noiTh: adjustedNoiThb,
        ownerShareTh: adjustedNoiThb,
        estateShareTh: 0,
        capApplied: false,

        // New transparency fields
        grossBookingsAmountThb: grossBookingsThb,
        guestPaymentsReceivedThb,
        serviceFeesAmountThb: serviceFeesThb,
        operatingExpensesAmountThb: operatingExpensesThb,
        taxesAmountThb: taxesThb,
        adjustedNoiThb: adjustedNoiThb,
        distributableCashThb: distributableCashThb,
        performanceFeeAmountThb: performanceFeeThb,
        performanceFeeBasisText: 'Calculated based on NOI vs baseline',

        status: 'draft',
      },
    })

    // Create line items for each booking
    if (bookings.length > 0) {
      const lineItems = bookings.map(booking => ({
        statementId: statement.id,
        category: 'booking_revenue' as const,
        description: `Booking ${booking.id.slice(0, 8)} (${booking.startDate.toISOString().split('T')[0]} to ${booking.endDate.toISOString().split('T')[0]})`,
        amountThb: booking.totalThb,
        bookingId: booking.id,
        supportingDocumentId: null,
      }))

      await prismadb.statementLineItem.createMany({
        data: lineItems,
      })

      // Add service fee line item
      await prismadb.statementLineItem.create({
        data: {
          statementId: statement.id,
          category: 'service_fee',
          description: 'Service fee (12% of gross bookings)',
          amountThb: serviceFeesThb,
          bookingId: null,
          supportingDocumentId: null,
        },
      })
    }

    return NextResponse.json({
      success: true,
      statement,
      message: `Statement generated for period ${periodStart.toISOString().split('T')[0]} to ${periodEnd.toISOString().split('T')[0]}`,
    })
  } catch (error) {
    console.error('[STATEMENT GENERATE]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
