import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createUnitEngagement, updateUnitEngagement, getUnitEngagements } from '@/modules/core';
import { requireAdmin, failed } from '@/app/libs/onboardingGuard';
import { logAudit } from '@/modules/audit';

/**
 * A unit's engagement — the **mandate** step of doc 07 F-OWN-1, and the reason
 * onboarding could not close.
 *
 * `createUnitEngagement` existed, was tested, and had no caller: no route, no
 * screen. Without an engagement a unit takes bookings happily and then refuses
 * to produce an owner statement ("Unit has no active engagement
 * configuration"), because the engagement is what selects the owner/estate
 * split (doc 02 §2.6) and carries the NOI cap.
 *
 * Admin-only. Doc 03's matrix has no row for setting a unit's commercial terms,
 * and inventing one would be writing policy the founder owns — so this takes
 * the narrow reading. Widening it to staff_ops is Q42.
 */

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  const engagements = await getUnitEngagements(prisma, params.id);
  return NextResponse.json({ engagements });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  try {
    const body = await req.json();

    // The owner is taken from the unit when the caller does not name one: the
    // mandate belongs to whoever holds the unit, and letting a request body
    // nominate an unrelated identity as owner would be a quiet title change.
    const unit = await prisma.unit.findUnique({
      where: { id: params.id },
      select: { ownerIdentityId: true },
    });
    if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });

    const ownerIdentityId = body.ownerIdentityId ?? unit.ownerIdentityId;
    if (!ownerIdentityId) {
      return NextResponse.json(
        { error: 'The unit has no owner yet. Set the owner before recording a mandate.' },
        { status: 400 }
      );
    }

    const engagement = await createUnitEngagement(prisma, {
      unitId: params.id,
      engagementType: body.engagementType,
      ownerIdentityId,
      noiCapAnnualThb: body.noiCapAnnualThb,
      feeOverridePct: body.feeOverridePct,
      setupFeeThb: body.setupFeeThb,
      mandateMediaId: body.mandateMediaId,
      managementOrgId: body.managementOrgId,
    });

    await logAudit({
      actorIdentityId: guard.actorIdentityId,
      action: 'units:record_engagement',
      entityType: 'UnitEngagement',
      entityId: engagement.id,
      data: {
        unitId: params.id,
        engagementType: body.engagementType,
        noiCapAnnualThb: body.noiCapAnnualThb ?? null,
      },
    });

    return NextResponse.json(engagement, { status: 201 });
  } catch (error) {
    return failed(error, 'Failed to record the engagement');
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  try {
    const body = await req.json();
    if (!body.engagementId) {
      return NextResponse.json({ error: 'engagementId is required' }, { status: 400 });
    }

    // Scoped to the unit in the path, not fetched-then-checked: an engagement id
    // alone would let one unit's mandate be edited through another's route.
    const owned = await prisma.unitEngagement.findFirst({
      where: { id: body.engagementId, unitId: params.id },
      select: { id: true },
    });
    if (!owned) {
      return NextResponse.json({ error: 'Engagement not found for this unit' }, { status: 404 });
    }

    await updateUnitEngagement(prisma, body.engagementId, {
      status: body.status,
      noiCapAnnualThb: body.noiCapAnnualThb,
      feeOverridePct: body.feeOverridePct,
      setupFeeThb: body.setupFeeThb,
      mandateMediaId: body.mandateMediaId,
      startsOn: body.startsOn ? new Date(body.startsOn) : undefined,
      endsOn: body.endsOn ? new Date(body.endsOn) : undefined,
    });

    await logAudit({
      actorIdentityId: guard.actorIdentityId,
      action: 'units:update_engagement',
      entityType: 'UnitEngagement',
      entityId: body.engagementId,
      data: { unitId: params.id, status: body.status ?? null },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return failed(error, 'Failed to update the engagement');
  }
}
