import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/app/libs/onboardingGuard';
import { runManagedYandexImport } from '@/modules/media';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/admin/media/import-managed — admin-triggered import of the managed
 * Yandex Disk photo folders (same runner as the scheduled cron). One call runs
 * for up to ~40s and returns a `next` cursor; the admin panel calls again with
 * it until `finished`. Idempotent: already-imported files are reused.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  const body = await req.json().catch(() => ({})) as { si?: unknown; offset?: unknown };
  const si = Number.isFinite(Number(body.si)) ? Number(body.si) : 0;
  const offset = Number.isFinite(Number(body.offset)) ? Number(body.offset) : 0;

  try {
    const result = await runManagedYandexImport(prisma, {
      si, offset, budgetMs: 40_000, actorIdentityId: guard.actorIdentityId,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 },
    );
  }
}
