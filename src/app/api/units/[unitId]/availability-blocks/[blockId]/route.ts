import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { canWriteAvailabilityAndPricing, removeBlockedDate } from '@/modules/core';
import { logAudit } from '@/modules/audit';

/**
 * DELETE /api/units/[unitId]/availability-blocks/[blockId]
 * Remove a manual (or stale OTA-imported) block — frees the dates immediately.
 * See the route.ts in the parent directory for the flow this serves.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { unitId: string; blockId: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const identity = await prisma.identity.findUnique({ where: { id: user.identityId } });
  if (!identity) {
    return NextResponse.json({ error: 'Identity not found' }, { status: 404 });
  }

  const unit = await prisma.unit.findUnique({
    where: { id: params.unitId },
    select: { id: true, projectId: true },
  });
  if (!unit) {
    return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
  }

  const allowed = await canWriteAvailabilityAndPricing(identity, {
    projectId: unit.projectId,
    unitId: unit.id,
  });
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Scoped to the unit in the path rather than fetched-then-checked.
  const owned = await prisma.blockedDate.findFirst({
    where: { id: params.blockId, unitId: unit.id },
    select: { id: true },
  });
  if (!owned) {
    return NextResponse.json({ error: 'Block not found for this unit' }, { status: 404 });
  }

  try {
    const removed = await removeBlockedDate(prisma, params.blockId);

    await logAudit({
      actorIdentityId: identity.id,
      action: 'units:unblock_availability',
      entityType: 'BlockedDate',
      entityId: params.blockId,
      data: {
        unitId: unit.id,
        startDate: removed.startDate.toISOString().slice(0, 10),
        endDate: removed.endDate.toISOString().slice(0, 10),
        reason: removed.reason,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remove the block';
    return NextResponse.json({ error: message }, { status: /not found/i.test(message) ? 404 : 400 });
  }
}
