import { getCurrentUser } from '@/app/actions/getCurrentUser'
import { NextRequest, NextResponse } from 'next/server'
import prismadb from '@/app/libs/prismadb'
import { computeProviderRemittance } from '@/modules/finance'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/payouts/provider/preview — read-only remittance figures for
 * a provider/period, so an admin can see the exact amount `POST
 * /api/admin/payouts/provider` will require before recording it (that route
 * refuses any `amountThb` that does not match this calculation exactly).
 */
export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    if (!currentUser.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const providerId = searchParams.get('providerId')
    const periodStartRaw = searchParams.get('periodStart')
    const periodEndRaw = searchParams.get('periodEnd')

    if (!providerId || !periodStartRaw || !periodEndRaw) {
      return NextResponse.json(
        { error: 'providerId, periodStart, and periodEnd are required' },
        { status: 400 }
      )
    }

    const periodStart = new Date(periodStartRaw)
    const periodEnd = new Date(periodEndRaw)
    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime()) || periodStart >= periodEnd) {
      return NextResponse.json({ error: 'periodStart must be a valid date before periodEnd' }, { status: 400 })
    }

    const provider = await prismadb.provider.findUnique({ where: { id: providerId }, select: { name: true } })
    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
    }

    const remittance = await computeProviderRemittance(prismadb, providerId, periodStart, periodEnd)

    return NextResponse.json({ providerName: provider.name, remittance })
  } catch (error) {
    console.error('[PROVIDER PAYOUT PREVIEW]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
