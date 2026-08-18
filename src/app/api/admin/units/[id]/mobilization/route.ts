import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getUnitMobilizationChecklist,
  initializeMobilizationChecklist,
  isMobilizationComplete,
} from '@/modules/core';
import { requireAction, failed } from '@/app/libs/onboardingGuard';
import { logAudit } from '@/modules/audit';

/**
 * A unit's mobilization checklist — the spine of doc 07 F-OWN-1.
 *
 * The gate logic (`checkMobilizationGate`, step ordering, no advancing past a
 * blocked step) was written and correct, but nothing called it and `createUnit`
 * never created a checklist — so every unit had none, and the gate never ran.
 *
 * Guarded on `units:create`, whose doc 03 capability is literally "Create
 * units, run mobilization checklist".
 */

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAction('units:create');
  if (!guard.ok) return guard.error;

  const [items, complete] = await Promise.all([
    getUnitMobilizationChecklist(prisma, params.id),
    isMobilizationComplete(prisma, params.id),
  ]);

  return NextResponse.json({ items, complete });
}

/** Start the checklist. Idempotent, so a retry repairs rather than duplicates. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAction('units:create');
  if (!guard.ok) return guard.error;

  try {
    const unit = await prisma.unit.findUnique({
      where: { id: params.id },
      select: { id: true },
    });
    if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });

    const { created } = await initializeMobilizationChecklist(prisma, params.id);

    // Only worth an audit entry when it actually created something; a no-op
    // retry writing an audit row would make the trail noisier, not clearer.
    if (created > 0) {
      await logAudit({
        actorIdentityId: guard.actorIdentityId,
        action: 'units:mobilization_started',
        entityType: 'Unit',
        entityId: params.id,
        data: { stepsCreated: created },
      });
    }

    const items = await getUnitMobilizationChecklist(prisma, params.id);
    return NextResponse.json({ items, created }, { status: created > 0 ? 201 : 200 });
  } catch (error) {
    return failed(error, 'Failed to start the mobilization checklist');
  }
}
