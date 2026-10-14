import { NextRequest, NextResponse } from 'next/server';
import type { OperationalTaskType } from '@prisma/client';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { createOperationalTask } from '@/modules/ops';
import { assertOperationalTaskAccess, assertOperationalTeamAssignment, getOperationalActor, OperatingAccessError } from '@/modules/ops/operating-space-access.service';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json() as {
      operatingSpaceId?: string;
      unitId?: string;
      bookingId?: string;
      taskType?: OperationalTaskType;
      title?: string;
      description?: string;
      priority?: string;
      dueAt?: string;
      assignedIdentityId?: string;
      assignedTeamId?: string;
      estimatedCostThb?: number;
      actualCostThb?: number;
      blocksInventory?: boolean;
      notes?: string;
      mediaAssetIds?: string[];
    };
    if (!body.unitId || !body.taskType || !body.dueAt) {
      return NextResponse.json({ error: 'Missing task scope, type or due date' }, { status: 400 });
    }

    if ([body.estimatedCostThb, body.actualCostThb].some(value => value != null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0))) {
      return NextResponse.json({ error: 'Invalid task cost' }, { status: 400 });
    }
    if (body.mediaAssetIds !== undefined && !Array.isArray(body.mediaAssetIds)) {
      return NextResponse.json({ error: 'Invalid task attachments' }, { status: 400 });
    }
    if (body.operatingSpaceId !== undefined && (typeof body.operatingSpaceId !== 'string' || !body.operatingSpaceId.trim())) {
      return NextResponse.json({ error: 'Invalid operating space' }, { status: 400 });
    }
    const task = await prisma.$transaction(async tx => {
      const actor = await getOperationalActor(tx, user.identityId);
      if (!actor.isAdmin && !body.operatingSpaceId) {
        throw new OperatingAccessError('Choose an operating space for a new manual task', 400);
      }
      const unit = await tx.unit.findUnique({ where: { id: body.unitId! }, select: { id: true, projectId: true } });
      if (!unit) throw new OperatingAccessError('Unit not found', 404);
      const scope = { projectId: unit.projectId, unitId: unit.id, operatingSpaceId: body.operatingSpaceId ?? null };
      await assertOperationalTaskAccess(tx, user.identityId, scope);
      if (body.assignedIdentityId || body.assignedTeamId) {
        await assertOperationalTaskAccess(tx, user.identityId, scope, 'assign_tasks');
      }
      if (body.assignedIdentityId) await assertOperationalTaskAccess(tx, body.assignedIdentityId, scope);
      if (body.assignedTeamId) await assertOperationalTeamAssignment(tx, body.assignedTeamId, scope);
      if (body.bookingId) {
        const booking = await tx.booking.findFirst({ where: { id: body.bookingId, projectId: unit.projectId, unitId: unit.id }, select: { id: true } });
        if (!booking) throw new OperatingAccessError('Booking is outside task scope', 400);
      }
      return createOperationalTask(tx, {
      actorIdentityId: user.identityId,
      projectId: unit.projectId,
      unitId: unit.id,
      operatingSpaceId: body.operatingSpaceId || null,
      bookingId: body.bookingId || null,
      taskType: body.taskType!,
      title: body.title || null,
      description: body.description || null,
      priority: body.priority || 'normal',
      dueAt: new Date(body.dueAt!),
      assignedIdentityId: body.assignedIdentityId || null,
      assignedTeamId: body.assignedTeamId || null,
      estimatedCostSatang: body.estimatedCostThb == null ? null : Math.round(Number(body.estimatedCostThb) * 100),
      actualCostSatang: body.actualCostThb == null ? null : Math.round(Number(body.actualCostThb) * 100),
      blocksInventory: Boolean(body.blocksInventory),
      notes: body.notes || null,
      mediaAssetIds: Array.isArray(body.mediaAssetIds) ? body.mediaAssetIds : [],
      });
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Task creation failed' },
      { status: error instanceof OperatingAccessError ? error.status : 400 },
    );
  }
}

