import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/app/libs/onboardingGuard'
import { handleError } from '@/app/libs/errorHandler'
import { getConfig } from '@/modules/config'
import {
  BookingStatus,
  LedgerEntryType,
  LineItemCategory,
  OwnerStatementStatus,
  Prisma,
} from '@prisma/client'

export const dynamic = 'force-dynamic'

interface GenerateStatementRequest {
  unitId: string
  periodStart: string // ISO date YYYY-MM-DD
  periodEnd: string   // ISO date YYYY-MM-DD
}

// A stay counts towards the period's gross bookings once it is confirmed and
// for as long as it stays in a "this stay happened" state. Requested, pending,
// declined and cancelled bookings carry no owner revenue.
const REVENUE_BOOKING_STATUSES: BookingStatus[] = [
  'confirmed',
  'checked_in',
  'checked_out',
  'completed',
]

// Ledger entry types that make up the itemised expense block of a statement.
const OPERATING_EXPENSE_ENTRY_TYPES: LedgerEntryType[] = [
  'cleaning_cost',
  'maintenance_cost',
  'consumables_cost',
  'utilities_cost',
  'setup_fee',
  'ota_commission_cost',
]

export async function POST(req: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.error

  try {
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
    const unit = await prisma.unit.findUnique({
      where: { id: body.unitId },
      include: {
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

    const engagement = unit.engagements[0]
    if (!engagement) {
      return NextResponse.json(
        { error: 'Unit has no active engagement configuration' },
        { status: 400 }
      )
    }

    // Money rules (doc 10): a direct-managed unit without its NOI cap refuses
    // statement generation — the split cannot be guessed.
    if (
      engagement.engagementType === 'direct_managed' &&
      !engagement.noiCapAnnualThb
    ) {
      return NextResponse.json(
        {
          error:
            'Statement generation refused: direct-managed unit has no noi_cap_annual_thb. Set the cap on the engagement first.',
        },
        { status: 400 }
      )
    }

    // One statement per unit per period — a re-run must supersede an existing
    // statement explicitly, never silently produce a second set of numbers.
    const existing = await prisma.ownerStatement.findFirst({
      where: {
        unitId: body.unitId,
        periodStart: startDate,
        periodEnd: endDate,
      },
      select: { id: true },
    })

    if (existing) {
      return NextResponse.json(
        {
          error: 'A statement for this unit and period already exists',
          statementId: existing.id,
        },
        { status: 409 }
      )
    }

    // --- Sources of the statement's figures -------------------------------
    // Every figure below is computed on the server from stored rows; nothing
    // is taken from the request body beyond the unit and the period.

    const bookings = await prisma.booking.findMany({
      where: {
        unitId: body.unitId,
        startDate: { gte: startDate },
        endDate: { lte: endDate },
        status: { in: REVENUE_BOOKING_STATUSES },
      },
      orderBy: { startDate: 'asc' },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        totalThb: true,
      },
    })

    const bookingIds = bookings.map((b) => b.id)

    const grossBookingsThb = bookings.reduce(
      (sum, booking) => sum + (booking.totalThb || 0),
      0
    )

    // Cash actually collected from guests against those stays.
    const guestPayments = bookingIds.length
      ? await prisma.payment.aggregate({
          where: {
            bookingId: { in: bookingIds },
            status: 'succeeded',
          },
          _sum: { amountThb: true },
        })
      : { _sum: { amountThb: 0 } }

    const guestPaymentsReceivedThb = guestPayments._sum.amountThb || 0

    // The append-only ledger is the source for refunds, expenses and taxes.
    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: {
        unitId: body.unitId,
        occurredOn: { gte: startDate, lte: endDate },
        entryType: {
          in: [
            'refund_out',
            'tax_collected',
            ...OPERATING_EXPENSE_ENTRY_TYPES,
          ],
        },
      },
      orderBy: { occurredOn: 'asc' },
      select: {
        id: true,
        entryType: true,
        amountThb: true,
        description: true,
        bookingId: true,
        occurredOn: true,
      },
    })

    const sumEntries = (types: LedgerEntryType[]) =>
      ledgerEntries
        .filter((entry) => types.includes(entry.entryType))
        .reduce((sum, entry) => sum + Math.abs(entry.amountThb), 0)

    const refundsThb = sumEntries(['refund_out'])
    const operatingExpensesThb = sumEntries(OPERATING_EXPENSE_ENTRY_TYPES)
    const taxesThb = sumEntries(['tax_collected'])

    // The service fee rate is a business rule, never a literal (doc 04
    // `finance.statement.service_fee_pct`), and is scoped unit → project → global.
    const serviceFeePct =
      (await getConfig(prisma, 'finance.statement.service_fee_pct', {
        unitId: unit.id,
        projectId: unit.projectId,
      })) ?? 0

    const serviceFeesThb = Math.round((grossBookingsThb * serviceFeePct) / 100)

    const adjustedNoiThb =
      grossBookingsThb -
      refundsThb -
      serviceFeesThb -
      operatingExpensesThb -
      taxesThb

    // Performance fee: only when the unit's active management contract enables
    // one; its basis and rate come from the contract, never from a default.
    const contract = await prisma.managementContract.findFirst({
      where: {
        unitId: unit.id,
        status: 'active',
        performanceFeeEnabled: true,
      },
      orderBy: { contractStartDate: 'desc' },
    })

    let performanceFeeThb = 0
    let performanceFeeBasisText: string | null = null

    if (contract?.performanceFeeRate) {
      const baseline = contract.performanceFeeBaseline ?? 0
      const excess = Math.max(0, adjustedNoiThb - baseline)
      const rate = Number(contract.performanceFeeRate)
      performanceFeeThb = Math.round(excess * rate)
      performanceFeeBasisText = `${contract.performanceFeeBasis ?? 'adjusted_noi'} above baseline ${baseline} THB at rate ${rate} (contract ${contract.id})`
    }

    const distributableCashThb = adjustedNoiThb - performanceFeeThb

    // --- Owner / estate split per engagement type -------------------------
    let ownerShareThb = 0
    let estateShareThb = 0
    let capApplied = false

    if (engagement.engagementType === 'direct_managed') {
      // Owner receives MIN(NOI, annual cap pro-rated over the period). Both
      // endpoints are inclusive, so July 1–31 is 31 days.
      const daysInPeriod =
        Math.round(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        ) + 1
      const capProRataThb = Math.round(
        (engagement.noiCapAnnualThb! * daysInPeriod) / 365
      )
      ownerShareThb = Math.min(distributableCashThb, capProRataThb)
      estateShareThb =
        serviceFeesThb +
        performanceFeeThb +
        Math.max(0, distributableCashThb - capProRataThb)
      capApplied = capProRataThb < distributableCashThb
    } else if (engagement.engagementType === 'via_management_company') {
      const mcFeePct =
        (await getConfig(prisma, 'engagement.via_mc.platform_fee_pct', {
          unitId: unit.id,
          projectId: unit.projectId,
        })) ?? 0
      const mcFeeThb = Math.round((distributableCashThb * mcFeePct) / 100)
      ownerShareThb = distributableCashThb - mcFeeThb
      estateShareThb = serviceFeesThb + performanceFeeThb + mcFeeThb
    } else {
      const bookingFeePct =
        (await getConfig(prisma, 'engagement.owner_direct.booking_fee_pct', {
          unitId: unit.id,
          projectId: unit.projectId,
        })) ?? 0
      const bookingFeeThb = Math.round(
        (distributableCashThb * bookingFeePct) / 100
      )
      ownerShareThb = distributableCashThb - bookingFeeThb
      estateShareThb = serviceFeesThb + performanceFeeThb + bookingFeeThb
    }

    const totalCostsThb =
      refundsThb + serviceFeesThb + operatingExpensesThb + taxesThb

    // --- Line items: every figure traces to its source row ----------------
    const lineItems: Prisma.StatementLineItemCreateManyStatementInput[] = []

    for (const booking of bookings) {
      lineItems.push({
        category: 'booking_revenue' as LineItemCategory,
        description: `Booking ${booking.id} (${booking.startDate
          .toISOString()
          .slice(0, 10)} → ${booking.endDate.toISOString().slice(0, 10)})`,
        amountTh: booking.totalThb || 0,
        bookingId: booking.id,
      })
    }

    for (const entry of ledgerEntries) {
      const category: LineItemCategory =
        entry.entryType === 'refund_out'
          ? 'refund'
          : entry.entryType === 'tax_collected'
            ? 'tax'
            : 'operating_expense'

      lineItems.push({
        category,
        description: `${entry.entryType}: ${entry.description}`,
        amountTh: Math.abs(entry.amountThb),
        bookingId: entry.bookingId,
      })
    }

    if (serviceFeesThb !== 0) {
      lineItems.push({
        category: 'service_fee' as LineItemCategory,
        description: `myUNO service fee ${serviceFeePct}% of gross bookings ${grossBookingsThb} THB`,
        amountTh: serviceFeesThb,
      })
    }

    if (performanceFeeThb !== 0 && performanceFeeBasisText) {
      lineItems.push({
        category: 'performance_fee' as LineItemCategory,
        description: performanceFeeBasisText,
        amountTh: performanceFeeThb,
      })
    }

    const statement = await prisma.ownerStatement.create({
      data: {
        unitId: body.unitId,
        ownerIdentityId: engagement.ownerIdentityId,
        engagementId: engagement.id,
        periodStart: startDate,
        periodEnd: endDate,
        grossRevenueTh: grossBookingsThb,
        totalCostsTh: totalCostsThb,
        noiTh: adjustedNoiThb,
        ownerShareTh: ownerShareThb,
        estateShareTh: estateShareThb,
        capApplied,
        status: 'draft' as OwnerStatementStatus,

        // Transparency block (CLAUDE.md, "Fee Transparency for Owners")
        grossBookingsAmountTh: grossBookingsThb,
        guestPaymentsReceivedTh: guestPaymentsReceivedThb,
        serviceFeesAmountTh: serviceFeesThb,
        operatingExpensesAmountTh: operatingExpensesThb,
        taxesAmountTh: taxesThb,
        adjustedNoiTh: adjustedNoiThb,
        distributableCashTh: distributableCashThb,
        performanceFeeAmountTh: performanceFeeThb,
        performanceFeeBasisText,

        lineItems: { createMany: { data: lineItems } },
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
        _count: { select: { lineItems: true } },
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
        grossBookingsAmountThb: statement.grossBookingsAmountTh,
        guestPaymentsReceivedThb: statement.guestPaymentsReceivedTh,
        serviceFeesAmountThb: statement.serviceFeesAmountTh,
        operatingExpensesAmountThb: statement.operatingExpensesAmountTh,
        taxesAmountThb: statement.taxesAmountTh,
        adjustedNoiThb: statement.adjustedNoiTh,
        distributableCashThb: statement.distributableCashTh,
        performanceFeeAmountThb: statement.performanceFeeAmountTh,
        performanceFeeBasisText: statement.performanceFeeBasisText,
        ownerShareThb: statement.ownerShareTh,
        estateShareThb: statement.estateShareTh,
        capApplied: statement.capApplied,
        lineItemCount: statement._count.lineItems,
        status: statement.status,
      },
    })
  } catch (error) {
    return handleError(error)
  }
}
