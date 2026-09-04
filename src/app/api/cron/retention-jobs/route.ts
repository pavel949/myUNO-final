/**
 * POST /api/cron/retention-jobs
 * Daily retention: expired media, identity anonymisation, stale tokens,
 * passport scrub. Requires CRON_SECRET.
 *
 * Production scheduling goes through `/api/cron/run-all`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isCronAuthorized, cronUnauthorized, runRetentionJob } from '@/jobs';

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) return cronUnauthorized();

  const result = await runRetentionJob(prisma);
  if (!result.ok) {
    return NextResponse.json({ error: 'Retention jobs failed' }, { status: 500 });
  }

  return NextResponse.json(
    {
      success: true,
      summary: result.summary,
      ...result.result,
    },
    { status: 200 }
  );
}

export const GET = POST;
