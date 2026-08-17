import { getCurrentUser } from '@/app/actions/getCurrentUser'
import { NextRequest, NextResponse } from 'next/server'
import prismadb from '@/app/libs/prismadb'
import { voidDepositPreAuth } from '@/app/libs/deposits'

export const dynamic = 'force-dynamic'

interface RejectDamageClaimRequest {
  reason: string
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

    const body: RejectDamageClaimRequest = await req.json()

    if (!body.reason) {
      return NextResponse.json(
        { error: 'reason is required' },
        { status: 400 }
      )
    }

    const claimId = params.claimId

    // Get the claim
    const claim = await prismadb.depositClaim.findUnique({
      where: { id: claimId },
    })

    if (!claim) {
      return NextResponse.json(
        { error: 'Damage claim not found' },
        { status: 404 }
      )
    }

    if (claim.status !== 'filed') {
      return NextResponse.json(
        { error: `Claim cannot be rejected from status: ${claim.status}` },
        { status: 400 }
      )
    }

    // Void the deposit preauth (return funds to guest)
    try {
      await voidDepositPreAuth(claim.bookingId)
    } catch (err) {
      console.error('[REJECT DAMAGE CLAIM] Failed to void preauth:', err)
      // Continue; void failure is non-fatal
    }

    // Update claim status
    const updatedClaim = await prismadb.depositClaim.update({
      where: { id: claimId },
      data: {
        status: 'rejected',
        resolutionAt: new Date(),
        resolutionNote: body.reason,
      },
    })

    return NextResponse.json({
      success: true,
      claim: {
        id: updatedClaim.id,
        bookingId: updatedClaim.bookingId,
        status: updatedClaim.status,
        resolutionAt: updatedClaim.resolutionAt?.toISOString(),
        reason: body.reason,
      },
      message: 'Damage claim rejected',
    })
  } catch (error) {
    console.error('[REJECT DAMAGE CLAIM]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
