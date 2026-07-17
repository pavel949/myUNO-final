import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  rollupMetricsDaily,
  rollupMetricsRange,
  detectBuyerSignals,
} from '@/modules/analytics';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Verify cron secret — refuse when unset ("Bearer undefined" must not authenticate)
  const cronSecret = process.env.CRON_SECRET;
  const secret = req.headers.get('Authorization');
  if (!cronSecret || secret !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const params = new URL(req.url).searchParams;
    const fromParam = params.get('from');
    const toParam = params.get('to');

    // Backfill mode: ?from=YYYY-MM-DD&to=YYYY-MM-DD (inclusive, ≤400 days)
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

    // Single-day mode: yesterday, or a specific ?date=
    const dateParam = params.get('date');
    const date = dateParam ? new Date(dateParam) : new Date(Date.now() - 24 * 60 * 60 * 1000);

    await rollupMetricsDaily(prisma, date);

    // Detect buyer signals
    await detectBuyerSignals(prisma);

    return NextResponse.json({
      success: true,
      message: `Rolled up metrics for ${date.toISOString().split('T')[0]}`,
    });
  } catch (error) {
    console.error('[Rollup] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Vercel Cron issues GET requests; same handler, same CRON_SECRET guard.
export const GET = POST;
