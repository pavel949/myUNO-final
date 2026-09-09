import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/app/libs/onboardingGuard';
import { getProjectReadiness } from '@/modules/projects/readiness.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/projects/[id]/readiness
 * Returns every go-live blocker before activation so onboarding never relies
 * on trial-and-error form submission.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  try {
    const report = await getProjectReadiness(prisma, params.id);
    return NextResponse.json(report);
  } catch (error) {
    if (error instanceof Error && error.message === 'Project not found') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    throw error;
  }
}
