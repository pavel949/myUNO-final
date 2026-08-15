import { getCurrentUser } from '@/app/actions/getCurrentUser'
import { NextRequest, NextResponse } from 'next/server'
import { IncidentType, IncidentSeverity, IncidentStatus } from '@prisma/client'
import prismadb from '@/app/libs/prismadb'

export const dynamic = 'force-dynamic'

interface CreateIncidentRequest {
  unitId: string
  incidentType: IncidentType
  severity: IncidentSeverity
  description: string
  assignedToIdentityId?: string
}

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser || !currentUser.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      )
    }

    const url = new URL(req.url)
    const unitId = url.searchParams.get('unitId')
    const status = url.searchParams.get('status') as IncidentStatus | null
    const severity = url.searchParams.get('severity') as IncidentSeverity | null

    const where: any = {}
    if (unitId) where.unitId = unitId
    if (status) where.status = status
    if (severity) where.severity = severity

    const incidents = await prismadb.incidentLog.findMany({
      where,
      include: {
        unit: {
          select: {
            id: true,
            name: true,
          },
        },
        reportedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      incidents: incidents.map((incident) => ({
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
          name: `${incident.reportedBy.firstName} ${incident.reportedBy.lastName}`,
        },
        assignedTo: incident.assignedTo ? {
          id: incident.assignedTo.id,
          email: incident.assignedTo.email,
          name: `${incident.assignedTo.firstName} ${incident.assignedTo.lastName}`,
        } : null,
        resolutionNotes: incident.resolutionNotes,
        resolvedAt: incident.resolvedAt?.toISOString() || null,
        createdAt: incident.createdAt.toISOString(),
        updatedAt: incident.updatedAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('[INCIDENTS GET]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser || !currentUser.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      )
    }

    const body: CreateIncidentRequest = await req.json()

    if (!body.unitId || !body.incidentType || !body.severity || !body.description) {
      return NextResponse.json(
        { error: 'Missing required fields: unitId, incidentType, severity, description' },
        { status: 400 }
      )
    }

    // Validate enum values
    const validIncidentTypes: IncidentType[] = ['maintenance', 'complaint', 'violation']
    const validSeverities: IncidentSeverity[] = ['low', 'medium', 'high', 'critical']

    if (!validIncidentTypes.includes(body.incidentType)) {
      return NextResponse.json(
        { error: `Invalid incident type. Must be one of: ${validIncidentTypes.join(', ')}` },
        { status: 400 }
      )
    }

    if (!validSeverities.includes(body.severity)) {
      return NextResponse.json(
        { error: `Invalid severity. Must be one of: ${validSeverities.join(', ')}` },
        { status: 400 }
      )
    }

    // Verify unit exists
    const unit = await prismadb.unit.findUnique({
      where: { id: body.unitId },
    })

    if (!unit) {
      return NextResponse.json(
        { error: 'Unit not found' },
        { status: 404 }
      )
    }

    // If assignedTo is provided, verify identity exists
    if (body.assignedToIdentityId) {
      const identity = await prismadb.identity.findUnique({
        where: { id: body.assignedToIdentityId },
      })

      if (!identity) {
        return NextResponse.json(
          { error: 'Assigned person not found' },
          { status: 404 }
        )
      }
    }

    const incident = await prismadb.incidentLog.create({
      data: {
        unitId: body.unitId,
        incidentType: body.incidentType,
        severity: body.severity,
        description: body.description,
        reportedByIdentityId: currentUser.identityId,
        assignedToIdentityId: body.assignedToIdentityId,
        status: 'open',
      },
      include: {
        unit: {
          select: {
            id: true,
            name: true,
          },
        },
        reportedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      incident: {
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
          name: `${incident.reportedBy.firstName} ${incident.reportedBy.lastName}`,
        },
        assignedTo: incident.assignedTo ? {
          id: incident.assignedTo.id,
          email: incident.assignedTo.email,
          name: `${incident.assignedTo.firstName} ${incident.assignedTo.lastName}`,
        } : null,
        createdAt: incident.createdAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('[INCIDENTS POST]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
