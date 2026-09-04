import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { can } from '@/modules/core';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { ComplianceChecklistFrequency, Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

interface CreateChecklistInstanceRequest {
  unitId: string;
  templateId: string;
  dueDate: string;
}

interface CreateChecklistTemplateRequest {
  name: string;
  frequency: ComplianceChecklistFrequency;
  items: Prisma.InputJsonValue;
}

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const identity = await prisma.identity.findUnique({ where: { id: user.identityId } });
  if (!identity) {
    return { error: NextResponse.json({ error: 'Identity not found' }, { status: 404 }) };
  }

  if (
    !(await can({
      identity,
      action: 'admin:view_all',
      resource: { resourceType: 'platform' },
    }))
  ) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { user, identity };
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return auth.error;

  try {
    const url = new URL(req.url);
    const unitId = url.searchParams.get('unitId');
    const templateId = url.searchParams.get('templateId');
    const showTemplates = url.searchParams.get('showTemplates') === 'true';

    if (showTemplates) {
      const templates = await prisma.complianceChecklistTemplate.findMany({
        include: { instances: { select: { id: true } } },
      });

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
      });
    }

    const where: { unitId?: string; templateId?: string } = {};
    if (unitId) where.unitId = unitId;
    if (templateId) where.templateId = templateId;

    const instances = await prisma.complianceChecklistInstance.findMany({
      where,
      include: {
        unit: { select: { id: true, name: true } },
        template: { select: { id: true, name: true, frequency: true } },
        checkedBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      orderBy: { dueDate: 'asc' },
      take: 100,
    });

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
        checkedBy: instance.checkedBy
          ? {
              id: instance.checkedBy.id,
              email: instance.checkedBy.email,
              name: `${instance.checkedBy.firstName} ${instance.checkedBy.lastName}`.trim(),
            }
          : null,
        createdAt: instance.createdAt.toISOString(),
        updatedAt: instance.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('[COMPLIANCE CHECKLISTS GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth && auth.error) return auth.error;

  try {
    const body = await req.json();

    if (body.name && body.frequency && body.items) {
      const templateRequest = body as CreateChecklistTemplateRequest;
      const validFrequencies: ComplianceChecklistFrequency[] = [
        'weekly',
        'monthly',
        'quarterly',
        'annual',
      ];
      if (!validFrequencies.includes(templateRequest.frequency)) {
        return NextResponse.json(
          { error: `Invalid frequency. Must be one of: ${validFrequencies.join(', ')}` },
          { status: 400 }
        );
      }

      const template = await prisma.complianceChecklistTemplate.create({
        data: {
          name: templateRequest.name,
          frequency: templateRequest.frequency,
          items: templateRequest.items,
        },
      });

      return NextResponse.json({
        success: true,
        template: {
          id: template.id,
          name: template.name,
          frequency: template.frequency,
          items: template.items,
          createdAt: template.createdAt.toISOString(),
        },
      });
    }

    if (body.unitId && body.templateId && body.dueDate) {
      const instanceRequest = body as CreateChecklistInstanceRequest;
      const unit = await prisma.unit.findUnique({ where: { id: instanceRequest.unitId } });
      if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });

      const template = await prisma.complianceChecklistTemplate.findUnique({
        where: { id: instanceRequest.templateId },
      });
      if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

      const dueDate = new Date(instanceRequest.dueDate);
      if (isNaN(dueDate.getTime())) {
        return NextResponse.json({ error: 'Invalid date format for dueDate' }, { status: 400 });
      }

      const instance = await prisma.complianceChecklistInstance.create({
        data: {
          unitId: instanceRequest.unitId,
          templateId: instanceRequest.templateId,
          dueDate,
        },
        include: {
          unit: { select: { id: true, name: true } },
          template: { select: { id: true, name: true, frequency: true } },
        },
      });

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
      });
    }

    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  } catch (error) {
    console.error('[COMPLIANCE CHECKLISTS POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
