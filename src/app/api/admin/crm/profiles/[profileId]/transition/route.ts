import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { CrmLifecycleStage } from '@prisma/client';
import { requireAdmin } from '@/app/libs/onboardingGuard';

export const dynamic = 'force-dynamic';

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
};

interface TransitionRequest {
  to_stage: CrmLifecycleStage;
  reason: string;
  notes?: Record<string, unknown>;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { profileId: string } }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  try {
    const body: TransitionRequest = await req.json();

    if (!body.to_stage || !body.reason) {
      return NextResponse.json(
        { error: 'Missing required fields: to_stage, reason' },
        { status: 400 }
      );
    }

    const profile = await prisma.crmProfile.findUnique({
      where: { id: params.profileId },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const currentStage = profile.lifecycleStage;

    if (!VALID_TRANSITIONS[currentStage]?.includes(body.to_stage)) {
      return NextResponse.json(
        {
          error: `Invalid transition from ${currentStage} to ${body.to_stage}`,
          validTargets: VALID_TRANSITIONS[currentStage] || [],
        },
        { status: 400 }
      );
    }

    const updatedProfile = await prisma.crmProfile.update({
      where: { id: params.profileId },
      data: {
        lifecycleStage: body.to_stage,
        lifecycleChangedAt: new Date(),
        lifecycleChangeReason: body.reason,
        lifecycleChangeApprovedBy: guard.actorIdentityId,
      },
    });

    await prisma.lifecycleTransitionLog.create({
      data: {
        profileId: params.profileId,
        fromStage: currentStage,
        toStage: body.to_stage,
        reason: body.reason,
        approvedByIdentityId: guard.actorIdentityId,
      },
    });

    return NextResponse.json({
      success: true,
      profile: updatedProfile,
      message: `Transitioned from ${currentStage} to ${body.to_stage}`,
    });
  } catch (error) {
    console.error('[CRM TRANSITION]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
