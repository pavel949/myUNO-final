import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import {
  can,
  canWriteAvailabilityAndPricing,
  createPricingRule,
  getUnitPricingRules,
} from '@/modules/core';
import { logAudit } from '@/modules/audit';

/**
 * GET /api/units/[unitId]/pricing-rules
 * POST /api/units/[unitId]/pricing-rules
 *
 * Manual per-unit price overrides (doc 07 F-OPS-4, Q53) — a one-off nightly
 * rate for a specific booking window. `resolveNightlyPrice`
 * (src/modules/core/availability.service.ts) checks `PricingRule` *first*,
 * ahead of the season/category configuration path (doc 04 §4), so a rule
 * created here outranks every configured rate on its dates.
 *
 * This is a different shape from doc 04's `pricing.*` configuration group —
 * that group is a global/per-project *rule* (the season calendar, category
 * tariffs); this is a dated *record* for one unit, which is why it is a
 * schema model with a writer, not a config parameter.
 *
 * Permission: doc 03 §3 "Manage availability blocks & pricing rules" —
 * `units:manage_availability_and_pricing` (admin, staff_ops, mc_member scoped
 * to their units; owner is read-only). See the availability-blocks route for
 * why POST uses `canWriteAvailabilityAndPricing` instead of the bare
 * `can()` matrix check (Q58).
 */

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

  const rules = await getUnitPricingRules(prisma, unit.id);
  return NextResponse.json({
    rules: rules.map((r) => ({
      id: r.id,
      startDate: r.startDate.toISOString().slice(0, 10),
      endDate: r.endDate.toISOString().slice(0, 10),
      nightlyThb: r.nightlyThb,
      label: r.label,
      minNightsOverride: r.minNightsOverride,
      createdAt: r.createdAt.toISOString(),
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
    const { startDate, endDate, nightlyThb, label, minNightsOverride } = body ?? {};

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
    }
    if (typeof nightlyThb !== 'number') {
      return NextResponse.json({ error: 'nightlyThb (satang) is required' }, { status: 400 });
    }

    const rule = await createPricingRule(prisma, {
      unitId: unit.id,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      nightlyThb,
      label: typeof label === 'string' ? label.trim() || undefined : undefined,
      minNightsOverride: typeof minNightsOverride === 'number' ? minNightsOverride : undefined,
    });

    await logAudit({
      actorIdentityId,
      action: 'units:set_pricing_rule',
      entityType: 'PricingRule',
      entityId: rule.id,
      data: {
        unitId: unit.id,
        startDate: rule.startDate.toISOString().slice(0, 10),
        endDate: rule.endDate.toISOString().slice(0, 10),
        nightlyThb: rule.nightlyThb,
      },
    });

    return NextResponse.json(
      {
        id: rule.id,
        startDate: rule.startDate.toISOString().slice(0, 10),
        endDate: rule.endDate.toISOString().slice(0, 10),
        nightlyThb: rule.nightlyThb,
        label: rule.label,
        minNightsOverride: rule.minNightsOverride,
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to set that price override';
    return NextResponse.json({ error: message }, { status: /not found/i.test(message) ? 404 : 400 });
  }
}
