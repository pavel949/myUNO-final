import { PrismaClient } from '@prisma/client';

export interface CrmWorklistFilters {
  accountOwnerIdentityId?: string;
  now?: Date;
}

/**
 * One operational worklist across contact next-actions, opportunity actions and
 * explicit CRM tasks. The caller can scope it to an account owner; without a
 * filter an admin gets the team queue.
 */
export async function getCrmDailyWorklist(db: PrismaClient, filters: CrmWorklistFilters = {}) {
  const now = filters.now ?? new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const ownerFilter = filters.accountOwnerIdentityId
    ? { accountOwnerIdentityId: filters.accountOwnerIdentityId }
    : {};

  const [profiles, activities, opportunities] = await Promise.all([
    db.crmProfile.findMany({
      where: {
        ...ownerFilter,
        nextActionAt: { lte: endOfDay },
      },
      select: {
        id: true,
        identityId: true,
        lifecycleStage: true,
        leadScore: true,
        nextActionAt: true,
        lastInteractionAt: true,
        accountOwnerIdentityId: true,
        identity: { select: { firstName: true, lastName: true, email: true, phone: true } },
      },
      orderBy: [{ nextActionAt: 'asc' }, { leadScore: 'desc' }],
      take: 100,
    }),
    db.crmActivity.findMany({
      where: {
        status: 'open',
        dueAt: { lte: endOfDay },
        ...(filters.accountOwnerIdentityId
          ? { identity: { crmProfile: { accountOwnerIdentityId: filters.accountOwnerIdentityId } } }
          : {}),
      },
      select: {
        id: true,
        identityId: true,
        opportunityId: true,
        type: true,
        subject: true,
        dueAt: true,
        createdAt: true,
        identity: { select: { firstName: true, lastName: true } },
        opportunity: { select: { id: true, title: true, stage: true, valueThb: true } },
      },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
      take: 100,
    }),
    db.crmOpportunity.findMany({
      where: {
        stage: { notIn: ['won', 'lost'] },
        nextActionAt: { lte: endOfDay },
        ...(filters.accountOwnerIdentityId
          ? { identity: { crmProfile: { accountOwnerIdentityId: filters.accountOwnerIdentityId } } }
          : {}),
      },
      select: {
        id: true,
        identityId: true,
        title: true,
        type: true,
        stage: true,
        probability: true,
        valueThb: true,
        nextActionAt: true,
        expectedCloseAt: true,
        assignedToIdentityId: true,
        identity: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ nextActionAt: 'asc' }, { probability: 'desc' }],
      take: 100,
    }),
  ]);

  const isOverdue = (date: Date | null) => Boolean(date && date.getTime() < now.getTime());
  const weightedPipelineSatang = opportunities.reduce(
    (sum, opportunity) =>
      sum + Math.round(((opportunity.valueThb ?? 0) * opportunity.probability) / 100),
    0
  );

  return {
    generatedAt: now.toISOString(),
    ownerId: filters.accountOwnerIdentityId ?? null,
    summary: {
      contactsDue: profiles.length,
      tasksDue: activities.length,
      opportunitiesDue: opportunities.length,
      overdueTasks: activities.filter((a) => isOverdue(a.dueAt)).length,
      weightedPipelineSatang,
    },
    contacts: profiles.map((profile) => ({ ...profile, overdue: isOverdue(profile.nextActionAt) })),
    tasks: activities.map((activity) => ({ ...activity, overdue: isOverdue(activity.dueAt) })),
    opportunities: opportunities.map((opportunity) => ({
      ...opportunity,
      overdue: isOverdue(opportunity.nextActionAt),
    })),
  };
}
