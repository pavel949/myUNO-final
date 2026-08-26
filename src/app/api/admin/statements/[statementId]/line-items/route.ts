import { getCurrentUser } from '@/app/actions/getCurrentUser'
import { NextRequest, NextResponse } from 'next/server'
import prismadb from '@/app/libs/prismadb'
import { LineItemCategory } from '@prisma/client'

export const dynamic = 'force-dynamic'

interface LineItemView {
  id: string
  category: LineItemCategory
  description: string
  amountThb: number
  bookingId: string | null
  supportingDocumentId: string | null
  createdAt: string
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { statementId: string } }
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

    const statementId = params.statementId

    // The statement's own line items are the drill-down source; ledger entries
    // are the raw accounting rows behind them, not the statement's lines.
    const statement = await prismadb.ownerStatement.findUnique({
      where: { id: statementId },
      include: {
        unit: { select: { id: true, name: true, projectId: true } },
        lineItems: {
          orderBy: [{ category: 'asc' }, { createdAt: 'asc' }],
        },
      },
    })

    if (!statement) {
      return NextResponse.json(
        { error: 'Statement not found' },
        { status: 404 }
      )
    }

    const lineItems: LineItemView[] = statement.lineItems.map((item) => ({
      id: item.id,
      category: item.category,
      description: item.description,
      amountThb: item.amountTh,
      bookingId: item.bookingId,
      supportingDocumentId: item.supportingDocumentId,
      createdAt: item.createdAt.toISOString(),
    }))

    // Group and total by category so the owner statement can be read
    // section by section (CLAUDE.md, "Fee Transparency for Owners").
    const groupedByCategory: Partial<Record<LineItemCategory, LineItemView[]>> = {}
    const totals: Partial<Record<LineItemCategory, number>> = {}

    for (const item of lineItems) {
      const group = groupedByCategory[item.category] ?? []
      group.push(item)
      groupedByCategory[item.category] = group
      totals[item.category] = (totals[item.category] ?? 0) + item.amountThb
    }

    return NextResponse.json({
      success: true,
      statement: {
        id: statement.id,
        unitId: statement.unitId,
        unitName: statement.unit.name,
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
        status: statement.status,
      },
      lineItems,
      groupedByCategory,
      totals,
    })
  } catch (error) {
    console.error('[STATEMENT LINE ITEMS]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
