import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  isCronAuthorized,
  cronUnauthorized,
  runFrequentJobs,
  dispatchFailed,
} from '@/jobs';

export const dynamic = 'force-dynamic';

/**
 * Daytime dispatcher (Vercel Hobby daily slot). Hold expiry, TM30
 * escalation, and iCal import. Hobby cannot fire more than once per day;
 * the matching night slot is `/api/cron/run-all`.
 *
 * Each job is isolated. Last run + outcome land on `job_run`.
 */
export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) return cronUnauthorized();

  const results = await runFrequentJobs(prisma);
  const failed = dispatchFailed(results);
  return NextResponse.json({ success: !failed, results }, { status: failed ? 500 : 200 });
}

export const GET = POST;
