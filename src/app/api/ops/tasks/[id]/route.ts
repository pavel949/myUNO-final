import { NextRequest, NextResponse } from 'next/server';
import type { OperationalTaskStatus } from '@prisma/client';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getAuthorizedOperationalUnitIds } from '@/app/libs/projectScope';
import { prisma } from '@/lib/prisma';
import { hasOperatingSpaceCapability, transitionOperationalTask } from '@/modules/ops';

const ALLOWED: OperationalTaskStatus[] = [
  'planned', 'assigned', 'in_progress', 'inspected', 'blocked', 'ready', 'cancelled',
];

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const task = await prisma.operationalTask.findUnique({
    where: { id: params.id },
    select: { id: true, projectId: true, unitId: true, operatingSpaceId: true },
  });
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  const authorizedUnits = await getAuthorizedOperationalUnitIds(
    user,
    [task.unitId],
    ['housekeeping','front_desk','maintenance','guest_care','reservations'],
  );
  if (!user.isAdmin && !authorizedUnits.includes(task.unitId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (
    task.operatingSpaceId &&
    !user.isAdmin &&
    !(await hasOperatingSpaceCapability(prisma, task.operatingSpaceId, user.identityId, 'manage_tasks'))
  ) {
    return NextResponse.json({ error: 'Operating space task capability required' }, { status: 403 });
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
