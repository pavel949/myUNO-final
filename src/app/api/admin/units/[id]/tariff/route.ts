import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/app/libs/onboardingGuard';
import { readTariffDraft, saveTariffDraft, validateTariffDraft, type TariffDraft } from '@/modules/core';

export const dynamic = 'force-dynamic';

/**
 * GET/PUT /api/admin/units/[id]/tariff — the admin rates editor.
 * PUT { draft, scope: 'unit' | 'category' } validates and saves the seasons,
 * monthly and yearly rates to this villa, or to every villa in its category.
 * Amounts are satang integers; nothing is charged or published by saving.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;
  const unit = await prisma.unit.findUnique({ where: { id: params.id }, select: { id: true, inventoryCategoryId: true } });
  if (!unit) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const categoryUnits = unit.inventoryCategoryId
    ? await prisma.unit.count({ where: { inventoryCategoryId: unit.inventoryCategoryId, status: { not: 'offboarded' } } })
    : 1;
  const draft = await readTariffDraft(prisma, unit.id);
  return NextResponse.json({ draft, categoryUnits, validation: validateTariffDraft(draft) });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;
  const body = await req.json().catch(() => null) as { draft?: TariffDraft; scope?: string } | null;
  if (!body?.draft || typeof body.draft !== 'object') return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  const unit = await prisma.unit.findUnique({ where: { id: params.id }, select: { id: true, inventoryCategoryId: true } });
  if (!unit) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const draft: TariffDraft = {
    includesTaxes: body.draft.includesTaxes, includesServiceCharge: body.draft.includesServiceCharge,
    includesBreakfast: body.draft.includesBreakfast,
    daily: Array.isArray(body.draft.daily) ? body.draft.daily : [],
    monthly: Array.isArray(body.draft.monthly) ? body.draft.monthly : [],
    yearly: body.draft.yearly ?? null,
  };
  const validation = validateTariffDraft(draft);
  if (validation.errors.length) return NextResponse.json({ error: 'invalid_tariff', validation }, { status: 422 });

  const unitIds = body.scope === 'category' && unit.inventoryCategoryId
    ? (await prisma.unit.findMany({
      where: { inventoryCategoryId: unit.inventoryCategoryId, status: { not: 'offboarded' } }, select: { id: true },
    })).map(u => u.id)
    : [unit.id];
  try {
    const saved = await saveTariffDraft(prisma, { unitIds, draft, actorIdentityId: guard.actorIdentityId });
    return NextResponse.json({ saved: saved.units, validation });
  } catch (error) {
    const issues = (error as { issues?: unknown }).issues;
    if (issues) return NextResponse.json({ error: 'invalid_tariff', validation: { errors: issues, dailyGaps: [], monthlyGaps: [] } }, { status: 422 });
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }
}
