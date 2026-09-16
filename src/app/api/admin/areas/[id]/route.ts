import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, failed } from '@/app/libs/onboardingGuard';
import { updateArea } from '@/modules/projects';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;
  try {
    const body = await req.json();
    const area = await updateArea(prisma, params.id, {
      ...(body.slug !== undefined ? { slug: String(body.slug).trim() } : {}),
      ...(body.nameKey !== undefined ? { nameKey: String(body.nameKey).trim() } : {}),
      ...(body.descriptionKey !== undefined ? { descriptionKey: body.descriptionKey || null } : {}),
      ...(body.parentId !== undefined ? { parentId: body.parentId || null } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.sort !== undefined ? { sort: Number(body.sort) || 0 } : {}),
    });
    return NextResponse.json(area);
  } catch (error) {
    return failed(error, 'Failed to update area');
  }
}
