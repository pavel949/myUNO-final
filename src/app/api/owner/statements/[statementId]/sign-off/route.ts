import { getCurrentUser } from '@/app/actions/getCurrentUser'
import { NextRequest, NextResponse } from 'next/server'
import prismadb from '@/app/libs/prismadb'
import {
  getStatementSignOffState,
  hasSignedOff,
  isOwnerVisibleStatementStatus,
  isSignableStatementStatus,
  recordStatementSignOff,
  StatementSignOffError,
} from '@/modules/finance'

export const dynamic = 'force-dynamic'

/**
 * An owner signing their own statement (Q33). Every other owner action sits
 * under `/api/owner/…`, so this one does too; the admin route keeps the
 * operator signature and the offline case (an admin recording a signature the
 * owner gave on paper).
 *
 * Scope is the query, not the UI: the statement must belong to the caller and
 * must have passed the admin sign-off gate — an owner cannot sign a draft they
 * are not allowed to read.
 */
export async function PUT(
  _req: NextRequest,
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

    const statement = await getStatementSignOffState(
      prismadb,
      params.statementId
    )

    // Another owner's statement is not "forbidden" to this owner — it does not
    // exist for them. Same answer either way, so nothing leaks.
    if (!statement || statement.ownerIdentityId !== currentUser.identityId) {
      return NextResponse.json(
        { error: 'Statement not found' },
        { status: 404 }
      )
    }

    if (hasSignedOff(statement, 'owner')) {
      return NextResponse.json(
        { error: 'The owner has already signed off this statement' },
        { status: 409 }
      )
    }

    // Two separate rules, and the owner needs both. A `draft` is signable —
    // that is the admin sign-off gate — but it is not *owner*-visible, so it is
    // not theirs to sign. A closed statement is the mirror case: readable for
    // their records, but finished. Either way the answer is the scope
    // convention above — for this owner, the statement is not addressable.
    if (
      !isOwnerVisibleStatementStatus(statement.status) ||
      !isSignableStatementStatus(statement.status)
    ) {
      return NextResponse.json(
        { error: 'Statement not found' },
        { status: 404 }
      )
    }

    const updated = await recordStatementSignOff(
      prismadb,
      params.statementId,
      'owner'
    )

    return NextResponse.json({
      success: true,
      statement: updated,
    })
  } catch (error) {
    // The checks above are the friendly path; these are the same checks losing
    // a race inside the lock, so they get the same answers.
    if (error instanceof StatementSignOffError) {
      if (error.reason === 'already_signed') {
        return NextResponse.json(
          { error: 'The owner has already signed off this statement' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: 'Statement not found' }, { status: 404 })
    }
    console.error('[OWNER STATEMENT SIGN OFF]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
