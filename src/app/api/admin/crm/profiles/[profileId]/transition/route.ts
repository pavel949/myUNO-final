import { getCurrentUser } from '@/app/actions/getCurrentUser'
import { NextRequest, NextResponse } from 'next/server'
import { CrmLifecycleStage } from '@prisma/client'
import prismadb from '@/app/libs/prismadb'

export const dynamic = 'force-dynamic'

// Lifecycle progression: contact → guest → repeat → prospect → investor → buyer → owner → managed
// Sideways: can regress in funnel or move to seller/former_client
const VALID_TRANSITIONS: Record<CrmLifecycleStage, CrmLifecycleStage[]> = {
  contact: ['guest', 'prospect'],
  guest: ['repeat', 'prospect', 'contact'],
  repeat: ['prospect', 'investor', 'guest'],
  prospect: ['investor', 'buyer', 'contact', 'guest'],
  investor: ['buyer', 'prospect'],
  buyer: ['owner', 'investor', 'prospect'],
  owner: ['managed', 'seller'],
  managed: ['owner', 'seller'],
  seller: ['owner', 'former_client'],
  former_client: ['contact', 'guest'],
}

interface TransitionRequest {
  to_stage: CrmLifecycleStage
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

    const currentStage = profile.lifecycleStage

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

    // Update profile with new stage and audit fields
    const updatedProfile = await prismadb.crmProfile.update({
      where: { id: profileId },
      data: {
        lifecycleStage: body.to_stage,
        lifecycleChangedAt: new Date(),
        lifecycleChangeReason: body.reason,
        lifecycleChangeApprovedBy: currentUser.identityId,
      },
    })

    // Create audit log entry
    await prismadb.lifecycleTransitionLog.create({
      data: {
        profileId,
        fromStage: currentStage,
        toStage: body.to_stage,
        reason: body.reason,
        approvedByIdentityId: currentUser.identityId,
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
