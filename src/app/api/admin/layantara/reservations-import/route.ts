import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/app/libs/onboardingGuard';
// Imported directly, like /api/integrations/layantara/events: the importer
// pulls node:crypto and the booking barrel, and the integrations barrel is
// reached from client bundles (owner statements → finance → comms) — adding
// it there fails `next build` (CLAUDE.md, module-boundary exception).
import {
  parseReservationsWorkbook, planWorkbookImport, applyWorkbookImport,
} from '@/modules/integrations/layantara/workbook-import';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_BYTES = 5 * 1024 * 1024;

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
    const plan = await planWorkbookImport(prisma, parsed);
    const stays = plan.stays.map(s => ({
      key: s.key, ref: s.ref, unitCode: s.unitCode, guestName: s.guestName, channel: s.channel,
      sourceChannelName: s.sourceChannelName ?? null, startDate: s.startDate, endDate: s.endDate,
      totalSatang: s.totalSatang, paidSatang: s.paidSatang, action: s.action, reason: s.reason ?? null,
      completeAfterImport: s.completeAfterImport,
    }));
    const body = { mode, summary: plan.summary, problems: plan.problems, untouchedProtections: plan.untouchedProtections, stays };
    if (mode === 'preview') return NextResponse.json(body);
    const result = await applyWorkbookImport(prisma, plan, { actorIdentityId: guard.actorIdentityId });
    return NextResponse.json({ ...body, applied: result.applied, groups: result.groups, completed: result.completed });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'import_failed';
    const known = /^(WORKBOOK_|LAYANTARA_)/.test(message);
    return NextResponse.json({ error: known ? message : 'import_failed' }, { status: known ? 422 : 500 });
  }
}
