import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { IncidentSeverity, IncidentStatus, IncidentType } from '@prisma/client';
import { requireAdmin } from '@/app/libs/onboardingGuard';

export const dynamic = 'force-dynamic';

interface CreateIncidentRequest {
  unitId: string;
  incidentType: IncidentType;
  severity: IncidentSeverity;
  description: string;
  assignedToIdentityId?: string;
}

function serializeIncident(incident: {
  id: string;
  unitId: string;
  incidentType: IncidentType;
  severity: IncidentSeverity;
  description: string;
  status: IncidentStatus;
  resolutionNotes: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  unit: { id: string; name: string };
  reportedBy: { id: string; email: string | null; firstName: string; lastName: string };
  assignedTo: { id: string; email: string | null; firstName: string; lastName: string } | null;
}) {
  return {
    id: incident.id,
    unitId: incident.unitId,
    unitName: incident.unit.name,
    incidentType: incident.incidentType,
    severity: incident.severity,
    description: incident.description,
    status: incident.status,
    reportedBy: {
      id: incident.reportedBy.id,
      email: incident.reportedBy.email,
      name: `${incident.reportedBy.firstName} ${incident.reportedBy.lastName}`.trim(),
    },
    assignedTo: incident.assignedTo
      ? {
          id: incident.assignedTo.id,
          email: incident.assignedTo.email,
          name: `${incident.assignedTo.firstName} ${incident.assignedTo.lastName}`.trim(),
        }
      : null,
    resolutionNotes: incident.resolutionNotes,
    resolvedAt: incident.resolvedAt?.toISOString() || null,
    createdAt: incident.createdAt.toISOString(),
    updatedAt: incident.updatedAt.toISOString(),
  };
}

const incidentInclude = {
  unit: { select: { id: true, name: true } },
  reportedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
  assignedTo: { select: { id: true, email: true, firstName: true, lastName: true } },
} as const;

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  try {
    const url = new URL(req.url);
    const unitId = url.searchParams.get('unitId');
    const status = url.searchParams.get('status') as IncidentStatus | null;
    const severity = url.searchParams.get('severity') as IncidentSeverity | null;
    const statusesParam = url.searchParams.get('statuses');

    const where: {
      unitId?: string;
      status?: IncidentStatus | { in: IncidentStatus[] };
      severity?: IncidentSeverity;
    } = {};

    if (unitId) where.unitId = unitId;
    if (status) where.status = status;
    if (statusesParam) {
      where.status = {
        in: statusesParam.split(',').filter(Boolean) as IncidentStatus[],
      };
    }
    if (severity) where.severity = severity;

    const incidents = await prisma.incidentLog.findMany({
      where,
      include: incidentInclude,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({
      success: true,
      incidents: incidents.map(serializeIncident),
    });
  } catch (error) {
    console.error('[INCIDENTS GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;
  const { identity } = guard;

  try {
    const body: CreateIncidentRequest = await req.json();

    if (!body.unitId || !body.incidentType || !body.severity || !body.description) {
      return NextResponse.json(
        { error: 'Missing required fields: unitId, incidentType, severity, description' },
        { status: 400 }
      );
    }

    const validIncidentTypes: IncidentType[] = ['maintenance', 'complaint', 'violation'];
    const validSeverities: IncidentSeverity[] = ['low', 'medium', 'high', 'critical'];

    if (!validIncidentTypes.includes(body.incidentType)) {
      return NextResponse.json(
        { error: `Invalid incident type. Must be one of: ${validIncidentTypes.join(', ')}` },
        { status: 400 }
      );
    }

    if (!validSeverities.includes(body.severity)) {
      return NextResponse.json(
        { error: `Invalid severity. Must be one of: ${validSeverities.join(', ')}` },
        { status: 400 }
      );
    }

    const unit = await prisma.unit.findUnique({ where: { id: body.unitId } });
    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    if (body.assignedToIdentityId) {
      const assignee = await prisma.identity.findUnique({
        where: { id: body.assignedToIdentityId },
      });
      if (!assignee) {
        return NextResponse.json({ error: 'Assigned person not found' }, { status: 404 });
      }
    }

    const incident = await prisma.incidentLog.create({
      data: {
        unitId: body.unitId,
        incidentType: body.incidentType,
        severity: body.severity,
        description: body.description,
        reportedByIdentityId: identity.id,
        assignedToIdentityId: body.assignedToIdentityId,
        status: 'open',
      },
      include: incidentInclude,
    });

    return NextResponse.json({
      success: true,
      incident: serializeIncident(incident),
    });
  } catch (error) {
    console.error('[INCIDENTS POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
