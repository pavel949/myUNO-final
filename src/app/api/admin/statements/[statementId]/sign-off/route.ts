import { getCurrentUser } from '@/app/actions/getCurrentUser'
import { NextRequest, NextResponse } from 'next/server'
import prismadb from '@/app/libs/prismadb'
import { OwnerStatementStatus, Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

type SignOffActor = 'owner' | 'operator'

interface SignOffRequest {
  actor: SignOffActor
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { statementId: string } }
) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized. Authentication required.' },
        { status: 401 }
      )
    }

    let body: SignOffRequest
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        { error: 'Missing required fields: actor' },
        { status: 400 }
      )
    }

    if (body?.actor !== 'owner' && body?.actor !== 'operator') {
      return NextResponse.json(
        { error: 'Invalid actor. Expected "owner" or "operator".' },
        { status: 400 }
      )
    }

    const statement = await prismadb.ownerStatement.findUnique({
      where: { id: params.statementId },
      select: {
        id: true,
        ownerIdentityId: true,
        status: true,
        signedOffByOwnerAt: true,
        signedOffByOperatorAt: true,
      },
    })

    if (!statement) {
      return NextResponse.json(
        { error: 'Statement not found' },
        { status: 404 }
      )
    }

    // Scope: the operator side of the sign-off is myUNO's (admin only); the
    // owner side belongs to the statement's owner, and an admin may record it
    // on their behalf (a signed paper statement, doc 10 sign-off gate).
    const isOwnerOfStatement = currentUser.identityId === statement.ownerIdentityId
    if (body.actor === 'operator' && !currentUser.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden. Operator sign-off requires admin access.' },
        { status: 403 }
      )
    }
    if (body.actor === 'owner' && !currentUser.isAdmin && !isOwnerOfStatement) {
      return NextResponse.json(
        { error: 'Forbidden. Only the statement owner can sign off as owner.' },
        { status: 403 }
      )
    }

    const alreadySigned =
      body.actor === 'owner'
        ? statement.signedOffByOwnerAt
        : statement.signedOffByOperatorAt

    if (alreadySigned) {
      return NextResponse.json(
        {
          error: `The ${body.actor} has already signed off this statement`,
        },
        { status: 409 }
      )
    }

    const now = new Date()
    const data: Prisma.OwnerStatementUpdateInput =
      body.actor === 'owner'
        ? { signedOffByOwnerAt: now }
        : { signedOffByOperatorAt: now }

    // Both signatures present → the statement is signed off and can be
    // distributed; a single signature leaves it awaiting the other side.
    const otherSignature =
      body.actor === 'owner'
        ? statement.signedOffByOperatorAt
        : statement.signedOffByOwnerAt

    if (otherSignature) {
      data.status = 'signed_off' as OwnerStatementStatus
      data.approvedAt = now
    } else if (body.actor === 'operator') {
      // Operator signed first — the statement now waits on the owner.
      data.status = 'pending_owner_review' as OwnerStatementStatus
    }

    const updated = await prismadb.ownerStatement.update({
      where: { id: statement.id },
      data,
    })

    return NextResponse.json({
      success: true,
      statement: {
        id: updated.id,
        unitId: updated.unitId,
        status: updated.status,
        signedOffByOwnerAt: updated.signedOffByOwnerAt?.toISOString() ?? null,
        signedOffByOperatorAt:
          updated.signedOffByOperatorAt?.toISOString() ?? null,
        approvedAt: updated.approvedAt?.toISOString() ?? null,
      },
    })
  } catch (error) {
    console.error('[STATEMENT SIGN OFF]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
