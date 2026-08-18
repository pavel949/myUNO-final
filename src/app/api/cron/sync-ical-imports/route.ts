import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { syncAllICalAccounts } from '@/modules/integrations';

/**
 * Pull OTA calendars into the platform (T-039, doc 07 F-OPS-4).
 *
 * Every active iCal integration is fetched, parsed, and imported as
 * `blocked_date` rows so a unit sold on Airbnb stops being sellable here.
 * Overlaps with existing platform bookings are recorded as conflicts and
 * notified rather than silently resolved — the platform is the system of record,
 * so an OTA cannot cancel one of our stays.
 *
 * This handler previously stamped `lastSyncAt` and cleared `lastError` without
 * fetching anything, which meant the integration health panel reported every
 * feed green while nothing had ever been read. The work now lives in
 * `syncAllICalAccounts`, which only records success when a feed was actually
 * read, and leaves `lastSyncAt` untouched on failure so a feed broken for a week
 * cannot look freshly synced.
 */
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const summary = await syncAllICalAccounts(prisma);

    // 200 even when individual feeds failed: the job did its work, and the
    // per-feed state is on the accounts. A non-2xx here would make the cron
    // runner retry the healthy feeds too.
    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    console.error('[iCal sync cron] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync iCal imports' },
      { status: 500 }
    );
  }
}

// Vercel Cron issues GET requests; same handler, same CRON_SECRET guard.
export const GET = POST;
