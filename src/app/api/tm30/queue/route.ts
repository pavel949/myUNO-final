/**
 * GET /api/tm30/queue?projectId=[projectId]
 * Get the TM30 filing queue for a project, sorted by due date.
 * Staff only. Returns filings with escalation countdowns.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getTm30Queue } from '@/modules/ops';
import { getConfig } from '@/modules/config';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.identityId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await prisma.identity.findUnique({
      where: { id: user.identityId },
    });

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check authorization: staff only
    const isStaff = await prisma.roleAssignment.findFirst({
      where: {
        identityId: currentUser.id,
        role: 'staff_ops',
        status: 'active',
      },
    });

    if (!isStaff) {
      return NextResponse.json(
        { error: 'Only staff can view TM30 queue' },
        { status: 403 }
      );
    }

    // Get projectId from query params
    const projectId = req.nextUrl.searchParams.get('projectId');
    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 });
    }

    // Verify staff has access to this project
    const projectAccess = await prisma.roleAssignment.findFirst({
      where: {
        identityId: currentUser.id,
        projectId,
        role: 'staff_ops',
        status: 'active',
      },
    });

    if (!projectAccess) {
      return NextResponse.json(
        { error: 'No access to this project' },
        { status: 403 }
      );
    }

    // Get TM30 queue sorted by due date
    const filings = await getTm30Queue(prisma, projectId);

    // Enrich with escalation info
    const now = new Date();
    const escalationHoursBefore =
      ((await getConfig(prisma, 'compliance.tm30_escalation_hours_before', {
        projectId,
      })) as number | undefined) || 6;

    const queue = filings.map((filing) => {
      const escalationThreshold = new Date(
        filing.dueAt.getTime() - escalationHoursBefore * 60 * 60 * 1000
      );
      const minutesUntilEscalation = Math.round(
        (escalationThreshold.getTime() - now.getTime()) / 1000 / 60
      );
      const minutesUntilDue = Math.round(
        (filing.dueAt.getTime() - now.getTime()) / 1000 / 60
      );

      return {
        ...filing,
        minutesUntilEscalation,
        minutesUntilDue,
        isEscalated: filing.status === 'escalated',
        isEscalationImminent: minutesUntilEscalation <= 0 && minutesUntilDue > 0,
      };
    });

    return NextResponse.json(
      {
        queue,
        total: queue.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('TM30 queue fetch error:', error);
    return NextResponse.json(
      { error: 'Queue fetch failed' },
      { status: 500 }
    );
  }
}
