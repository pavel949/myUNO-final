import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isCronAuthorized, cronUnauthorized } from '@/jobs';
import { importManagedYandexBatch, runManagedYandexImport, MANAGED_YANDEX_SOURCES } from '@/modules/media';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/cron/import-managed-yandex-media
 *
 * One-off/batch-safe operational importer. Uses the canonical MediaAsset
 * storage seam and existing ProjectMedia / UnitMedia relations.
 *
 * Query:
 *   source=<managed source key>
 *   offset=<0-based offset>
 *   limit=<1..25, default 10>
 *
 * Protected by CRON_SECRET. Safe to repeat: source-path provenance makes each
 * imported file idempotent and already-created MediaAssets are reused.
 */
function isImportAuthorized(req: NextRequest) {
  if (isCronAuthorized(req)) return true;
  const token = process.env.MEDIA_IMPORT_TOKEN;
  return Boolean(token) && req.headers.get('authorization') === `Bearer ${token}`;
}

export async function POST(req: NextRequest) {
  if (!isImportAuthorized(req)) return cronUnauthorized();

  const source = req.nextUrl.searchParams.get('source') || '';
  const offset = Number(req.nextUrl.searchParams.get('offset') || '0');
  const limit = Number(req.nextUrl.searchParams.get('limit') || '10');

  if (!MANAGED_YANDEX_SOURCES.some(item => item.key === source)) {
    return NextResponse.json(
      { error: 'Unknown source', sources: MANAGED_YANDEX_SOURCES.map(item => item.key) },
      { status: 400 },
    );
  }

  try {
    const result = await importManagedYandexBatch(prisma, { sourceKey: source, offset, limit });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Managed media import failed' },
      { status: 500 },
    );
  }
}

/**
 * GET — the scheduled import. Vercel Cron calls the bare path with the
 * CRON_SECRET bearer and a `vercel-cron` user agent; `?run=all` does the same
 * by hand. Imports every source in batches within a time budget, then hands
 * the remaining cursor to a fresh invocation of itself, so one trigger
 * completes the catalogue under the 60s function cap. Idempotent: files
 * already imported are reused. Each run leaves an audit row
 * (managed_yandex_media_import_run) with per-source results and errors.
 *
 * A plain authorized GET from anything else keeps listing the sources.
 */
const RUN_BUDGET_MS = 40_000;

export async function GET(req: NextRequest) {
  if (!isImportAuthorized(req)) return cronUnauthorized();
  const scheduled = (req.headers.get('user-agent') ?? '').toLowerCase().includes('vercel-cron');
  if (!scheduled && req.nextUrl.searchParams.get('run') !== 'all') {
    return NextResponse.json({
      sources: MANAGED_YANDEX_SOURCES.map(({ key, label, scope }) => ({ key, label, scope })),
    });
  }

  const result = await runManagedYandexImport(prisma, {
    si: Number(req.nextUrl.searchParams.get('si') || '0'),
    offset: Number(req.nextUrl.searchParams.get('offset') || '0'),
    budgetMs: RUN_BUDGET_MS,
  });

  if (result.next) {
    const next = new URL(req.nextUrl.toString());
    next.searchParams.set('run', 'all');
    next.searchParams.set('si', String(result.next.si));
    next.searchParams.set('offset', String(result.next.offset));
    // Fire the continuation; the new invocation runs on its own even after
    // this request stops waiting for it.
    await fetch(next, {
      headers: { authorization: req.headers.get('authorization') ?? '' },
      signal: AbortSignal.timeout(2_000),
    }).catch(() => null);
  }

  return NextResponse.json({ success: true, ...result });
}
