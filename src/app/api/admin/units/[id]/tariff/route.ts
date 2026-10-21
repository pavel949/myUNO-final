import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUnitPricing } from '@/app/libs/pricingGuard';
import { PricingAccessError } from '@/modules/core/pricing-access';
import { readTariffEditorSnapshot, saveEmployeeTariffDraft, saveTariffSeasonAmount } from '@/modules/core/tariff-editor';
import { saveTariffDraft, validateTariffDraft, type TariffDraft } from '@/modules/core';

export const dynamic = 'force-dynamic';

/**
 * GET/PUT /api/admin/units/[id]/tariff — the admin rates editor.
 * PUT { draft, scope: 'unit' | 'category' } validates and saves the seasons,
 * monthly and yearly rates to this villa, or to every villa in its category.
 * Amounts are satang integers; nothing is charged or published by saving.
 */
export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const guard = await requireUnitPricing(params.id);
  if (!guard.ok) return guard.error;
  try {
    const snapshot = await readTariffEditorSnapshot(prisma, params.id, guard.isAdmin);
    return NextResponse.json({ ...snapshot, validation: validateTariffDraft(snapshot.draft) });
  } catch (error) {
    if (error instanceof PricingAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'load_failed' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const guard = await requireUnitPricing(params.id);
  if (!guard.ok) return guard.error;
  const body = await req.json().catch(() => null) as { draft?: TariffDraft; scope?: string; expectedRevision?: string } | null;
  if (!body || Object.keys(body).some(key => !['draft', 'scope', 'expectedRevision'].includes(key)))
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  if (body?.scope !== undefined && !['unit', 'category'].includes(body.scope))
    return NextResponse.json({ error: 'Invalid tariff scope' }, { status: 400 });
  if (!guard.isAdmin && body?.scope === 'category')
    return NextResponse.json({ error: 'Pricing editors save one assigned unit at a time' }, { status: 403 });
  if (!/^[a-f0-9]{64}$/.test(body.expectedRevision ?? '')) return NextResponse.json({ error: 'Reload the tariff editor before saving.' }, { status: 409 });
  if (body.scope === 'category' && !guard.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

  if (body.scope === 'category' && !unit.inventoryCategoryId) return NextResponse.json({ error: 'This unit has no category. Reload the editor.' }, { status: 409 });
  const unitIds = body.scope === 'category' && unit.inventoryCategoryId
    ? (await prisma.unit.findMany({
      where: { inventoryCategoryId: unit.inventoryCategoryId, status: { not: 'offboarded' } }, select: { id: true },
    })).map(u => u.id)
    : [unit.id];
  try {
    const saved = guard.isAdmin
      ? await saveTariffDraft(prisma, { unitIds, draft, actorIdentityId: guard.actorIdentityId, expectedRevision: body.expectedRevision!, ...(body.scope === 'category' ? { categoryId: unit.inventoryCategoryId! } : {}) })
      : await saveEmployeeTariffDraft(prisma, { unitId: unit.id, draft, actorIdentityId: guard.actorIdentityId, expectedRevision: body.expectedRevision! });
    return NextResponse.json({ saved: saved.units, revision: saved.revision, validation });
  } catch (error) {
    if (error instanceof PricingAccessError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    const issues = (error as { issues?: unknown }).issues;
    if (issues) return NextResponse.json({ error: 'invalid_tariff', validation: { errors: issues, dailyGaps: [], monthlyGaps: [] } }, { status: 422 });
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }
}

/** A matrix cell patch changes only one existing season's price. */
export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const guard = await requireUnitPricing(id);
  if (!guard.ok) return guard.error;
  if (!guard.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some(key => !['scope', 'expectedRevision', 'mode', 'seasonCode', 'amountSatang'].includes(key)) ||
      !['unit', 'category'].includes(body.scope) || !['daily', 'monthly'].includes(body.mode) ||
      typeof body.seasonCode !== 'string' || !/^[a-f0-9]{64}$/.test(body.expectedRevision ?? ''))
    return NextResponse.json({ error: 'invalid_range' }, { status: 400 });
  try {
    const unit = await prisma.unit.findUnique({ where: { id }, select: { inventoryCategoryId: true } });
    if (!unit) throw new PricingAccessError('not_found', 404);
    if (body.scope === 'category' && !unit.inventoryCategoryId) throw new PricingAccessError('category_missing', 409);
    const categoryId = body.scope === 'category' ? unit.inventoryCategoryId! : undefined;
    const ids = categoryId ? (await prisma.unit.findMany({ where: { inventoryCategoryId: categoryId, status: { not: 'offboarded' } }, select: { id: true } })).map(row => row.id) : [id];
    return NextResponse.json(await saveTariffSeasonAmount(prisma, { ...body, unitIds: ids, categoryId, actorIdentityId: guard.actorIdentityId }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof PricingAccessError ? error.message : 'load_failed' },
      { status: error instanceof PricingAccessError ? error.status : 500 });
  }
}
