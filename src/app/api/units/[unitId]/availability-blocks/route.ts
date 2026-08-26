import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import {
  can,
  canWriteAvailabilityAndPricing,
  createManualBlock,
  getUnitBlockedDates,
  type ManualBlockReason,
} from '@/modules/core';
import { logAudit } from '@/modules/audit';

/**
 * GET /api/units/[unitId]/availability-blocks
 * POST /api/units/[unitId]/availability-blocks
 *
 * Manual availability overrides for a unit's calendar (doc 07 F-OPS-4, Q53):
 * staff/admin taking a unit offline for maintenance, an owner stay, or
 * another operational reason. Reads through the same `BlockedDate` table the
 * automatic iCal-import job writes and `checkAvailability` /
 * `booking.service.ts`'s `claimDates` already check — a block created here
 * affects what a guest can book on the very next request.
 *
 * Permission: doc 03 §3 "Manage availability blocks & pricing rules" —
 * `units:manage_availability_and_pricing` (admin, staff_ops, mc_member scoped
 * to their units; owner is read-only). GET uses the doc 03 matrix check;
 * POST additionally excludes the owner's read-only grant
 * (`canWriteAvailabilityAndPricing` — see permissions.ts, Q58).
 */

const MANUAL_REASONS: ManualBlockReason[] = ['maintenance', 'owner_hold', 'other'];

async function loadIdentityAndUnit(unitId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;
  }
  const identity = await prisma.identity.findUnique({ where: { id: user.identityId } });
  if (!identity) {
    return { error: NextResponse.json({ error: 'Identity not found' }, { status: 404 }) } as const;
  }
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: { id: true, projectId: true },
  });
  if (!unit) {
    return { error: NextResponse.json({ error: 'Unit not found' }, { status: 404 }) } as const;
  }
  return { identity, unit, actorIdentityId: identity.id } as const;
}

export async function GET(_req: NextRequest, { params }: { params: { unitId: string } }) {
  const loaded = await loadIdentityAndUnit(params.unitId);
  if ('error' in loaded) return loaded.error;
  const { identity, unit } = loaded;

  const allowed = await can({
    identity,
    action: 'units:manage_availability_and_pricing',
    resource: { projectId: unit.projectId, unitId: unit.id },
  });
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const blocks = await getUnitBlockedDates(prisma, unit.id);
  return NextResponse.json({
    blocks: blocks.map((b) => ({
      id: b.id,
      startDate: b.startDate.toISOString().slice(0, 10),
      endDate: b.endDate.toISOString().slice(0, 10),
      reason: b.reason,
      note: b.note,
      externalRef: b.externalRef,
      createdAt: b.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest, { params }: { params: { unitId: string } }) {
  const loaded = await loadIdentityAndUnit(params.unitId);
  if ('error' in loaded) return loaded.error;
  const { identity, unit, actorIdentityId } = loaded;

  const allowed = await canWriteAvailabilityAndPricing(identity, {
    projectId: unit.projectId,
    unitId: unit.id,
  });
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { startDate, endDate, reason, note } = body ?? {};

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
    }
    if (!MANUAL_REASONS.includes(reason)) {
      return NextResponse.json(
        { error: `reason must be one of: ${MANUAL_REASONS.join(', ')}` },
        { status: 400 }
      );
    }

    const block = await createManualBlock(prisma, {
      unitId: unit.id,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      reason,
      note: typeof note === 'string' ? note.trim() || undefined : undefined,
      createdByIdentityId: actorIdentityId,
    });

    await logAudit({
      actorIdentityId,
      action: 'units:block_availability',
      entityType: 'BlockedDate',
      entityId: block.id,
      data: {
        unitId: unit.id,
        startDate: block.startDate.toISOString().slice(0, 10),
        endDate: block.endDate.toISOString().slice(0, 10),
        reason: block.reason,
      },
    });

    return NextResponse.json(
      {
        id: block.id,
        startDate: block.startDate.toISOString().slice(0, 10),
        endDate: block.endDate.toISOString().slice(0, 10),
        reason: block.reason,
        note: block.note,
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to block those dates';
    const code = (error as { code?: string })?.code;
    const status = code === 'BOOKING_CONFLICT' ? 409 : /not found/i.test(message) ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
