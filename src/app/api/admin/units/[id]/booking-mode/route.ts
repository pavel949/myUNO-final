import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/app/libs/onboardingGuard';
import { updateUnit } from '@/modules/projects';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/admin/units/[id]/booking-mode { instantBook, scope: 'unit'|'category' }
 * Instant booking vs request-to-book for one villa or its whole category,
 * through the canonical updateUnit writer (audited there).
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;
  const body = await req.json().catch(() => null) as { instantBook?: unknown; scope?: unknown } | null;
  if (typeof body?.instantBook !== 'boolean') return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  const unit = await prisma.unit.findUnique({ where: { id: params.id }, select: { id: true, inventoryCategoryId: true } });
  if (!unit) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const ids = body.scope === 'category' && unit.inventoryCategoryId
    ? (await prisma.unit.findMany({ where: { inventoryCategoryId: unit.inventoryCategoryId, status: { not: 'offboarded' } }, select: { id: true } })).map(u => u.id)
    : [unit.id];
  for (const unitId of ids) {
    await updateUnit({ unitId, instantBook: body.instantBook, actorIdentityId: guard.actorIdentityId });
  }
  return NextResponse.json({ updated: ids.length, instantBook: body.instantBook });
}
