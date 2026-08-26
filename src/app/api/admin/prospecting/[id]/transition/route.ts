import { getCurrentUser } from '@/app/actions/getCurrentUser'
import { NextRequest, NextResponse } from 'next/server'
import { ProspectingAccountStatus } from '@prisma/client'
import prismadb from '@/app/libs/prismadb'

export const dynamic = 'force-dynamic'

interface TransitionRequest {
  status: ProspectingAccountStatus
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
    if (!currentUser.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 401 }
      )
    }

    const body: TransitionRequest = await req.json()

    if (!body.status) {
      return NextResponse.json(
        { error: 'Missing required field: status' },
        { status: 400 }
      )
    }

    const validStatuses: ProspectingAccountStatus[] = ['new', 'contacted', 'interested', 'pitched', 'closed']
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    const account = await prismadb.prospectingAccount.findUnique({
      where: { id: params.id },
    })

    if (!account) {
      return NextResponse.json(
        { error: 'Prospecting account not found' },
        { status: 404 }
      )
    }

    const updated = await prismadb.prospectingAccount.update({
      where: { id: params.id },
      data: {
        status: body.status,
        lastContactedAt: new Date(),
      },
      include: {
        identity: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      account: {
        id: updated.id,
        identityId: updated.identityId,
        identityName: `${updated.identity.firstName} ${updated.identity.lastName}`,
        identityEmail: updated.identity.email,
        accountType: updated.accountType,
        status: updated.status,
        reasonForContact: updated.reasonForContact,
        priority: updated.priority,
        assignedTo: updated.assignedTo ? {
          id: updated.assignedTo.id,
          email: updated.assignedTo.email,
          name: `${updated.assignedTo.firstName} ${updated.assignedTo.lastName}`,
        } : null,
        lastContactedAt: updated.lastContactedAt?.toISOString() || null,
        expectedCloseAt: updated.expectedCloseAt?.toISOString() || null,
        updatedAt: updated.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('[PROSPECTING TRANSITION]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
