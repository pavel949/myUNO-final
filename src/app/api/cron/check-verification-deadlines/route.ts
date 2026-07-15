/**
 * POST /api/cron/check-verification-deadlines
 * Scheduled job to check pre-arrival verification deadlines.
 * Transitions pending verifications to failed when deadline is missed.
 * Requires CRON_SECRET bearer token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkVerificationDeadlines } from '@/modules/ops';

export async function POST(req: NextRequest) {
  try {
    // Authenticate with CRON_SECRET
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || !authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await checkVerificationDeadlines(prisma);

    return NextResponse.json(
      {
        success: true,
        checked: result.checked,
        failed: result.failed,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Verification deadline check error:', error);
    return NextResponse.json(
      { error: 'Check failed' },
      { status: 500 }
    );
  }
}

// Vercel Cron issues GET requests; same handler, same CRON_SECRET guard.
export const GET = POST;
