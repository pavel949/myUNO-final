import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getProjectOnboardingDraft, saveProjectOnboardingDraft } from '@/modules/projects';
import { requireAdmin, failed } from '@/app/libs/onboardingGuard';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;
  try {
    const draft = await getProjectOnboardingDraft(prisma, params.id);
    return NextResponse.json({ draft });
  } catch (error) {
    return failed(error, 'Failed to load onboarding draft');
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;
  try {
    const body = await req.json();
    const draft = await saveProjectOnboardingDraft(prisma, {
      projectId: params.id,
      templateId: body.templateId === undefined ? undefined : (body.templateId || null),
      lastStage: body.lastStage === undefined ? undefined : (body.lastStage || null),
      stageData: body.stageData && typeof body.stageData === 'object' ? body.stageData : undefined,
      updatedByIdentityId: guard.actorIdentityId,
    });
    return NextResponse.json({ draft });
  } catch (error) {
    return failed(error, 'Failed to autosave onboarding draft');
  }
}
