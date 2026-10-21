import { NextRequest, NextResponse } from 'next/server';
import type { OperationalTaskStatus } from '@prisma/client';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { transitionOperationalTask } from '@/modules/ops';
import { assertOperationalTaskAccess, OperatingAccessError } from '@/modules/ops/operating-space-access.service';

const ALLOWED: OperationalTaskStatus[] = [
  'planned', 'assigned', 'in_progress', 'inspected', 'blocked', 'ready', 'cancelled',
];

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({})) as {
    status?: OperationalTaskStatus;
    assignToMe?: boolean;
    notes?: string | null;
  };
  if (!body.status || !ALLOWED.includes(body.status)) {
    return NextResponse.json({ error: 'Invalid task status' }, { status: 400 });
  }

  try {
    const updated = await prisma.$transaction(async tx => {
      const task = await tx.operationalTask.findUnique({ where: { id: params.id }, select: { id: true, projectId: true, unitId: true, operatingSpaceId: true } });
      if (!task) throw new OperatingAccessError('Task not found', 404);
      await assertOperationalTaskAccess(tx, user.identityId, task);
      if (body.assignToMe) await assertOperationalTaskAccess(tx, user.identityId, task, 'assign_tasks');
      return transitionOperationalTask(tx, task.id, body.status!, {
        ...(body.assignToMe ? { assignedIdentityId: user.identityId } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      });
    });
    return NextResponse.json({ task: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Task update failed' },
      { status: error instanceof OperatingAccessError ? error.status : 409 }
    );
  }
}

