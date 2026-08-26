import { getCurrentUser } from '@/app/actions/getCurrentUser'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getReconciliationData } from '@/modules/finance'

export const dynamic = 'force-dynamic'

export async function GET() {
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

    const data = await getReconciliationData(prisma)

    return NextResponse.json(data)
  } catch (error) {
    console.error('[RECONCILIATION DATA]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
