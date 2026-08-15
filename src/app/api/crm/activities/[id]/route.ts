import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import type { CrmActivityStatus } from '@prisma/client';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!user.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { status, subject, body: bodyText, dueAt } = body;

  const activity = await prisma.crmActivity.findUnique({
    where: { id: params.id },
    include: {
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!activity) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const updateData: any = {};

  if (status) {
    updateData.status = status as CrmActivityStatus;
    if (status === 'completed') {
      updateData.completedAt = new Date();
    } else if (status === 'open') {
      updateData.completedAt = null;
    }
  }

  if (subject !== undefined) {
    updateData.subject = subject;
  }

  if (bodyText !== undefined) {
    updateData.body = bodyText;
  }

  if (dueAt !== undefined) {
    updateData.dueAt = dueAt ? new Date(dueAt) : null;
  }

  const updated = await prisma.crmActivity.update({
    where: { id: params.id },
    data: updateData,
    include: {
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  return NextResponse.json({
    id: updated.id,
    type: updated.type,
    status: updated.status,
    subject: updated.subject,
    body: updated.body,
    dueAt: updated.dueAt?.toISOString() ?? null,
    completedAt: updated.completedAt?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
    createdBy: updated.createdBy
      ? {
          id: updated.createdBy.id,
          name: `${updated.createdBy.firstName} ${updated.createdBy.lastName}`,
        }
      : null,
  });
}
