import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { setUnitOwner, getOwnershipHistory } from '@/modules/projects';
import { requireAdmin, failed } from '@/app/libs/onboardingGuard';
import { logAudit } from '@/modules/audit';

/**
 * Who owns a unit.
 *
 * `UpdateUnitInput` has no `ownerIdentityId` and `setUnitOwner` had no caller,
 * so once a unit was created its owner could not be set or changed through the
 * application at all — a sale, a transfer, or a plain correction needed direct
 * database access, and the chain-of-title model could never gain a second
 * period.
 *
 * Goes through `setUnitOwner` rather than writing the column, because ownership
 * is a dated fact: the service closes the outgoing period and opens the next on
 * the same half-open convention bookings use, inside one transaction. Writing
 * `unit.ownerIdentityId` directly would move the pointer and lose the history.
 *
 * Admin-only: this is title, not listing detail. Q42 covers whether staff
 * should be able to record a transfer.
 */

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  const history = await getOwnershipHistory(prisma, params.id);
  return NextResponse.json({ history });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  try {
    const body = await req.json();
    if (!body.ownerIdentityId) {
      return NextResponse.json({ error: 'ownerIdentityId is required' }, { status: 400 });
    }

    const owner = await prisma.identity.findUnique({
      where: { id: body.ownerIdentityId },
      select: { id: true },
    });
    if (!owner) {
      return NextResponse.json({ error: 'Owner identity not found' }, { status: 404 });
    }

    const result = await setUnitOwner(prisma, {
      unitId: params.id,
      ownerIdentityId: body.ownerIdentityId,
      recordedByIdentityId: guard.actorIdentityId,
      note: body.note,
      effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : undefined,
    });

    // A no-op re-assignment is reported honestly rather than logged as a
    // transfer that never happened.
    if (result.changed) {
      await logAudit({
        actorIdentityId: guard.actorIdentityId,
        action: 'units:owner_changed',
        entityType: 'Unit',
        entityId: params.id,
        data: { ownerIdentityId: body.ownerIdentityId, note: body.note ?? null },
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    return failed(error, 'Failed to set the owner');
  }
}
