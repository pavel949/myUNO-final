import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { can } from '@/modules/core';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface UpdateChecklistInstanceRequest {
  passed?: boolean;
  notes?: string;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const identity = await prisma.identity.findUnique({ where: { id: user.identityId } });
  if (!identity) return NextResponse.json({ error: 'Identity not found' }, { status: 404 });

  if (
    !(await can({
      identity,
      action: 'admin:view_all',
      resource: { resourceType: 'platform' },
    }))
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body: UpdateChecklistInstanceRequest = await req.json();

    if (body.passed === undefined && !body.notes) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const instance = await prisma.complianceChecklistInstance.findUnique({
      where: { id: params.id },
    });

    if (!instance) {
      return NextResponse.json({ error: 'Checklist instance not found' }, { status: 404 });
    }

    const updatedInstance = await prisma.complianceChecklistInstance.update({
      where: { id: params.id },
      data: {
        ...(body.passed !== undefined && { passed: body.passed }),
        ...(body.notes && { notes: body.notes }),
        ...(body.passed !== undefined &&
          !instance.completedDate && { completedDate: new Date() }),
        ...(body.passed !== undefined &&
          !instance.checkedByIdentityId && { checkedByIdentityId: user.identityId }),
      },
      include: {
        unit: { select: { id: true, name: true } },
        template: { select: { id: true, name: true, frequency: true } },
        checkedBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      instance: {
        id: updatedInstance.id,
        unitId: updatedInstance.unitId,
        unitName: updatedInstance.unit.name,
        templateId: updatedInstance.templateId,
        templateName: updatedInstance.template.name,
        templateFrequency: updatedInstance.template.frequency,
        dueDate: updatedInstance.dueDate.toISOString(),
        completedDate: updatedInstance.completedDate?.toISOString() || null,
        passed: updatedInstance.passed,
        notes: updatedInstance.notes,
        checkedBy: updatedInstance.checkedBy
          ? {
              id: updatedInstance.checkedBy.id,
              email: updatedInstance.checkedBy.email,
              name: `${updatedInstance.checkedBy.firstName} ${updatedInstance.checkedBy.lastName}`.trim(),
            }
          : null,
        updatedAt: updatedInstance.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[COMPLIANCE CHECKLIST UPDATE]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
