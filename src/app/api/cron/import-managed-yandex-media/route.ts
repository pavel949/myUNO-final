import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isCronAuthorized, cronUnauthorized } from '@/jobs';
import { importManagedYandexBatch, MANAGED_YANDEX_SOURCES } from '@/modules/media/managed-yandex-import';

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
export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) return cronUnauthorized();

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

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return cronUnauthorized();
  return NextResponse.json({
    sources: MANAGED_YANDEX_SOURCES.map(({ key, label, scope }) => ({ key, label, scope })),
  });
}
