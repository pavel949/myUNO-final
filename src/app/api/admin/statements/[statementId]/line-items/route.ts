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

    // Fetch statement with ledger entries
    const statement = await prismadb.ownerStatement.findUnique({
      where: { id: statementId },
      include: {
        ledgerEntries: {
          orderBy: { occurredOn: 'desc' },
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

    // Group ledger entries by type
    const groupedByType = statement.ledgerEntries.reduce(
      (acc, entry) => {
        if (!acc[entry.entryType]) {
          acc[entry.entryType] = []
        }
        acc[entry.entryType].push(entry)
        return acc
      },
      {} as Record<string, typeof statement.ledgerEntries>
    )

    // Calculate totals by type
    const totals = Object.entries(groupedByType).reduce(
      (acc, [type, entries]) => {
        acc[type] = entries.reduce((sum, entry) => sum + entry.amountThb, 0)
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
        grossRevenueTh: statement.grossRevenueTh,
        totalCostsTh: statement.totalCostsTh,
        noiTh: statement.noiTh,
        ownerShareTh: statement.ownerShareTh,
        estateShareTh: statement.estateShareTh,
      },
      ledgerEntries: statement.ledgerEntries,
      groupedByType,
      totals,
      entryCount: statement.ledgerEntries.length,
    })
  } catch (error) {
    console.error('[STATEMENT LINE ITEMS]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
