import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/app/libs/onboardingGuard'
import { handleError } from '@/app/libs/errorHandler'
import { computeProviderRemittance } from '@/modules/finance'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/payouts/provider/preview — read-only remittance figures for
 * a provider/period, so an admin can see the exact amount `POST
 * /api/admin/payouts/provider` will require before recording it (that route
 * refuses any `amountThb` that does not match this calculation exactly).
 */
export async function GET(req: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.error

  try {
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

    const provider = await prisma.provider.findUnique({
      where: { id: providerId },
      select: { name: true },
    })
    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
    }

    const remittance = await computeProviderRemittance(prisma, providerId, periodStart, periodEnd)

    return NextResponse.json({ providerName: provider.name, remittance })
  } catch (error) {
    return handleError(error)
  }
}
