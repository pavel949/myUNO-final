import { getCurrentUser } from '@/app/actions/getCurrentUser'
import { NextRequest, NextResponse } from 'next/server'
import prismadb from '@/app/libs/prismadb'
import { captureDepositPreAuth } from '@/app/libs/deposits'

export const dynamic = 'force-dynamic'

interface ApproveDamageClaimRequest {
  captureAmountThb: number
}

export async function POST(
  req: NextRequest,
  { params }: { params: { claimId: string } }
) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser || !currentUser.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      )
    }

    const body: ApproveDamageClaimRequest = await req.json()

    if (!body.captureAmountThb || body.captureAmountThb <= 0) {
      return NextResponse.json(
        { error: 'captureAmountThb must be positive' },
        { status: 400 }
      )
    }

    const claimId = params.claimId

    // Get the claim
    const claim = await prismadb.depositClaim.findUnique({
      where: { id: claimId },
      include: { booking: true },
    })

    if (!claim) {
      return NextResponse.json(
        { error: 'Damage claim not found' },
        { status: 404 }
      )
    }

    if (claim.status !== 'filed') {
      return NextResponse.json(
        { error: `Claim cannot be approved from status: ${claim.status}` },
        { status: 400 }
      )
    }

    // Check for deposit preauth
    const depositPreauth = await prismadb.payment.findFirst({
      where: {
        bookingId: claim.bookingId,
        purpose: 'deposit_preauth',
      },
    })

    if (!depositPreauth) {
      return NextResponse.json(
        { error: 'No deposit preauth found for this booking' },
        { status: 400 }
      )
    }

    // Cap capture at both preauth amount and claimed amount
    const actualCapture = Math.min(body.captureAmountThb, claim.claimedAmountThb, depositPreauth.amountThb)

    // Capture the preauth
    await captureDepositPreAuth(depositPreauth.id, claimId, actualCapture)

    // Update claim status
    const updatedClaim = await prismadb.depositClaim.update({
      where: { id: claimId },
      data: {
        status: 'approved',
        resolutionAt: new Date(),
        resolutionNote: `Approved and captured: ฿${actualCapture}`,
      },
    })

    return NextResponse.json({
      success: true,
      claim: {
        id: updatedClaim.id,
        bookingId: updatedClaim.bookingId,
        status: updatedClaim.status,
        claimedAmountThb: updatedClaim.claimedAmountThb,
        capturedAmountThb: actualCapture,
        resolutionAt: updatedClaim.resolutionAt?.toISOString(),
      },
      message: `Damage claim approved: ฿${actualCapture} captured from deposit preauth`,
    })
  } catch (error) {
    console.error('[APPROVE DAMAGE CLAIM]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
