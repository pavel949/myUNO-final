import type {
  OperationalTaskStatus,
  OperationalTaskType,
  PrismaClient,
} from '@prisma/client';

const OPEN_STATUSES: OperationalTaskStatus[] = ['planned', 'assigned', 'in_progress', 'inspected'];

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
  planned: ['assigned', 'in_progress', 'cancelled'],
  assigned: ['in_progress', 'cancelled'],
  in_progress: ['inspected', 'ready', 'cancelled'],
  inspected: ['ready', 'in_progress', 'cancelled'],
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
        ...(nextStatus === 'ready' ? { readyAt: now } : {}),
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
      assignee: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
  });
}
