/**
 * POST /api/cron/retention-jobs
 * Scheduled job to run daily retention tasks:
 * - Delete expired media (passport images past delete_after)
 * - Anonymize identities with deletion requests past grace period
 * - Expire stale one-time tokens
 * Requires CRON_SECRET bearer token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { runRetentionJobs } from '@/modules/core';

export async function POST(req: NextRequest) {
  try {
    // Authenticate with CRON_SECRET
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || !authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Run all retention jobs
    const result = await runRetentionJobs(prisma);

    // Log the results
    await prisma.auditLog.create({
      data: {
        action: 'retention_jobs_completed',
        entityType: 'system',
        entityId: 'retention',
        actorIdentityId: 'system',
        data: result as any,
      },
    });

    return NextResponse.json(
      {
        success: true,
        deletedMedia: result.deletedMedia,
        anonymizedIdentities: result.anonymizedIdentities,
        expiredTokens: result.expiredTokens,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Retention jobs error:', error);
    return NextResponse.json(
      { error: 'Retention jobs failed' },
      { status: 500 }
    );
  }
}

// Vercel Cron issues GET requests; same handler, same CRON_SECRET guard.
export const GET = POST;
