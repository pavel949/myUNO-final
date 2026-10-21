import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/app/libs/onboardingGuard';
// Imported directly, like /api/integrations/layantara/events: the importer
// pulls node:crypto and the booking barrel, and the integrations barrel is
// reached from client bundles (owner statements → finance → comms) — adding
// it there fails `next build` (CLAUDE.md, module-boundary exception).
import {
  parseReservationsWorkbook, planWorkbookImport, applyWorkbookImport, WorkbookReconciliationRequired, type ImportPlan,
} from '@/modules/integrations/layantara/workbook-import';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_BYTES = 5 * 1024 * 1024;

function serializePlan(plan: ImportPlan, mode: 'preview' | 'apply') {
    const stays = plan.stays.map(s => ({
      key: s.key, ref: s.ref, unitCode: s.unitCode, guestName: s.guestName, channel: s.channel,
      sourceChannelName: s.sourceChannelName ?? null, startDate: s.startDate, endDate: s.endDate,
      sourceReservationTotalSatang: s.key !== s.ref ? null : s.sourceReservationTotalSatang,
      totalSatang: s.key !== s.ref ? null : s.totalSatang, paidSatang: s.key !== s.ref || !s.sourcePaymentAmountRaw?.trim() ? null : s.paidSatang, action: s.action, reason: s.reason ?? null,
      sourcePaymentStatus: s.sourcePaymentStatus, sourcePaymentAmountRaw: s.sourcePaymentAmountRaw,
      completeAfterImport: s.completeAfterImport, partyUnknown: s.partyUnknown,
      receivableStatus: s.review ? 'pending_reconciliation' : null,
    }));
    const sourceGroups = (plan.sourceGroups ?? []).map(g => ({ ref: g.ref, action: g.action, reason: g.reason, quotedTotalSatang: g.entry.totalSatang, allocation: 'unknown', placements: g.entry.placements.map(p => ({ unitCode: p.unitCode })) }));
    return { mode, sourceGroups, summary: plan.summary, problems: plan.problems, applyBlockers: plan.applyBlockers, untouchedProtections: plan.untouchedProtections, stays };
}

/**
 * POST /api/admin/layantara/reservations-import — the operator's reservations
 * workbook (.xlsx) becomes canonical bookings (founder ruling 2026-10-06).
 * multipart/form-data: file, mode=preview|apply. Preview never writes; apply
 * re-plans from the same file and runs it through the channel intake, so a
 * re-upload of an unchanged workbook is a no-op. Admin only; guest names are
 * returned to the admin screen and never logged.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  const mode = form?.get('mode') === 'apply' ? 'apply' : 'preview';
  if (!file || typeof file === 'string') return NextResponse.json({ error: 'file_required' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'file_too_large' }, { status: 413 });

  try {
    const parsed = parseReservationsWorkbook(new Uint8Array(await file.arrayBuffer()));
    const plan = await planWorkbookImport(prisma, parsed, new Date(), { reviewedSource: form?.get('sourceMode') === 'reviewed_source', ...(form?.get('scope') === 'current' ? { currentOnly: true } : {}) });
    const body = serializePlan(plan, mode);
    if (mode === 'preview') return NextResponse.json(body);
    const result = await applyWorkbookImport(prisma, plan, { actorIdentityId: guard.actorIdentityId });
    return NextResponse.json({ ...body, applied: result.applied, groups: result.groups, completed: result.completed, sourceGroupResults: result.sourceGroupResults });
  } catch (error) {
    if (error instanceof WorkbookReconciliationRequired) {
      return NextResponse.json({ ...serializePlan(error.plan, 'preview'), error: error.message }, { status: 422 });
    }
    const message = error instanceof Error ? error.message : 'import_failed';
    const known = /^(WORKBOOK_|LAYANTARA_)/.test(message);
    return NextResponse.json({ error: known ? message : 'import_failed' }, { status: known ? 422 : 500 });
  }
}

