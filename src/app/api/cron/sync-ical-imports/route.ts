import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isCronAuthorized, cronUnauthorized, runIcalSyncJob } from '@/jobs';

/**
 * Pull OTA calendars into the platform (T-039, doc 07 F-OPS-4).
 *
 * Production scheduling goes through `/api/cron/run-frequent`. This route
 * remains for a manual invoke of iCal alone. 200 even when individual feeds
 * failed: the job did its work, and the per-feed state is on the accounts.
 */
export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) return cronUnauthorized();

  const result = await runIcalSyncJob(prisma);
  if (!result.ok) {
    return NextResponse.json({ error: 'Failed to sync iCal imports' }, { status: 500 });
  }

  return NextResponse.json({ success: true, summary: result.summary, ...result.result }, { status: 200 });
}

export const GET = POST;
