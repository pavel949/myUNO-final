import { getCurrentUser } from '@/app/actions/getCurrentUser'
import { NextRequest, NextResponse } from 'next/server'
import prismadb from '@/app/libs/prismadb'

export const dynamic = 'force-dynamic'

interface FileDamageClaimRequest {
  bookingId: string
  claimedAmountThb: number
  description: string
  evidenceMediaIds: string[]
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

    const body: FileDamageClaimRequest = await req.json()

    if (!body.bookingId || !body.description) {
      return NextResponse.json(
        { error: 'Missing required fields: bookingId, description' },
        { status: 400 }
      )
    }

    if (body.claimedAmountThb <= 0) {
      return NextResponse.json(
        { error: 'claimedAmountThb must be positive' },
        { status: 400 }
      )
    }

    // Verify booking exists
    const booking = await prismadb.booking.findUnique({
      where: { id: body.bookingId },
      include: { unit: true },
    })

    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      )
    }

    // Check if deposit preauth exists for this booking
    const depositPreauth = await prismadb.depositPreauth.findUnique({
      where: {
        bookingId: body.bookingId,
      },
    })

    // File the damage claim
    const claim = await prismadb.depositClaim.create({
      data: {
        bookingId: body.bookingId,
        claimantIdentityId: currentUser.identityId,
        description: body.description,
        claimedAmountThb: body.claimedAmountThb,
        status: 'filed',
        evidenceMediaIds: body.evidenceMediaIds || [],
        filedAt: new Date(),
      },
      include: {
        booking: true,
        claimant: true,
      },
    })

    return NextResponse.json(
      {
        success: true,
        claim: {
          id: claim.id,
          bookingId: claim.bookingId,
          claimedAmountThb: claim.claimedAmountThb,
          status: claim.status,
          description: claim.description,
          filedAt: claim.filedAt.toISOString(),
          hasDepositPreauth: !!depositPreauth,
          depositAmount: depositPreauth?.amountThb || null,
        },
        message: `Damage claim filed: ฿${claim.claimedAmountThb.toLocaleString()} for booking ${claim.bookingId}`,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[FILE DAMAGE CLAIM]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
