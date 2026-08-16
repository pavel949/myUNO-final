import { getCurrentUser } from '@/app/actions/getCurrentUser'
import { NextRequest, NextResponse } from 'next/server'
import { IncidentStatus } from '@prisma/client'
import prismadb from '@/app/libs/prismadb'

export const dynamic = 'force-dynamic'

interface UpdateIncidentRequest {
  status?: IncidentStatus
  assignedToIdentityId?: string | null
  resolutionNotes?: string
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser || !currentUser.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      )
    }

    const incidentId = params.id
    const body: UpdateIncidentRequest = await req.json()

    if (!body.status && !body.assignedToIdentityId && !body.resolutionNotes) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    // Fetch current incident
    const incident = await prismadb.incidentLog.findUnique({
      where: { id: incidentId },
    })

    if (!incident) {
      return NextResponse.json(
        { error: 'Incident not found' },
        { status: 404 }
      )
    }

    // If assigning to someone, verify they exist
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

    // Validate status if provided
    const validStatuses: IncidentStatus[] = ['open', 'acknowledged', 'in_progress', 'resolved', 'closed']
    if (body.status && !validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    // Update incident
    const updatedIncident = await prismadb.incidentLog.update({
      where: { id: incidentId },
      data: {
        ...(body.status && { status: body.status }),
        ...(body.assignedToIdentityId !== undefined && { assignedToIdentityId: body.assignedToIdentityId }),
        ...(body.resolutionNotes && { resolutionNotes: body.resolutionNotes }),
        ...(body.status === 'resolved' && { resolvedAt: new Date() }),
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
          name: `${updatedIncident.reportedBy.firstName} ${updatedIncident.reportedBy.lastName}`,
        },
        assignedTo: updatedIncident.assignedTo ? {
          id: updatedIncident.assignedTo.id,
          email: updatedIncident.assignedTo.email,
          name: `${updatedIncident.assignedTo.firstName} ${updatedIncident.assignedTo.lastName}`,
        } : null,
        resolutionNotes: updatedIncident.resolutionNotes,
        resolvedAt: updatedIncident.resolvedAt?.toISOString() || null,
        updatedAt: updatedIncident.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('[INCIDENT UPDATE]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
