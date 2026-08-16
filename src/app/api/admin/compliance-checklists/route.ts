import { getCurrentUser } from '@/app/actions/getCurrentUser'
import { NextRequest, NextResponse } from 'next/server'
import { ComplianceChecklistFrequency } from '@prisma/client'
import prismadb from '@/app/libs/prismadb'

export const dynamic = 'force-dynamic'

interface CreateChecklistInstanceRequest {
  unitId: string
  templateId: string
  dueDate: string
}

interface CreateChecklistTemplateRequest {
  name: string
  frequency: ComplianceChecklistFrequency
  items: Record<string, any>[]
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
    const templateId = url.searchParams.get('templateId')
    const showTemplates = url.searchParams.get('showTemplates') === 'true'

    if (showTemplates) {
      // Return templates
      const templates = await prismadb.complianceChecklistTemplate.findMany({
        include: {
          instances: {
            select: { id: true },
          },
        },
      })

      return NextResponse.json({
        success: true,
        templates: templates.map((t) => ({
          id: t.id,
          name: t.name,
          frequency: t.frequency,
          items: t.items,
          instanceCount: t.instances.length,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
        })),
      })
    }

    // Return instances
    const where: any = {}
    if (unitId) where.unitId = unitId
    if (templateId) where.templateId = templateId

    const instances = await prismadb.complianceChecklistInstance.findMany({
      where,
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
      orderBy: { dueDate: 'asc' },
    })

    return NextResponse.json({
      success: true,
      instances: instances.map((instance) => ({
        id: instance.id,
        unitId: instance.unitId,
        unitName: instance.unit.name,
        templateId: instance.templateId,
        templateName: instance.template.name,
        templateFrequency: instance.template.frequency,
        dueDate: instance.dueDate.toISOString(),
        completedDate: instance.completedDate?.toISOString() || null,
        passed: instance.passed,
        notes: instance.notes,
        checkedBy: instance.checkedBy ? {
          id: instance.checkedBy.id,
          email: instance.checkedBy.email,
          name: `${instance.checkedBy.firstName} ${instance.checkedBy.lastName}`,
        } : null,
        createdAt: instance.createdAt.toISOString(),
        updatedAt: instance.updatedAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('[COMPLIANCE CHECKLISTS GET]', error)
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

    const body = await req.json()

    // Check if creating template or instance
    if (body.name && body.frequency && body.items) {
      // Create template
      const templateRequest = body as CreateChecklistTemplateRequest

      const validFrequencies: ComplianceChecklistFrequency[] = ['weekly', 'monthly', 'quarterly', 'annual']
      if (!validFrequencies.includes(templateRequest.frequency)) {
        return NextResponse.json(
          { error: `Invalid frequency. Must be one of: ${validFrequencies.join(', ')}` },
          { status: 400 }
        )
      }

      const template = await prismadb.complianceChecklistTemplate.create({
        data: {
          name: templateRequest.name,
          frequency: templateRequest.frequency,
          items: templateRequest.items,
        },
      })

      return NextResponse.json({
        success: true,
        template: {
          id: template.id,
          name: template.name,
          frequency: template.frequency,
          items: template.items,
          createdAt: template.createdAt.toISOString(),
        },
      })
    } else if (body.unitId && body.templateId && body.dueDate) {
      // Create instance
      const instanceRequest = body as CreateChecklistInstanceRequest

      if (!instanceRequest.unitId || !instanceRequest.templateId || !instanceRequest.dueDate) {
        return NextResponse.json(
          { error: 'Missing required fields: unitId, templateId, dueDate' },
          { status: 400 }
        )
      }

      // Verify unit exists
      const unit = await prismadb.unit.findUnique({
        where: { id: instanceRequest.unitId },
      })

      if (!unit) {
        return NextResponse.json(
          { error: 'Unit not found' },
          { status: 404 }
        )
      }

      // Verify template exists
      const template = await prismadb.complianceChecklistTemplate.findUnique({
        where: { id: instanceRequest.templateId },
      })

      if (!template) {
        return NextResponse.json(
          { error: 'Template not found' },
          { status: 404 }
        )
      }

      const dueDate = new Date(instanceRequest.dueDate)
      if (isNaN(dueDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid date format for dueDate' },
          { status: 400 }
        )
      }

      const instance = await prismadb.complianceChecklistInstance.create({
        data: {
          unitId: instanceRequest.unitId,
          templateId: instanceRequest.templateId,
          dueDate,
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
        },
      })

      return NextResponse.json({
        success: true,
        instance: {
          id: instance.id,
          unitId: instance.unitId,
          unitName: instance.unit.name,
          templateId: instance.templateId,
          templateName: instance.template.name,
          templateFrequency: instance.template.frequency,
          dueDate: instance.dueDate.toISOString(),
          passed: instance.passed,
          createdAt: instance.createdAt.toISOString(),
        },
      })
    } else {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('[COMPLIANCE CHECKLISTS POST]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
