import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { listOnboardingTemplates } from '@/modules/projects';
import { requireAdmin, failed } from '@/app/libs/onboardingGuard';

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;
  try {
    const templates = await listOnboardingTemplates(prisma);
    return NextResponse.json({ templates });
  } catch (error) {
    return failed(error, 'Failed to load onboarding templates');
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;
  try {
    const body = await req.json();
    const templateKey = String(body.templateKey || '').trim();
    const name = String(body.name || '').trim();
    const propertyType = String(body.propertyType || '').trim();
    const version = Number(body.version || 1);
    if (!templateKey || !name || !propertyType || !Number.isInteger(version) || version < 1) {
      return NextResponse.json({ error: 'templateKey, name, propertyType and positive version are required' }, { status: 400 });
    }
    const template = await prisma.propertyOnboardingTemplate.create({
      data: {
        templateKey,
        version,
        name,
        propertyType,
        configuration: body.configuration && typeof body.configuration === 'object' ? body.configuration : {},
        checklist: Array.isArray(body.checklist) ? body.checklist : [],
        active: body.active !== false,
      },
    });
    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    return failed(error, 'Failed to create onboarding template');
  }
}
