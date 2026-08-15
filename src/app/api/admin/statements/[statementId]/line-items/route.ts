import { getCurrentUser } from '@/app/actions/getCurrentUser'
import { NextRequest, NextResponse } from 'next/server'
import prismadb from '@/app/libs/prismadb'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { statementId: string } }
) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser || !currentUser.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      )
    }

    const statementId = params.statementId

    // Fetch statement with its ledger entries
    const statement = await prismadb.ownerStatement.findUnique({
      where: { id: statementId },
      include: {
        unit: true,
        ledgerEntries: {
          orderBy: {
            occurredOn: 'desc',
          },
        },
      },
    })

    if (!statement) {
      return NextResponse.json(
        { error: 'Statement not found' },
        { status: 404 }
      )
    }

    // Map ledger entries to line items
    const lineItems = statement.ledgerEntries.map((entry) => ({
      id: entry.id,
      category: entry.entryType,
      description: entry.description,
      amount: entry.amountThb,
      occurredOn: entry.occurredOn.toISOString(),
      bookingId: entry.bookingId,
      serviceOrderId: entry.serviceOrderId,
    }))

    // Calculate totals by category
    const totals: Record<string, number> = {}
    lineItems.forEach((item) => {
      if (!totals[item.category]) {
        totals[item.category] = 0
      }
      totals[item.category] += item.amount
    })

    return NextResponse.json({
      success: true,
      statement: {
        id: statement.id,
        unitId: statement.unitId,
        periodStart: statement.periodStart.toISOString(),
        periodEnd: statement.periodEnd.toISOString(),
        grossRevenue: statement.grossRevenueTh,
        totalCosts: statement.totalCostsTh,
        noi: statement.noiTh,
        ownerShare: statement.ownerShareTh,
        estateShare: statement.estateShareTh,
        status: statement.status,
      },
      lineItems,
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
