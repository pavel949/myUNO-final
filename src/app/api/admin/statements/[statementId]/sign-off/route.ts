import { getCurrentUser } from '@/app/actions/getCurrentUser'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/app/libs/onboardingGuard'
import {
  getStatementSignOffState,
  hasSignedOff,
  isSignableStatementStatus,
  recordStatementSignOff,
  StatementSignOffError,
  type StatementSignOffActor,
} from '@/modules/finance'

export const dynamic = 'force-dynamic'

interface SignOffRequest {
  actor: StatementSignOffActor
}

/**
 * The operator (myUNO) signature, and an admin recording an owner's signature
 * taken offline — a signed paper statement, which the cash-first RU clientele
 * of CLAUDE.md still produces. The owner signing for themselves goes through
 * `PUT /api/owner/statements/{id}/sign-off` instead (Q33); both routes share
 * the state machine in `@/modules/finance`.
 */
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

    const statement = await getStatementSignOffState(
      prisma,
      params.statementId
    )

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
    if (body.actor === 'operator') {
      const adminGuard = await requireAdmin()
      if (!adminGuard.ok) {
        return adminGuard.error
      }
    }
    if (body.actor === 'owner' && !currentUser.isAdmin && !isOwnerOfStatement) {
      return NextResponse.json(
        { error: 'Forbidden. Only the statement owner can sign off as owner.' },
        { status: 403 }
      )
    }

    // Duplicate before closed: a signed_off statement is closed *and* already
    // carries a signature, and "you already signed" is the more specific answer.
    if (hasSignedOff(statement, body.actor)) {
      return NextResponse.json(
        {
          error: `The ${body.actor} has already signed off this statement`,
        },
        { status: 409 }
      )
    }

    // A closed statement (signed_off, distributed, superseded) is finished:
    // signing it again would re-stamp `approvedAt` and drag the status back to
    // `signed_off`, erasing the record that the money went out or that a
    // corrected statement replaced this one. A `draft` is *not* closed — signing
    // one is the admin sign-off gate itself — so it stays signable here.
    // Unlike the owner route, the admin gets told why.
    if (!isSignableStatementStatus(statement.status)) {
      return NextResponse.json(
        {
          error: `Statement is ${statement.status} and can no longer be signed`,
        },
        { status: 409 }
      )
    }

    const updated = await recordStatementSignOff(
      prisma,
      params.statementId,
      body.actor
    )

    return NextResponse.json({
      success: true,
      statement: updated,
    })
  } catch (error) {
    // Same checks as above, losing a race inside the lock.
    if (error instanceof StatementSignOffError) {
      if (error.reason === 'not_found') {
        return NextResponse.json(
          { error: 'Statement not found' },
          { status: 404 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    console.error('[STATEMENT SIGN OFF]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
