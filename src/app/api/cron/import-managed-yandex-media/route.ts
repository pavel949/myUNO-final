import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isCronAuthorized, cronUnauthorized } from '@/jobs';
import { importManagedYandexBatch, MANAGED_YANDEX_SOURCES } from '@/modules/media';

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
 * GET ?run=all — the scheduled import (vercel.json cron; Vercel sends the
 * CRON_SECRET bearer). Imports every source in batches until a time budget
 * is spent, then hands the remaining cursor to a fresh invocation of itself,
 * so one trigger completes the whole catalogue within the 60s function cap.
 * Idempotent: files already imported are reused, so a repeat run is a no-op.
 *
 * Plain GET (no `run`) keeps listing the sources.
 */
const RUN_BUDGET_MS = 40_000;

export async function GET(req: NextRequest) {
  if (!isImportAuthorized(req)) return cronUnauthorized();
  if (req.nextUrl.searchParams.get('run') !== 'all') {
    return NextResponse.json({
      sources: MANAGED_YANDEX_SOURCES.map(({ key, label, scope }) => ({ key, label, scope })),
    });
  }

  const deadline = Date.now() + RUN_BUDGET_MS;
  let sourceIndex = Math.max(0, Number(req.nextUrl.searchParams.get('si') || '0'));
  let offset = Math.max(0, Number(req.nextUrl.searchParams.get('offset') || '0'));
  const imported: Array<{ source: string; created: number; reused: number; attached: number; errors: number }> = [];

  while (sourceIndex < MANAGED_YANDEX_SOURCES.length && Date.now() < deadline) {
    const source = MANAGED_YANDEX_SOURCES[sourceIndex];
    try {
      const batch = await importManagedYandexBatch(prisma, { sourceKey: source.key, offset, limit: 10 });
      imported.push({ source: source.key, created: batch.created, reused: batch.reused, attached: batch.attached, errors: batch.errors.length });
      if (batch.done) { sourceIndex += 1; offset = 0; } else { offset = batch.nextOffset; }
    } catch (error) {
      // One unreachable folder must not stop the others.
      imported.push({ source: source.key, created: 0, reused: 0, attached: 0, errors: 1 });
      sourceIndex += 1;
      offset = 0;
    }
  }

  const finished = sourceIndex >= MANAGED_YANDEX_SOURCES.length;
  if (!finished) {
    const next = new URL(req.nextUrl.toString());
    next.searchParams.set('si', String(sourceIndex));
    next.searchParams.set('offset', String(offset));
    // Fire the continuation; the new invocation runs on its own even after
    // this request stops waiting for it.
    await fetch(next, {
      headers: { authorization: req.headers.get('authorization') ?? '' },
      signal: AbortSignal.timeout(2_000),
    }).catch(() => null);
  }

  return NextResponse.json({ success: true, finished, next: finished ? null : { si: sourceIndex, offset }, imported });
}
