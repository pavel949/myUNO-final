/**
 * POST /api/cron/check-tm30-escalations
 * Scheduled job to check and escalate TM30 filings approaching their deadline.
 * Requires CRON_SECRET bearer token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkTm30Escalations } from '@/modules/ops';

export async function POST(req: NextRequest) {
  try {
    // Authenticate with CRON_SECRET
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || !authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all projects
    const projects = await prisma.project.findMany({
      where: { status: 'live' },
    });

    let totalChecked = 0;
    let totalEscalated = 0;

    // Check escalations for each project
    for (const project of projects) {
      const result = await checkTm30Escalations(prisma, project.id);
      totalChecked += result.checked;
      totalEscalated += result.escalated;
    }

    return NextResponse.json(
      {
        success: true,
        checked: totalChecked,
        escalated: totalEscalated,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('TM30 escalation check error:', error);
    return NextResponse.json(
      { error: 'Check failed' },
      { status: 500 }
    );
  }
}
