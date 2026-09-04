/**
 * POST /api/cron/check-tm30-escalations
 * Scheduled job to check and escalate TM30 filings approaching their deadline.
 * Requires CRON_SECRET bearer token.
 *
 * Prefer `/api/cron/run-frequent` in production (daytime daily slot).
 * This route remains for a manual invoke of TM30 alone.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isCronAuthorized, cronUnauthorized, runTm30EscalationsJob } from '@/jobs';

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) return cronUnauthorized();

  const result = await runTm30EscalationsJob(prisma);
  if (!result.ok) {
    return NextResponse.json({ error: 'Check failed' }, { status: 500 });
  }

  return NextResponse.json(
    {
      success: true,
      summary: result.summary,
    },
    { status: 200 }
  );
}

export const GET = POST;
