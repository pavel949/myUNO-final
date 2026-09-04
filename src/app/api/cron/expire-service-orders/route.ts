import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  isCronAuthorized,
  cronUnauthorized,
  runServiceOrderExpiryJob,
} from '@/jobs';

/**
 * POST /api/cron/expire-service-orders — expire service orders past SLA.
 * Production scheduling goes through `/api/cron/run-all`.
 */
export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) return cronUnauthorized();

  const result = await runServiceOrderExpiryJob(prisma);
  if (!result.ok) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    summary: result.summary,
    ...result.result,
  });
}

export const GET = POST;
