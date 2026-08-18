import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { completeMobilizationStep } from '@/modules/core';
import { requireAction, failed } from '@/app/libs/onboardingGuard';
import { logAudit } from '@/modules/audit';

/**
 * Complete one mobilization step.
 *
 * `completeMobilizationStep` refuses a step whose gate is not satisfied, so this
 * route deliberately adds no rules of its own beyond scoping. The 400 a caller
 * gets is the gate speaking, which is where that judgement belongs.
 *
 * Worth knowing what the gate actually covers, because it is narrower than doc
 * 07 reads: `mandate` requires an **active** engagement, and `golive_checklist`
 * requires a **confirmed** permitted-use record. Every other step is open. Doc
 * 07 says the mandate gates "no further steps until active", which would block
 * the steps *after* it — the code blocks only the mandate step itself. Widening
 * that is a tightening of a go-live gate, so it is Q43 rather than a change
 * made here.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  const guard = await requireAction('units:create');
  if (!guard.ok) return guard.error;

  try {
    // Scoped to the unit in the path rather than fetched-then-checked: a
    // checklist item id alone would let one unit's step be ticked through
    // another unit's route.
    const item = await prisma.mobilizationChecklistItem.findFirst({
      where: { id: params.itemId, unitId: params.id },
      select: { id: true, step: true },
    });
    if (!item) {
      return NextResponse.json(
        { error: 'Checklist item not found for this unit' },
        { status: 404 }
      );
    }

    const body = await req.json().catch(() => ({}));
    await completeMobilizationStep(prisma, params.itemId, guard.actorIdentityId, body.notes);

    await logAudit({
      actorIdentityId: guard.actorIdentityId,
      action: 'units:mobilization_step_completed',
      entityType: 'MobilizationChecklistItem',
      entityId: params.itemId,
      data: { unitId: params.id, step: item.step },
    });

    return NextResponse.json({ ok: true, step: item.step });
  } catch (error) {
    return failed(error, 'Failed to complete the step');
  }
}
