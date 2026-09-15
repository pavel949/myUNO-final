import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, failed } from '@/app/libs/onboardingGuard';
import { createInventoryCategory, listInventoryCategories } from '@/modules/projects';
import { bahtToSatang } from '@/lib/money';

/**
 * A project's sellable classes (audit F-1).
 *
 * Admin-only, under `projects:edit_and_set_live` — defining what a project
 * sells is a project-level commercial act, and doc 03 §3 marks that row ✅ for
 * admin alone. `requireAdmin` is the same guard the other project routes use.
 * Whether staff_ops or an MC member should also be able to define categories
 * is Q42's territory (who may set a unit's commercial terms) and is not
 * decided here.
 *
 * The wire carries baht because the form does; every stored amount is satang.
 * Conversion happens once, here, at the display boundary — never in the
 * service, so a second caller cannot pick a different convention.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  try {
    const body = await req.json();
    const baseNightlyBaht = Number(body.baseNightlyBaht);
    if (!Number.isFinite(baseNightlyBaht)) {
      return NextResponse.json({ error: 'baseNightlyBaht must be a number' }, { status: 400 });
    }

    const category = await createInventoryCategory(prisma, {
      projectId: params.id,
      categoryKey: String(body.categoryKey || '').trim(),
      name: String(body.name || '').trim(),
      bedrooms: Number(body.bedrooms),
      bathrooms: Number(body.bathrooms),
      maxGuests: Number(body.maxGuests),
      baseNightlyThb: bahtToSatang(baseNightlyBaht),
      minNights: body.minNights === undefined ? 1 : Number(body.minNights),
      cancellationPolicyKey: body.cancellationPolicyKey || null,
      actorIdentityId: guard.actorIdentityId,
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    return failed(error, 'Failed to create inventory category');
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  try {
    const categories = await listInventoryCategories(prisma, params.id);
    return NextResponse.json({ categories });
  } catch (error) {
    return failed(error, 'Failed to list inventory categories');
  }
}
