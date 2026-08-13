import { getCurrentUser } from '@/app/actions/getCurrentUser'
import { NextRequest, NextResponse } from 'next/server'
import prismadb from '@/app/libs/prismadb'

export const dynamic = 'force-dynamic'

interface SignOffRequest {
  actor: 'owner' | 'operator'
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

    const body: SignOffRequest = await req.json()

    if (!body.actor || !['owner', 'operator'].includes(body.actor)) {
      return NextResponse.json(
        { error: 'Missing or invalid actor: must be "owner" or "operator"' },
        { status: 400 }
      )
    }

    const statement = await prismadb.ownerStatement.findUnique({
      where: { id: params.statementId },
      include: {
        owner: { select: { id: true } },
        engagement: true,
      },
    })

    if (!statement) {
      return NextResponse.json(
        { error: 'Statement not found' },
        { status: 404 }
      )
    }

    // Authorization checks
    if (body.actor === 'owner') {
      // Only the statement owner can sign off as owner
      if (currentUser.identityId !== statement.ownerIdentityId) {
        return NextResponse.json(
          { error: 'Forbidden. Only the statement owner can sign off.' },
          { status: 403 }
        )
      }

      // Already signed by owner?
      if (statement.signedOffByOwnerAt) {
        return NextResponse.json(
          { error: 'Statement already signed off by owner' },
          { status: 409 }
        )
      }

      const updated = await prismadb.ownerStatement.update({
        where: { id: params.statementId },
        data: {
          signedOffByOwnerAt: new Date(),
          status: statement.signedOffByOperatorAt ? 'signed_off' : 'pending_owner_review',
        },
      })

      return NextResponse.json({
        success: true,
        statement: updated,
        message: 'Statement signed off by owner',
      })
    } else {
      // Operator sign-off requires admin role
      if (!currentUser.isAdmin) {
        return NextResponse.json(
          { error: 'Forbidden. Only admin can operator-sign statements.' },
          { status: 403 }
        )
      }

      // Already signed by operator?
      if (statement.signedOffByOperatorAt) {
        return NextResponse.json(
          { error: 'Statement already signed off by operator' },
          { status: 409 }
        )
      }

      const updated = await prismadb.ownerStatement.update({
        where: { id: params.statementId },
        data: {
          signedOffByOperatorAt: new Date(),
          status: statement.signedOffByOwnerAt ? 'signed_off' : 'pending_owner_review',
        },
      })

      return NextResponse.json({
        success: true,
        statement: updated,
        message: 'Statement signed off by operator',
      })
    }
  } catch (error) {
    console.error('[STATEMENT SIGN OFF]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
