import { getCurrentUser } from '@/app/actions/getCurrentUser'
import { NextRequest, NextResponse } from 'next/server'
import prismadb from '@/app/libs/prismadb'

export const dynamic = 'force-dynamic'

type LifecycleStage = 'contact' | 'guest' | 'repeat_guest' | 'investment_interest' | 'qualified_buyer' | 'purchaser' | 'owner' | 'managed_owner'

const VALID_TRANSITIONS: Record<LifecycleStage, LifecycleStage[]> = {
  contact: ['guest', 'investment_interest'],
  guest: ['repeat_guest', 'contact'],
  repeat_guest: ['investment_interest', 'contact'],
  investment_interest: ['qualified_buyer', 'contact'],
  qualified_buyer: ['purchaser', 'investment_interest'],
  purchaser: ['owner', 'qualified_buyer'],
  owner: ['managed_owner'],
  managed_owner: ['owner'],
}

interface TransitionRequest {
  to_stage: LifecycleStage
  reason: string
  notes?: Record<string, unknown>
}

export async function POST(
  req: NextRequest,
  { params }: { params: { profileId: string } }
) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser || !currentUser.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      )
    }

    const profileId = params.profileId
    const body: TransitionRequest = await req.json()

    if (!body.to_stage || !body.reason) {
      return NextResponse.json(
        { error: 'Missing required fields: to_stage, reason' },
        { status: 400 }
      )
    }

    // Fetch current profile
    const profile = await prismadb.crmProfile.findUnique({
      where: { id: profileId },
    })

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    const currentStage = profile.lifecycleStage as LifecycleStage

    // Validate transition
    if (!VALID_TRANSITIONS[currentStage]?.includes(body.to_stage)) {
      return NextResponse.json(
        {
          error: `Invalid transition from ${currentStage} to ${body.to_stage}`,
          validTargets: VALID_TRANSITIONS[currentStage] || [],
        },
        { status: 400 }
      )
    }

    // Require account owner for certain transitions
    if ((body.to_stage === 'qualified_buyer' || body.to_stage === 'owner' || body.to_stage === 'managed_owner') && !currentUser.identityId) {
      return NextResponse.json(
        { error: 'Account owner required for this transition' },
        { status: 400 }
      )
    }

    // Update profile with new stage
    const updatedProfile = await prismadb.crmProfile.update({
      where: { id: profileId },
      data: {
        lifecycleStage: body.to_stage,
        lifecycleChangedAt: new Date(),
        lifecycleChangeReason: body.reason,
        lifecycleChangeApprovedByIdentityId: currentUser.identityId,
        accountOwnerIdentityId:
          (body.to_stage === 'qualified_buyer' || body.to_stage === 'owner' || body.to_stage === 'managed_owner')
            ? currentUser.identityId
            : profile.accountOwnerIdentityId,
      },
    })

    // Create audit log entry
    await prismadb.crmLifecycleTransition.create({
      data: {
        profileId,
        fromStage: currentStage,
        toStage: body.to_stage,
        reason: body.reason,
        approvedByIdentityId: currentUser.identityId,
        notes: (body.notes || {}) as any,
      },
    })

    return NextResponse.json({
      success: true,
      profile: updatedProfile,
      message: `Transitioned from ${currentStage} to ${body.to_stage}`,
    })
  } catch (error) {
    console.error('[CRM TRANSITION]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
