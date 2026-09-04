/**
 * POST /api/cron/check-verification-deadlines
 * Pre-arrival verification deadlines. Requires CRON_SECRET.
 *
 * Production scheduling goes through `/api/cron/run-all`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  isCronAuthorized,
  cronUnauthorized,
  runVerificationDeadlinesJob,
} from '@/jobs';

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) return cronUnauthorized();

  const result = await runVerificationDeadlinesJob(prisma);
  if (!result.ok) {
    return NextResponse.json({ error: 'Check failed' }, { status: 500 });
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
