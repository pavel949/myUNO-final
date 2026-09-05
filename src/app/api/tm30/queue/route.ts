/**
 * GET /api/tm30/queue?projectId=[projectId]
 * Get the TM30 filing queue for a project, sorted by due date.
 * Staff only. Returns filings with escalation countdowns.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { safeDecrypt } from '@/modules/ops';
import { getConfig } from '@/modules/config';
import { hasProjectStaffAccess } from '@/app/libs/projectScope';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.identityId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = req.nextUrl.searchParams.get('projectId');
    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 });
    }

    if (!hasProjectStaffAccess(user, projectId)) {
      return NextResponse.json(
        { error: 'Only staff can view TM30 queue' },
        { status: 403 }
      );
    }

    const filings = await prisma.tm30Filing.findMany({
      where: {
        status: { in: ['pending', 'escalated', 'failed'] },
        booking: { projectId },
      },
      include: {
        booking: {
          select: {
            id: true,
            startDate: true,
            unit: { select: { name: true } },
            project: { select: { name: true } },
          },
        },
        bookingGuest: { select: { fullName: true, nationality: true } },
      },
      orderBy: { dueAt: 'asc' },
    });

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
        id: filing.id,
        status: filing.status,
        dueAt: filing.dueAt.toISOString(),
        guestName: safeDecrypt(filing.bookingGuest?.fullName) || '—',
        nationality: filing.bookingGuest?.nationality || '—',
        unitName: filing.booking?.unit?.name || '—',
        projectName: filing.booking?.project?.name || '—',
        arrival: filing.booking?.startDate?.toISOString() || null,
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
