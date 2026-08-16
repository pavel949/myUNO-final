import { getCurrentUser } from '@/app/actions/getCurrentUser'
import { NextRequest, NextResponse } from 'next/server'
import prismadb from '@/app/libs/prismadb'
import {
  getStatementSignOffState,
  hasSignedOff,
  isSignableStatementStatus,
  recordStatementSignOff,
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

    // Visibility and write eligibility are separate decisions. A statement that
    // is closed (signed_off, distributed, superseded) is readable but not signable.
    if (!isSignableStatementStatus(statement.status)) {
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

    const updated = await recordStatementSignOff(prismadb, statement, 'owner')

    return NextResponse.json({
      success: true,
      statement: updated,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error'
    if (msg.includes('Conflict')) {
      return NextResponse.json(
        { error: 'The owner has already signed off this statement' },
        { status: 409 }
      )
    }
    console.error('[OWNER STATEMENT SIGN OFF]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
