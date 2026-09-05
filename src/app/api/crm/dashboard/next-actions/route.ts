import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/app/libs/onboardingGuard';

export async function GET(_req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  const now = new Date();
  const tomorrowStart = new Date(now);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  tomorrowStart.setHours(0, 0, 0, 0);

  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

  const [overdueTasks, todayTasks, tomorrowTasks, upcomingTasks] =
    await Promise.all([
      prisma.crmActivity.findMany({
        where: {
          type: 'task',
          status: 'open',
          dueAt: {
            lt: now,
          },
        },
        include: {
          opportunity: {
            select: {
              id: true,
              title: true,
              stage: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { dueAt: 'asc' },
        take: 10,
      }),
      prisma.crmActivity.findMany({
        where: {
          type: 'task',
          status: 'open',
          dueAt: {
            gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
            lt: new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate() + 1
            ),
          },
        },
        include: {
          opportunity: {
            select: {
              id: true,
              title: true,
              stage: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { dueAt: 'asc' },
      }),
      prisma.crmActivity.findMany({
        where: {
          type: 'task',
          status: 'open',
          dueAt: {
            gte: tomorrowStart,
            lt: tomorrowEnd,
          },
        },
        include: {
          opportunity: {
            select: {
              id: true,
              title: true,
              stage: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { dueAt: 'asc' },
      }),
      prisma.crmActivity.findMany({
        where: {
          type: 'task',
          status: 'open',
          dueAt: {
            gte: tomorrowEnd,
            lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          },
        },
        include: {
          opportunity: {
            select: {
              id: true,
              title: true,
              stage: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { dueAt: 'asc' },
      }),
    ]);

  const formatActivity = (activity: any) => ({
    id: activity.id,
    subject: activity.subject,
    dueAt: activity.dueAt?.toISOString() ?? null,
    opportunity: activity.opportunity
      ? {
          id: activity.opportunity.id,
          title: activity.opportunity.title,
          stage: activity.opportunity.stage,
        }
      : null,
    createdBy: activity.createdBy
      ? {
          id: activity.createdBy.id,
          name: `${activity.createdBy.firstName} ${activity.createdBy.lastName}`,
        }
      : null,
  });

  return NextResponse.json({
    overdue: overdueTasks.map(formatActivity),
    today: todayTasks.map(formatActivity),
    tomorrow: tomorrowTasks.map(formatActivity),
    upcoming: upcomingTasks.map(formatActivity),
  });
}
