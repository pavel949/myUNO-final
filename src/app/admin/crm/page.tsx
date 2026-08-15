import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { CrmDashboardClient } from '@/app/components/crm/CrmDashboardClient';

export const dynamic = 'force-dynamic';

export default async function CrmPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login?next=/admin/crm');
  }

  if (!user.isAdmin) {
    redirect('/');
  }

  // Fetch all opportunities with related data
  const opportunities = await prisma.crmOpportunity.findMany({
    include: {
      identity: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      assignedTo: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
        },
      },
      unit: {
        select: {
          id: true,
          name: true,
        },
      },
      activities: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          type: true,
          subject: true,
          createdAt: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Calculate summary stats
  const stages = [
    'new',
    'qualified',
    'discovery',
    'proposal',
    'negotiation',
    'nurture',
    'won',
    'lost',
  ];

  const stageBreakdown = stages.reduce((acc, stage) => {
    const oppsInStage = opportunities.filter((o) => o.stage === stage);
    acc[stage] = {
      count: oppsInStage.length,
      value: oppsInStage.reduce((sum, o) => sum + (o.valueThb ?? 0), 0),
      weightedValue: oppsInStage.reduce(
        (sum, o) => sum + ((o.valueThb ?? 0) * o.probability) / 100,
        0
      ),
    };
    return acc;
  }, {} as Record<string, { count: number; value: number; weightedValue: number }>);

  const totalDeals = opportunities.length;
  const totalValue = opportunities.reduce((sum, o) => sum + (o.valueThb ?? 0), 0);
  const weightedForecast = opportunities.reduce(
    (sum, o) => sum + ((o.valueThb ?? 0) * o.probability) / 100,
    0
  );

  const wonDeals = opportunities.filter((o) => o.stage === 'won');
  const winRate =
    totalDeals > 0 ? ((wonDeals.length / totalDeals) * 100).toFixed(1) : '0';

  // Get overdue tasks
  const now = new Date();
  const overdueTasks = await prisma.crmActivity.findMany({
    where: {
      type: 'task',
      status: 'open',
      dueAt: {
        lt: now,
      },
    },
    include: {
      identity: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      opportunity: {
        select: {
          id: true,
          title: true,
        },
      },
    },
    orderBy: { dueAt: 'asc' },
    take: 10,
  });

  // Get recent activities
  const recentActivities = await prisma.crmActivity.findMany({
    include: {
      identity: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      opportunity: {
        select: {
          id: true,
          title: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  const summary = {
    totalDeals,
    totalValue,
    weightedForecast,
    winRate,
    stageBreakdown,
  };

  // Serialize dates and transform identity to contact
  const serializedOpportunities = opportunities.map((opp) => ({
    ...opp,
    createdAt: opp.createdAt.toISOString(),
    updatedAt: opp.updatedAt.toISOString(),
    expectedCloseAt: opp.expectedCloseAt?.toISOString() || null,
    nextActionAt: opp.nextActionAt?.toISOString() || null,
    wonAt: opp.wonAt?.toISOString() || null,
    lostAt: opp.lostAt?.toISOString() || null,
    contact: opp.identity
      ? {
          id: opp.identity.id,
          name: `${opp.identity.firstName} ${opp.identity.lastName}`.trim(),
          email: opp.identity.email,
          phone: opp.identity.phone,
          avatar: null,
        }
      : null,
    assignedTo: opp.assignedTo
      ? {
          id: opp.assignedTo.id,
          name: `${opp.assignedTo.firstName} ${opp.assignedTo.lastName}`.trim(),
          email: opp.assignedTo.email,
        }
      : null,
    identity: undefined, // Remove the DB relation, keep only contact
    activities: opp.activities.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })),
  }));

  const serializedOverdueTasks = overdueTasks.map((task) => ({
    ...task,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    dueAt: task.dueAt?.toISOString() || null,
    completedAt: task.completedAt?.toISOString() || null,
    contact: task.identity
      ? {
          id: task.identity.id,
          name: `${task.identity.firstName} ${task.identity.lastName}`.trim(),
        }
      : null,
    identity: undefined,
  }));

  const serializedRecentActivities = recentActivities.map((activity) => ({
    ...activity,
    createdAt: activity.createdAt.toISOString(),
    updatedAt: activity.updatedAt.toISOString(),
    dueAt: activity.dueAt?.toISOString() || null,
    completedAt: activity.completedAt?.toISOString() || null,
    contact: activity.identity
      ? {
          id: activity.identity.id,
          name: `${activity.identity.firstName} ${activity.identity.lastName}`.trim(),
        }
      : null,
    identity: undefined,
  }));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            CRM Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage opportunities, track activities, and monitor deal pipeline
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          <CrmDashboardClient
            opportunities={serializedOpportunities}
            summary={summary}
            overdueTasks={serializedOverdueTasks}
            recentActivities={serializedRecentActivities}
          />
        </div>
      </div>
    </div>
  );
}
