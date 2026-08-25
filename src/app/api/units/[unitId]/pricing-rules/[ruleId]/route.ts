import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { canWriteAvailabilityAndPricing, removePricingRule } from '@/modules/core';
import { logAudit } from '@/modules/audit';

/**
 * DELETE /api/units/[unitId]/pricing-rules/[ruleId]
 * Remove a price override — the night falls back through the doc 04 §4 chain
 * (category seasonal rate → base × season markup → base) on the next read.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { unitId: string; ruleId: string } }
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
  const owned = await prisma.pricingRule.findFirst({
    where: { id: params.ruleId, unitId: unit.id },
    select: { id: true },
  });
  if (!owned) {
    return NextResponse.json({ error: 'Pricing rule not found for this unit' }, { status: 404 });
  }

  try {
    const removed = await removePricingRule(prisma, params.ruleId);

    await logAudit({
      actorIdentityId: identity.id,
      action: 'units:remove_pricing_rule',
      entityType: 'PricingRule',
      entityId: params.ruleId,
      data: {
        unitId: unit.id,
        startDate: removed.startDate.toISOString().slice(0, 10),
        endDate: removed.endDate.toISOString().slice(0, 10),
        nightlyThb: removed.nightlyThb,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remove the pricing rule';
    return NextResponse.json({ error: message }, { status: /not found/i.test(message) ? 404 : 400 });
  }
}
