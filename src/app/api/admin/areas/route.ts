import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, failed } from '@/app/libs/onboardingGuard';
import { createArea, listAreas } from '@/modules/projects';

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;
  return NextResponse.json(await listAreas(prisma));
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;
  try {
    const body = await req.json();
    if (!body.slug?.trim() || !body.nameKey?.trim()) {
      return NextResponse.json({ error: 'slug and nameKey are required' }, { status: 400 });
    }
    const area = await createArea(prisma, {
      slug: body.slug.trim(),
      nameKey: body.nameKey.trim(),
      descriptionKey: body.descriptionKey?.trim() || null,
      parentId: body.parentId || null,
      status: body.status || 'draft',
      sort: Number(body.sort) || 0,
    });
    return NextResponse.json(area, { status: 201 });
  } catch (error) {
    return failed(error, 'Failed to create area');
  }
}
