import { NextRequest, NextResponse } from 'next/server';
import type { OperationalTaskStatus } from '@prisma/client';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getDepartmentProjectIds, getMCProjectScopes } from '@/app/libs/projectScope';
import { prisma } from '@/lib/prisma';
import { transitionOperationalTask } from '@/modules/ops';
import { getMCManagedUnits } from '@/modules/projects';

const ALLOWED: OperationalTaskStatus[] = [
  'planned', 'assigned', 'in_progress', 'inspected', 'ready', 'cancelled',
];

async function canOperateTask(
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>,
  task: { projectId: string; unitId: string }
) {
  if (user.isAdmin) return true;
  const staffProjectIds = await getDepartmentProjectIds(user, [
    'housekeeping', 'front_desk', 'maintenance', 'guest_care', 'reservations',
  ]);
  if (staffProjectIds.includes(task.projectId)) return true;

  const scopes = getMCProjectScopes(user).filter((scope) => scope.projectId === task.projectId);
  for (const scope of scopes) {
    const managed = await getMCManagedUnits(
      prisma,
      user.identityId,
      scope.projectId,
      scope.organizationId
    );
    if (managed.some((unit) => unit.id === task.unitId)) return true;
  }
  return false;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const task = await prisma.operationalTask.findUnique({
    where: { id: params.id },
    select: { id: true, projectId: true, unitId: true },
  });
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  if (!(await canOperateTask(user, task))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({})) as {
    status?: OperationalTaskStatus;
    assignToMe?: boolean;
    notes?: string | null;
  };
  if (!body.status || !ALLOWED.includes(body.status)) {
    return NextResponse.json({ error: 'Invalid task status' }, { status: 400 });
  }

  try {
    const updated = await transitionOperationalTask(prisma, task.id, body.status, {
      ...(body.assignToMe ? { assignedIdentityId: user.identityId } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
    });
    return NextResponse.json({ task: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Task update failed' },
      { status: 409 }
    );
  }
}
