import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/app/libs/onboardingGuard'
import { handleError } from '@/app/libs/errorHandler'
import { getConfig } from '@/modules/config'
import {
  REVENUE_BOOKING_STATUSES,
  buildLedgerLines,
  collectSnapshotSources,
  dayAfter,
  lockUnitLedgerExclusive,
  snapshotHash,
  sourceFingerprint,
  sumByType,
  sumOperatingExpenses,
} from '@/modules/finance'
import {
  LineItemCategory,
  OwnerStatementStatus,
  Prisma,
} from '@prisma/client'

export const dynamic = 'force-dynamic'

interface GenerateStatementRequest {
  unitId: string
  periodStart: string // ISO date YYYY-MM-DD
  periodEnd: string   // ISO date YYYY-MM-DD
  /**
   * Rebuild an existing DRAFT for this unit and period from current facts —
   * the way out of a stale snapshot. Refused for anything past draft or
   * carrying a signature: an issued statement is corrected, never rewritten.
   */
  regenerate?: boolean
}

const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/

/** `YYYY-MM-DD` only, and a real day: an instant would silently shift the period by up to a day. */
function parseCalendarDay(value: unknown): Date | null {
  if (typeof value !== 'string' || !CALENDAR_DAY.test(value)) return null
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value
    ? null
    : parsed
}

class StatementConflict extends Error {
  constructor(
    readonly status: number,
    readonly body: Record<string, unknown>
  ) {
    super(String(body.error))
  }
}

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
    const startDate = parseCalendarDay(body.periodStart)
    const endDate = parseCalendarDay(body.periodEnd)

    if (!startDate || !endDate) {
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

    // The service fee rate is a business rule, never a literal (doc 04
    // `finance.statement.service_fee_pct`), and is scoped unit → project → global.
    const serviceFeePct =
      (await getConfig(prisma, 'finance.statement.service_fee_pct', {
        unitId: unit.id,
        projectId: unit.projectId,
      })) ?? 0

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

    let engagementFeePct = 0
    if (engagement.engagementType === 'via_management_company') {
      engagementFeePct =
        (await getConfig(prisma, 'engagement.via_mc.platform_fee_pct', {
          unitId: unit.id,
          projectId: unit.projectId,
        })) ?? 0
    } else if (engagement.engagementType !== 'direct_managed') {
      engagementFeePct =
        (await getConfig(prisma, 'engagement.owner_direct.booking_fee_pct', {
          unitId: unit.id,
          projectId: unit.projectId,
        })) ?? 0
    }

    const period = { unitId: unit.id, periodStart: startDate, periodEnd: endDate }
    // Period end is an inclusive calendar day for statements.
    const nextPeriodDay = dayAfter(endDate)

    // One transaction under the unit's EXCLUSIVE ledger lock. No cost, reversal
    // or receipt can commit while the figures are read and the statement is
    // written, and two simultaneous generations for one unit run one after the
    // other — the second finds the first's statement and answers 409.
    const outcome = await prisma.$transaction(
      async (tx) => {
        await lockUnitLedgerExclusive(tx, unit.id)

        // One statement per unit per period — a re-run must supersede an
        // existing statement explicitly, never silently produce a second set of
        // numbers. Only an unsigned DRAFT may be rebuilt in place.
        const existing = await tx.ownerStatement.findFirst({
          where: { unitId: unit.id, periodStart: startDate, periodEnd: endDate },
          select: {
            id: true,
            status: true,
            signedOffByOwnerAt: true,
            signedOffByOperatorAt: true,
          },
        })

        const rebuildable =
          body.regenerate === true &&
          existing?.status === 'draft' &&
          !existing.signedOffByOwnerAt &&
          !existing.signedOffByOperatorAt

        if (existing && !rebuildable) {
          throw new StatementConflict(409, {
            error: 'A statement for this unit and period already exists',
            statementId: existing.id,
            status: existing.status,
            ...(body.regenerate === true
              ? {
                  code: 'statement_not_regenerable',
                  hint: 'Only an unsigned draft can be regenerated.',
                }
              : {}),
          })
        }

        // A stay that crosses the boundary cannot be silently omitted:
        // allocation must be explicitly defined before financial close.
        const crossingStay = await tx.booking.findFirst({
          where: {
            unitId: unit.id,
            status: { in: REVENUE_BOOKING_STATUSES },
            startDate: { lt: nextPeriodDay },
            endDate: { gt: startDate },
            OR: [
              { startDate: { lt: startDate } },
              { endDate: { gt: nextPeriodDay } },
            ],
          },
          select: { id: true },
        })
        if (crossingStay) {
          throw new StatementConflict(409, {
            error:
              'A stay crosses this accounting period. Resolve the stay allocation policy before generating a statement.',
            bookingId: crossingStay.id,
          })
        }

        // --- Sources of the statement's figures ---------------------------
        // Every figure below is computed on the server from stored rows;
        // nothing is taken from the request body beyond the unit and period.
        const sources = await collectSnapshotSources(tx, period)

        const grossBookingsThb = sources.bookings.reduce(
          (sum, booking) => sum + (booking.totalThb || 0),
          0
        )
        const guestPaymentsReceivedThb = sources.guestPaymentsReceivedThb

        const refundsThb = sumByType(sources.ledgerRows, 'refund_out')
        // Costs net of their reversals; a reversal is a credit, not a cost.
        const operatingExpensesThb = sumOperatingExpenses(sources.ledgerRows)
        const taxesThb = sumByType(sources.ledgerRows, 'tax_collected')

        const serviceFeesThb = Math.round((grossBookingsThb * serviceFeePct) / 100)

        const adjustedNoiThb =
          grossBookingsThb -
          refundsThb -
          serviceFeesThb -
          operatingExpensesThb -
          taxesThb

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

        // --- Owner / estate split per engagement type ---------------------
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
        } else {
          // via_management_company: the MC platform fee; owner_direct: the
          // booking fee. Both come from configuration resolved above.
          const feeThb = Math.round((distributableCashThb * engagementFeePct) / 100)
          ownerShareThb = distributableCashThb - feeThb
          estateShareThb = serviceFeesThb + performanceFeeThb + feeThb
        }

        const totalCostsThb =
          refundsThb + serviceFeesThb + operatingExpensesThb + taxesThb

        // --- Line items: every figure traces to its source row ------------
        const lineItems: Prisma.StatementLineItemCreateManyStatementInput[] = []

        for (const booking of sources.bookings) {
          lineItems.push({
            category: 'booking_revenue' as LineItemCategory,
            description: `Booking ${booking.id} (${booking.startDate
              .toISOString()
              .slice(0, 10)} → ${booking.endDate.toISOString().slice(0, 10)})`,
            amountTh: booking.totalThb || 0,
            bookingId: booking.id,
          })
        }

        const ledgerLines = buildLedgerLines(
          sources.ledgerRows,
          sources.currentReceiptByEntryId
        )
        for (const line of ledgerLines) {
          lineItems.push({
            category: line.category as LineItemCategory,
            description: line.description,
            amountTh: line.amountTh,
            bookingId: line.bookingId,
            ledgerEntryId: line.ledgerEntryId,
            expenseReceiptId: line.expenseReceiptId,
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

        const figures = {
          grossRevenueTh: grossBookingsThb,
          totalCostsTh: totalCostsThb,
          noiTh: adjustedNoiThb,
          ownerShareTh: ownerShareThb,
          estateShareTh: estateShareThb,
          capApplied,

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
        }

        // The verified snapshot: what the figures were built from, and what was
        // issued. Sign-off re-checks both under the same lock.
        const fingerprint = sourceFingerprint(
          period,
          { ownerIdentityId: engagement.ownerIdentityId, engagementId: engagement.id },
          sources
        )
        const hash = snapshotHash(
          figures,
          lineItems.map((l) => ({
            category: l.category,
            description: l.description,
            amountTh: l.amountTh,
            bookingId: l.bookingId ?? null,
            ledgerEntryId: l.ledgerEntryId ?? null,
            expenseReceiptId: l.expenseReceiptId ?? null,
          }))
        )

        if (existing) {
          // Rebuilding an unsigned draft in place: release its ledger links and
          // lines, then lay the fresh ones down. Its id (and anything pointing
          // at it) stays.
          await tx.statementLineItem.deleteMany({ where: { statementId: existing.id } })
          await tx.ledgerEntry.updateMany({
            where: { statementId: existing.id },
            data: { statementId: null },
          })
        }

        const data = {
          ownerIdentityId: engagement.ownerIdentityId,
          engagementId: engagement.id,
          ...figures,
          status: 'draft' as OwnerStatementStatus,
          sourceFingerprint: fingerprint,
          snapshotHash: hash,
          lineItems: { createMany: { data: lineItems } },
        }
        const include = {
          owner: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: { select: { lineItems: true } },
        } satisfies Prisma.OwnerStatementInclude

        const statement = existing
          ? await tx.ownerStatement.update({ where: { id: existing.id }, data, include })
          : await tx.ownerStatement.create({
              data: { unitId: unit.id, periodStart: startDate, periodEnd: endDate, ...data },
              include,
            })

        // Each swept ledger row now belongs to this statement (once).
        const swept = sources.ledgerRows.map((row) => row.id)
        if (swept.length > 0) {
          await tx.ledgerEntry.updateMany({
            where: { id: { in: swept }, statementId: null },
            data: { statementId: statement.id },
          })
        }

        await tx.auditLog.create({
          data: {
            action: existing ? 'statement_regenerated' : 'statement_generated',
            entityType: 'owner_statement',
            entityId: statement.id,
            actorIdentityId: guard.actorIdentityId,
            data: { unitId: unit.id, snapshotHash: hash },
          },
        })

        return { statement, regenerated: Boolean(existing) }
      },
      { timeout: 30_000 }
    )

    const { statement } = outcome
    return NextResponse.json({
      success: true,
      regenerated: outcome.regenerated,
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
    if (error instanceof StatementConflict) {
      return NextResponse.json(error.body, { status: error.status })
    }
    return handleError(error)
  }
}
