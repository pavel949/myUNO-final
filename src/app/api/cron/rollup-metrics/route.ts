import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rollupMetricsRange } from '@/modules/analytics';
import { isCronAuthorized, cronUnauthorized, runMetricsRollupJob } from '@/jobs';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) return cronUnauthorized();

  try {
    const params = new URL(req.url).searchParams;
    const fromParam = params.get('from');
    const toParam = params.get('to');

    // Backfill mode: ?from=YYYY-MM-DD&to=YYYY-MM-DD (inclusive, ≤400 days)
    // Manual ops path — not a registered nightly job, so it does not stamp
    // last-run. A backfill must not look like the nightly rollup succeeded.
    if (fromParam && toParam) {
      const from = new Date(fromParam);
      const to = new Date(toParam);
      if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) {
        return NextResponse.json({ error: 'Invalid from/to range' }, { status: 400 });
      }
      const days = await rollupMetricsRange(prisma, from, to);
      return NextResponse.json({
        success: true,
        message: `Backfilled metrics for ${days} day(s) from ${fromParam}`,
      });
    }

    const result = await runMetricsRollupJob(prisma);
    if (!result.ok) {
      return NextResponse.json({ error: 'Unknown error' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      summary: result.summary,
    });
  } catch {
    return NextResponse.json({ error: 'Unknown error' }, { status: 500 });
  }
}

export const GET = POST;
