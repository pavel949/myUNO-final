import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  isCronAuthorized,
  cronUnauthorized,
  runNightlyJobs,
  dispatchFailed,
} from '@/jobs';

export const dynamic = 'force-dynamic';

/**
 * Nightly dispatcher (Vercel Hobby daily slot). Verification deadlines,
 * retention/PDPA, metric rollups, guest lifecycle sends, stale service
 * orders, ticket SLA, plus a defensive pass of hold expiry. iCal is the
 * daytime slot only — a slow feed must not starve this run.
 *
 * Each job is isolated: one failing job never blocks the others. Last run
 * and outcome are written to `job_run` for the admin scheduler panel.
 */
export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) return cronUnauthorized();

  const results = await runNightlyJobs(prisma);
  const failed = dispatchFailed(results);
  return NextResponse.json({ success: !failed, results }, { status: failed ? 500 : 200 });
}

// Vercel Cron issues GET requests; same handler, same CRON_SECRET guard.
export const GET = POST;
