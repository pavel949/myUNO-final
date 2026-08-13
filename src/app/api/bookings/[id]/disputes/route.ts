import { getCurrentUser } from '@/app/actions/getCurrentUser'
import { NextRequest, NextResponse } from 'next/server'
import prismadb from '@/app/libs/prismadb'

export const dynamic = 'force-dynamic'

interface RaiseDisputeRequest {
  claimId?: string
  description: string
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body: RaiseDisputeRequest = await req.json()

    if (!body.description) {
      return NextResponse.json(
        { error: 'description is required' },
        { status: 400 }
      )
    }

    const bookingId = params.id

    // Verify booking exists and user is authorized (guest or admin)
    const booking = await prismadb.booking.findUnique({
      where: { id: bookingId },
      include: { unit: { include: { project: true } } },
    })

    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      )
    }

    // Authorization: guest or admin
    const isGuest = booking.guestIdentityId === currentUser.identityId
    const isAdmin = currentUser.isAdmin

    if (!isGuest && !isAdmin) {
      return NextResponse.json(
        { error: 'Not authorized to raise dispute for this booking' },
        { status: 403 }
      )
    }

    // Get the damage claim if provided
    let claim = null
    if (body.claimId) {
      claim = await prismadb.depositClaim.findUnique({
        where: { id: body.claimId },
      })
      if (claim?.bookingId !== bookingId) {
        return NextResponse.json(
          { error: 'Claim does not match booking' },
          { status: 400 }
        )
      }
    }

    // Create a thread for the dispute
    const thread = await prismadb.thread.create({
      data: {
        contextType: 'booking_dispute',
        contextId: bookingId,
        projectId: booking.unit.projectId,
      },
    })

    // Add current user as participant
    await prismadb.threadParticipant.create({
      data: {
        threadId: thread.id,
        identityId: currentUser.identityId,
        participantRole: isGuest ? 'guest' : 'staff_ops',
      },
    })

    // Create a high-priority complaint ticket
    const ticket = await prismadb.ticket.create({
      data: {
        projectId: booking.unit.projectId,
        unitId: booking.unitId,
        raisedByIdentityId: currentUser.identityId,
        raisedByRole: isGuest ? 'guest' : 'staff_ops',
        categoryKey: 'dispute_complaint',
        title: claim
          ? `Dispute: Damage claim on booking ${bookingId}`
          : `Booking dispute: ${bookingId}`,
        description: body.description,
        priority: 'high',
        status: 'open',
        threadId: thread.id,
      },
    })

    // Attach evidence media if claim exists
    if (claim && claim.evidenceMediaIds && claim.evidenceMediaIds.length > 0) {
      for (const mediaId of claim.evidenceMediaIds) {
        try {
          await prismadb.ticketMedia.create({
            data: {
              ticketId: ticket.id,
              mediaId,
            },
          })
        } catch (error) {
          console.warn('[DISPUTE] Failed to attach media:', error)
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        ticket: {
          id: ticket.id,
          bookingId: booking.id,
          status: ticket.status,
          priority: ticket.priority,
          threadId: thread.id,
          createdAt: ticket.createdAt.toISOString(),
        },
        message: 'Dispute raised and escalated to admin team',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[RAISE DISPUTE]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
