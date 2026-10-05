import { NextRequest, NextResponse } from 'next/server';
import type { OperationalTaskType } from '@prisma/client';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getAuthorizedOperationalUnitIds } from '@/app/libs/projectScope';
import { prisma } from '@/lib/prisma';
import {
  createOperationalTask,
  hasOperatingSpaceCapability,
} from '@/modules/ops';

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

    const unit = await prisma.unit.findUnique({
      where: { id: body.unitId },
      select: { id: true, projectId: true },
    });
    if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });

    const authorizedUnits = await getAuthorizedOperationalUnitIds(
      user,
      [unit.id],
      ['housekeeping','front_desk','maintenance','guest_care','reservations'],
    );
    if (!user.isAdmin && !authorizedUnits.includes(unit.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (body.operatingSpaceId && !user.isAdmin) {
      const canManage = await hasOperatingSpaceCapability(
        prisma,
        body.operatingSpaceId,
        user.identityId,
        'manage_tasks',
      );
      if (!canManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

      if (body.assignedIdentityId || body.assignedTeamId) {
        const canAssign = await hasOperatingSpaceCapability(
          prisma,
          body.operatingSpaceId,
          user.identityId,
          'assign_tasks',
        );
        if (!canAssign) return NextResponse.json({ error: 'Assignment forbidden' }, { status: 403 });
      }
    }

    if (body.operatingSpaceId && body.assignedIdentityId) {
      const member = await prisma.operatingSpaceMember.findFirst({
        where: {
          operatingSpaceId: body.operatingSpaceId,
          identityId: body.assignedIdentityId,
          active: true,
        },
        select: { id: true },
      });
      if (!member) return NextResponse.json({ error: 'Assignee is outside this operating space' }, { status: 400 });
      const explicitAssignments = await prisma.operatingSpaceMemberUnit.findMany({
        where: {
          operatingSpaceId: body.operatingSpaceId,
          identityId: body.assignedIdentityId,
          active: true,
        },
        select: { unitId: true },
      });
      if (
        explicitAssignments.length > 0 &&
        !explicitAssignments.some((assignment) => assignment.unitId === body.unitId)
      ) {
        return NextResponse.json({ error: 'Assignee is not authorized for this property' }, { status: 400 });
      }
    }
    if (body.operatingSpaceId && body.assignedTeamId) {
      const team = await prisma.operatingTeam.findFirst({
        where: { id: body.assignedTeamId, operatingSpaceId: body.operatingSpaceId, active: true },
        select: { id: true },
      });
      if (!team) return NextResponse.json({ error: 'Team is outside this operating space' }, { status: 400 });
    }

    const task = await createOperationalTask(prisma, {
      projectId: unit.projectId,
      unitId: unit.id,
      operatingSpaceId: body.operatingSpaceId || null,
      bookingId: body.bookingId || null,
      taskType: body.taskType,
      title: body.title || null,
      description: body.description || null,
      priority: body.priority || 'normal',
      dueAt: new Date(body.dueAt),
      assignedIdentityId: body.assignedIdentityId || null,
      assignedTeamId: body.assignedTeamId || null,
      estimatedCostSatang: body.estimatedCostThb == null ? null : Math.round(Number(body.estimatedCostThb) * 100),
      actualCostSatang: body.actualCostThb == null ? null : Math.round(Number(body.actualCostThb) * 100),
      blocksInventory: Boolean(body.blocksInventory),
      notes: body.notes || null,
      mediaAssetIds: Array.isArray(body.mediaAssetIds) ? body.mediaAssetIds : [],
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Task creation failed' },
      { status: 400 },
    );
  }
}
