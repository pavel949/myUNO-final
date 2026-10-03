import type {
  OperationalTaskStatus,
  OperationalTaskType,
  PrismaClient,
} from '@prisma/client';

const OPEN_STATUSES: OperationalTaskStatus[] = ['planned', 'assigned', 'in_progress', 'inspected', 'blocked'];

export type UnitReadinessState =
  | 'ready'
  | 'needs_cleaning'
  | 'needs_inspection'
  | 'in_progress';

export async function ensureTurnoverTasksForCheckout(
  db: PrismaClient,
  booking: {
    id: string;
    projectId: string;
    unitId: string;
    checkedOutAt: Date | null;
    endDate: Date;
  }
) {
  const dueAt = booking.checkedOutAt ?? booking.endDate;
  const taskTypes: OperationalTaskType[] = ['turnover_cleaning', 'turnover_inspection'];

  return Promise.all(taskTypes.map((taskType) =>
    db.operationalTask.upsert({
      where: {
        bookingId_taskType: {
          bookingId: booking.id,
          taskType,
        },
      },
      create: {
        projectId: booking.projectId,
        unitId: booking.unitId,
        bookingId: booking.id,
        taskType,
        status: 'planned',
        dueAt,
      },
      update: {
        dueAt,
      },
    })
  ));
}

export async function assertUnitReadyForCheckIn(
  db: PrismaClient,
  unitId: string
) {
  const blockers = await db.operationalTask.findMany({
    where: {
      unitId,
      taskType: { in: ['turnover_cleaning', 'turnover_inspection'] },
      status: { in: OPEN_STATUSES },
    },
    select: { id: true, taskType: true, status: true, dueAt: true },
    orderBy: [{ dueAt: 'asc' }, { taskType: 'asc' }],
  });
  if (blockers.length) {
    const error = new Error('Unit is not ready for check-in');
    (error as Error & { code?: string; blockers?: typeof blockers }).code = 'UNIT_NOT_READY';
    (error as Error & { blockers?: typeof blockers }).blockers = blockers;
    throw error;
  }
}

const TRANSITIONS: Record<OperationalTaskStatus, OperationalTaskStatus[]> = {
  planned: ['assigned', 'in_progress', 'blocked', 'cancelled'],
  assigned: ['in_progress', 'blocked', 'cancelled'],
  in_progress: ['inspected', 'blocked', 'ready', 'cancelled'],
  inspected: ['ready', 'in_progress', 'blocked', 'cancelled'],
  blocked: ['planned', 'assigned', 'in_progress', 'cancelled'],
  ready: [],
  cancelled: [],
};

export async function transitionOperationalTask(
  db: PrismaClient,
  taskId: string,
  nextStatus: OperationalTaskStatus,
  input: { assignedIdentityId?: string | null; notes?: string | null } = {}
) {
  return db.$transaction(async (tx) => {
    const task = await tx.operationalTask.findUnique({ where: { id: taskId } });
    if (!task) throw new Error('Operational task not found');
    if (task.status !== nextStatus && !TRANSITIONS[task.status].includes(nextStatus)) {
      throw new Error(`Invalid operational task transition: ${task.status} → ${nextStatus}`);
    }
    const now = new Date();
    return tx.operationalTask.update({
      where: { id: taskId },
      data: {
        status: nextStatus,
        ...(input.assignedIdentityId !== undefined
          ? { assignedIdentityId: input.assignedIdentityId }
          : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(nextStatus === 'in_progress' && !task.startedAt ? { startedAt: now } : {}),
        ...(nextStatus === 'inspected' ? { inspectedAt: now } : {}),
        ...(nextStatus === 'ready' ? { readyAt: now, completedAt: now } : {}),
      },
    });
  });
}

export async function getUnitReadinessMap(
  db: PrismaClient,
  unitIds: string[]
): Promise<Record<string, { state: UnitReadinessState; openTaskCount: number }>> {
  const result: Record<string, { state: UnitReadinessState; openTaskCount: number }> =
    Object.fromEntries(unitIds.map((id) => [id, { state: 'ready', openTaskCount: 0 }]));
  if (!unitIds.length) return result;

  const tasks = await db.operationalTask.findMany({
    where: {
      unitId: { in: unitIds },
      status: { in: OPEN_STATUSES },
    },
    select: { unitId: true, taskType: true, status: true },
  });

  for (const task of tasks) {
    const current = result[task.unitId] ?? { state: 'ready' as const, openTaskCount: 0 };
    current.openTaskCount += 1;
    if (task.status === 'in_progress' || task.status === 'inspected') {
      current.state = 'in_progress';
    } else if (current.state !== 'in_progress' && task.taskType === 'turnover_cleaning') {
      current.state = 'needs_cleaning';
    } else if (
      current.state === 'ready' &&
      task.taskType === 'turnover_inspection'
    ) {
      current.state = 'needs_inspection';
    }
    result[task.unitId] = current;
  }
  return result;
}

export async function listOperationalTasks(
  db: PrismaClient,
  input: { projectIds?: string[]; unitId?: string; unitIds?: string[]; statuses?: OperationalTaskStatus[] } = {}
) {
  const scopedRead = input.projectIds !== undefined || input.unitIds !== undefined;
  const visibility = input.unitId
    ? { unitId: input.unitId }
    : scopedRead && !input.projectIds?.length && !input.unitIds?.length
      ? { id: '__no_authorized_operational_task__' }
    : input.projectIds?.length && input.unitIds?.length
      ? {
          OR: [
            { projectId: { in: input.projectIds } },
            { unitId: { in: input.unitIds } },
          ],
        }
      : input.projectIds?.length
        ? { projectId: { in: input.projectIds } }
        : input.unitIds?.length
          ? { unitId: { in: input.unitIds } }
          : {};

  return db.operationalTask.findMany({
    where: {
      ...visibility,
      ...(input.statuses?.length ? { status: { in: input.statuses } } : {}),
    },
    include: {
      unit: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      operatingSpace: { select: { id: true, name: true } },
      assignedTeam: { select: { id: true, name: true, teamType: true } },
      assignee: { select: { id: true, firstName: true, lastName: true } },
      media: { include: { media: true }, orderBy: { sortOrder: 'asc' } },
    },
    orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
  });
}


export interface CreateOperationalTaskInput {
  projectId: string;
  unitId: string;
  operatingSpaceId?: string | null;
  bookingId?: string | null;
  taskType: OperationalTaskType;
  title?: string | null;
  description?: string | null;
  priority?: string;
  dueAt: Date;
  assignedIdentityId?: string | null;
  assignedTeamId?: string | null;
  estimatedCostSatang?: number | null;
  actualCostSatang?: number | null;
  blocksInventory?: boolean;
  notes?: string | null;
  mediaAssetIds?: string[];
}

export async function createOperationalTask(
  db: PrismaClient,
  input: CreateOperationalTaskInput,
) {
  if (!input.projectId || !input.unitId) throw new Error('TASK_SCOPE_REQUIRED');
  if (!(input.dueAt instanceof Date) || Number.isNaN(input.dueAt.getTime())) {
    throw new Error('TASK_DUE_AT_INVALID');
  }
  if ((input.estimatedCostSatang ?? 0) < 0 || (input.actualCostSatang ?? 0) < 0) {
    throw new Error('TASK_COST_INVALID');
  }

  const unit = await db.unit.findFirst({
    where: { id: input.unitId, projectId: input.projectId },
    select: { id: true, projectId: true },
  });
  if (!unit) throw new Error('TASK_UNIT_NOT_FOUND');

  if (input.operatingSpaceId) {
    const membership = await db.operatingSpaceUnit.findFirst({
      where: {
        operatingSpaceId: input.operatingSpaceId,
        unitId: input.unitId,
        active: true,
        OR: [{ endsOn: null }, { endsOn: { gt: new Date() } }],
      },
      select: { id: true },
    });
    if (!membership) throw new Error('TASK_UNIT_OUTSIDE_OPERATING_SPACE');
  }

  if (input.assignedTeamId) {
    const team = await db.operatingTeam.findFirst({
      where: {
        id: input.assignedTeamId,
        active: true,
        ...(input.operatingSpaceId ? { operatingSpaceId: input.operatingSpaceId } : {}),
      },
      select: { id: true },
    });
    if (!team) throw new Error('TASK_TEAM_NOT_FOUND');
  }

  const mediaIds = Array.from(new Set(input.mediaAssetIds ?? []));
  if (mediaIds.length) {
    const mediaCount = await db.mediaAsset.count({ where: { id: { in: mediaIds } } });
    if (mediaCount !== mediaIds.length) throw new Error('TASK_MEDIA_NOT_FOUND');
  }

  return db.operationalTask.create({
    data: {
      projectId: input.projectId,
      unitId: input.unitId,
      operatingSpaceId: input.operatingSpaceId ?? null,
      bookingId: input.bookingId ?? null,
      taskType: input.taskType,
      status: input.assignedIdentityId || input.assignedTeamId ? 'assigned' : 'planned',
      title: input.title ?? null,
      description: input.description ?? null,
      priority: input.priority ?? 'normal',
      dueAt: input.dueAt,
      assignedIdentityId: input.assignedIdentityId ?? null,
      assignedTeamId: input.assignedTeamId ?? null,
      estimatedCostSatang: input.estimatedCostSatang ?? null,
      actualCostSatang: input.actualCostSatang ?? null,
      blocksInventory: input.blocksInventory ?? false,
      notes: input.notes ?? null,
      ...(mediaIds.length ? {
        media: {
          create: mediaIds.map((mediaAssetId, sortOrder) => ({ mediaAssetId, sortOrder })),
        },
      } : {}),
    },
    include: {
      project: { select: { id: true, name: true } },
      unit: { select: { id: true, name: true } },
      assignee: { select: { id: true, firstName: true, lastName: true } },
      assignedTeam: { select: { id: true, name: true, teamType: true } },
      media: { include: { media: true }, orderBy: { sortOrder: 'asc' } },
    },
  });
}

export interface CreatePreventiveMaintenancePlanInput {
  operatingSpaceId: string;
  projectId?: string | null;
  unitId?: string | null;
  assignedTeamId?: string | null;
  assignedIdentityId?: string | null;
  taskType?: OperationalTaskType;
  title: string;
  description?: string | null;
  frequencyDays: number;
  nextDueAt: Date;
  estimatedCostSatang?: number | null;
  blocksInventory?: boolean;
}

export async function createPreventiveMaintenancePlan(
  db: PrismaClient,
  input: CreatePreventiveMaintenancePlanInput,
) {
  if (!input.title.trim()) throw new Error('PREVENTIVE_TITLE_REQUIRED');
  if (!Number.isInteger(input.frequencyDays) || input.frequencyDays < 1) {
    throw new Error('PREVENTIVE_FREQUENCY_INVALID');
  }
  if (input.unitId) {
    const scoped = await db.operatingSpaceUnit.findFirst({
      where: {
        operatingSpaceId: input.operatingSpaceId,
        unitId: input.unitId,
        active: true,
      },
      include: { unit: { select: { projectId: true } } },
    });
    if (!scoped) throw new Error('PREVENTIVE_UNIT_OUTSIDE_OPERATING_SPACE');
    if (input.projectId && scoped.unit.projectId !== input.projectId) {
      throw new Error('PREVENTIVE_PROJECT_UNIT_MISMATCH');
    }
  }
  return db.preventiveMaintenancePlan.create({
    data: {
      operatingSpaceId: input.operatingSpaceId,
      projectId: input.projectId ?? null,
      unitId: input.unitId ?? null,
      assignedTeamId: input.assignedTeamId ?? null,
      assignedIdentityId: input.assignedIdentityId ?? null,
      taskType: input.taskType ?? 'preventive_maintenance',
      title: input.title.trim(),
      description: input.description ?? null,
      frequencyDays: input.frequencyDays,
      nextDueAt: input.nextDueAt,
      estimatedCostSatang: input.estimatedCostSatang ?? null,
      blocksInventory: input.blocksInventory ?? false,
    },
  });
}

export async function generateDuePreventiveMaintenanceTasks(
  db: PrismaClient,
  now: Date = new Date(),
) {
  const duePlans = await db.preventiveMaintenancePlan.findMany({
    where: { active: true, nextDueAt: { lte: now } },
    orderBy: { nextDueAt: 'asc' },
    take: 200,
  });

  const generated: string[] = [];
  for (const candidate of duePlans) {
    const ids = await db.$transaction(async (tx) => {
      const claimed = await tx.preventiveMaintenancePlan.updateMany({
        where: {
          id: candidate.id,
          active: true,
          nextDueAt: { lte: now },
        },
        data: {
          lastGeneratedAt: now,
          nextDueAt: new Date(
            candidate.nextDueAt.getTime() + candidate.frequencyDays * 24 * 60 * 60 * 1000
          ),
        },
      });
      if (claimed.count !== 1) return [];

      const scopedUnits = await tx.operatingSpaceUnit.findMany({
        where: {
          operatingSpaceId: candidate.operatingSpaceId,
          active: true,
          OR: [{ endsOn: null }, { endsOn: { gt: now } }],
          ...(candidate.unitId
            ? { unitId: candidate.unitId }
            : candidate.projectId
              ? { unit: { projectId: candidate.projectId } }
              : {}),
        },
        include: { unit: { select: { id: true, projectId: true } } },
      });

      const created = [];
      for (const scoped of scopedUnits) {
        created.push(await tx.operationalTask.create({
          data: {
            projectId: scoped.unit.projectId,
            unitId: scoped.unit.id,
            operatingSpaceId: candidate.operatingSpaceId,
            preventiveMaintenancePlanId: candidate.id,
            taskType: candidate.taskType,
            status: candidate.assignedIdentityId || candidate.assignedTeamId ? 'assigned' : 'planned',
            title: candidate.title,
            description: candidate.description,
            dueAt: candidate.nextDueAt,
            assignedIdentityId: candidate.assignedIdentityId,
            assignedTeamId: candidate.assignedTeamId,
            estimatedCostSatang: candidate.estimatedCostSatang,
            blocksInventory: candidate.blocksInventory,
          },
          select: { id: true },
        }));
      }
      return created.map((task) => task.id);
    });
    generated.push(...ids);
  }
  return generated;
}
