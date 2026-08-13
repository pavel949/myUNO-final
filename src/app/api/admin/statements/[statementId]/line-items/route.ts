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

    // Fetch statement with line items
    const statement = await prismadb.ownerStatement.findUnique({
      where: { id: statementId },
      include: {
        lineItems: {
          orderBy: { createdAt: 'desc' },
        },
        unit: {
          select: {
            id: true,
            name: true,
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

    // Group line items by category
    const groupedByCategory = statement.lineItems.reduce(
      (acc, item) => {
        if (!acc[item.category]) {
          acc[item.category] = []
        }
        acc[item.category].push(item)
        return acc
      },
      {} as Record<string, typeof statement.lineItems>
    )

    // Calculate totals by category
    const totals = Object.entries(groupedByCategory).reduce(
      (acc, [category, items]) => {
        acc[category] = items.reduce((sum, item) => sum + item.amountThb, 0)
        return acc
      },
      {} as Record<string, number>
    )

    return NextResponse.json({
      success: true,
      statement: {
        id: statement.id,
        periodStart: statement.periodStart,
        periodEnd: statement.periodEnd,
        status: statement.status,
        unitName: statement.unit.name,
        grossBookingsAmountThb: statement.grossBookingsAmountThb,
        serviceFeesAmountThb: statement.serviceFeesAmountThb,
        adjustedNoiThb: statement.adjustedNoiThb,
        distributableCashThb: statement.distributableCashThb,
        performanceFeeAmountThb: statement.performanceFeeAmountThb,
      },
      lineItems: statement.lineItems,
      groupedByCategory,
      totals,
      lineItemCount: statement.lineItems.length,
    })
  } catch (error) {
    console.error('[STATEMENT LINE ITEMS]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
