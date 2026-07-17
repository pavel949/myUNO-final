import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkVerificationDeadlines } from '@/modules/ops';
import { runRetentionJobs } from '@/modules/core';
import { rollupMetricsDaily, detectBuyerSignals } from '@/modules/analytics';
import { expireHolds, autoDeclineRequests } from '@/modules/booking';

export const dynamic = 'force-dynamic';

/**
 * Daily dispatcher running the non-urgent scheduled jobs in one invocation.
 * Exists because Vercel's Hobby plan allows only 2 cron jobs — this covers
 * verification deadlines, retention/PDPA, and metric rollups; TM30 escalation
 * keeps its own (more frequent when the plan allows) schedule.
 * Each job is isolated: one failing job never blocks the others.
 */
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const secret = req.headers.get('Authorization');
  // Refuse when CRON_SECRET is unset — otherwise "Bearer undefined" authenticates.
  if (!cronSecret || secret !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: Record<string, string> = {};

  try {
    const expired = await expireHolds(prisma);
    const declined = await autoDeclineRequests(prisma);
    results.bookingLifecycle = `ok (${expired} holds expired, ${declined} requests auto-declined)`;
  } catch (error) {
    console.error('[Cron run-all] booking lifecycle failed:', error);
    results.bookingLifecycle = 'failed';
  }

  try {
    await checkVerificationDeadlines(prisma);
    results.verificationDeadlines = 'ok';
  } catch (error) {
    console.error('[Cron run-all] verification deadlines failed:', error);
    results.verificationDeadlines = 'failed';
  }

  try {
    await runRetentionJobs(prisma);
    results.retention = 'ok';
  } catch (error) {
    console.error('[Cron run-all] retention jobs failed:', error);
    results.retention = 'failed';
  }

  try {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await rollupMetricsDaily(prisma, yesterday);
    await detectBuyerSignals(prisma);
    results.rollup = 'ok';
  } catch (error) {
    console.error('[Cron run-all] metric rollup failed:', error);
    results.rollup = 'failed';
  }

  const failed = Object.values(results).includes('failed');
  return NextResponse.json({ success: !failed, results }, { status: failed ? 500 : 200 });
}

// Vercel Cron issues GET requests; same handler, same CRON_SECRET guard.
export const GET = POST;
