import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rollupMetricsDaily, detectBuyerSignals } from '@/modules/analytics';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Verify cron secret
  const secret = req.headers.get('Authorization');
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Rollup metrics for yesterday (or a specified date via query param)
    const dateParam = new URL(req.url).searchParams.get('date');
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
