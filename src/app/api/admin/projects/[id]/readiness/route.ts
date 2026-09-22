import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/app/libs/onboardingGuard';
import { getPropertyReadiness } from '@/modules/projects';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;
  const report = await getPropertyReadiness(prisma, params.id);
  return report
    ? NextResponse.json(report)
    : NextResponse.json({ error: 'Project not found' }, { status: 404 });
}
