import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { can } from '@/modules/core';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { IncidentStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

interface UpdateIncidentRequest {
  status?: IncidentStatus;
  assignedToIdentityId?: string | null;
  resolutionNotes?: string;
}

const incidentInclude = {
  unit: { select: { id: true, name: true } },
  reportedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
  assignedTo: { select: { id: true, email: true, firstName: true, lastName: true } },
} as const;

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const identity = await prisma.identity.findUnique({ where: { id: user.identityId } });
  if (!identity) {
    return NextResponse.json({ error: 'Identity not found' }, { status: 404 });
  }

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
    const body: UpdateIncidentRequest = await req.json();

    if (!body.status && body.assignedToIdentityId === undefined && !body.resolutionNotes) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const incident = await prisma.incidentLog.findUnique({
      where: { id: params.id },
    });

    if (!incident) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    if (body.assignedToIdentityId) {
      const assignee = await prisma.identity.findUnique({
        where: { id: body.assignedToIdentityId },
      });
      if (!assignee) {
        return NextResponse.json({ error: 'Assigned person not found' }, { status: 404 });
      }
    }

    const validStatuses: IncidentStatus[] = [
      'open',
      'acknowledged',
      'in_progress',
      'resolved',
      'closed',
    ];
    if (body.status && !validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const updatedIncident = await prisma.incidentLog.update({
      where: { id: params.id },
      data: {
        ...(body.status && { status: body.status }),
        ...(body.assignedToIdentityId !== undefined && {
          assignedToIdentityId: body.assignedToIdentityId,
        }),
        ...(body.resolutionNotes && { resolutionNotes: body.resolutionNotes }),
        ...(body.status === 'resolved' && { resolvedAt: new Date() }),
      },
      include: incidentInclude,
    });

    return NextResponse.json({
      success: true,
      incident: {
        id: updatedIncident.id,
        unitId: updatedIncident.unitId,
        unitName: updatedIncident.unit.name,
        incidentType: updatedIncident.incidentType,
        severity: updatedIncident.severity,
        description: updatedIncident.description,
        status: updatedIncident.status,
        reportedBy: {
          id: updatedIncident.reportedBy.id,
          email: updatedIncident.reportedBy.email,
          name: `${updatedIncident.reportedBy.firstName} ${updatedIncident.reportedBy.lastName}`.trim(),
        },
        assignedTo: updatedIncident.assignedTo
          ? {
              id: updatedIncident.assignedTo.id,
              email: updatedIncident.assignedTo.email,
              name: `${updatedIncident.assignedTo.firstName} ${updatedIncident.assignedTo.lastName}`.trim(),
            }
          : null,
        resolutionNotes: updatedIncident.resolutionNotes,
        resolvedAt: updatedIncident.resolvedAt?.toISOString() || null,
        updatedAt: updatedIncident.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[INCIDENT UPDATE]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
