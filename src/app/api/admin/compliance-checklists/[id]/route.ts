import { getCurrentUser } from '@/app/actions/getCurrentUser'
import { NextRequest, NextResponse } from 'next/server'
import prismadb from '@/app/libs/prismadb'

export const dynamic = 'force-dynamic'

interface UpdateChecklistInstanceRequest {
  passed?: boolean
  notes?: string
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

    const instanceId = params.id
    const body: UpdateChecklistInstanceRequest = await req.json()

    if (body.passed === undefined && !body.notes) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    // Fetch current instance
    const instance = await prismadb.complianceChecklistInstance.findUnique({
      where: { id: instanceId },
    })

    if (!instance) {
      return NextResponse.json(
        { error: 'Checklist instance not found' },
        { status: 404 }
      )
    }

    // Update instance
    const updatedInstance = await prismadb.complianceChecklistInstance.update({
      where: { id: instanceId },
      data: {
        ...(body.passed !== undefined && { passed: body.passed }),
        ...(body.notes && { notes: body.notes }),
        // Set completed date if marking as passed/failed
        ...(body.passed !== undefined && !instance.completedDate && { completedDate: new Date() }),
        // Set who checked it
        ...(body.passed !== undefined && !instance.checkedByIdentityId && { checkedByIdentityId: currentUser.identityId }),
      },
      include: {
        unit: {
          select: {
            id: true,
            name: true,
          },
        },
        template: {
          select: {
            id: true,
            name: true,
            frequency: true,
          },
        },
        checkedBy: {
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
        checkedBy: updatedInstance.checkedBy ? {
          id: updatedInstance.checkedBy.id,
          email: updatedInstance.checkedBy.email,
          name: `${updatedInstance.checkedBy.firstName} ${updatedInstance.checkedBy.lastName}`,
        } : null,
        updatedAt: updatedInstance.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('[COMPLIANCE CHECKLIST UPDATE]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
