import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { failed, requireAdmin } from '@/app/libs/onboardingGuard';

const sections = new Set(['projects', 'homes', 'services', 'areas']);
const entityTypes = new Set(['project', 'unit', 'commercial_offering', 'service', 'area']);

function validDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;
  const placements = await prisma.homepagePlacement.findMany({
    orderBy: [{ destinationKey: 'asc' }, { sectionKey: 'asc' }, { position: 'asc' }],
  });
  return NextResponse.json({ placements });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;
  try {
    const body = await req.json();
    if (!body.destinationKey?.trim() || !sections.has(body.sectionKey) || !entityTypes.has(body.entityType)) {
      return NextResponse.json({ error: 'Invalid destination, section or entity type.' }, { status: 400 });
    }
    if (!body.entityId?.trim()) {
      return NextResponse.json({ error: 'entityId is required.' }, { status: 400 });
    }
    const placement = await prisma.homepagePlacement.create({
      data: {
        destinationKey: body.destinationKey.trim(),
        locale: body.locale?.trim() || null,
        sectionKey: body.sectionKey,
        entityType: body.entityType,
        entityId: body.entityId.trim(),
        position: Number.isFinite(Number(body.position)) ? Number(body.position) : 0,
        visibleFrom: validDate(body.visibleFrom),
        visibleUntil: validDate(body.visibleUntil),
        status: body.status === 'inactive' ? 'inactive' : 'active',
        editorialReason: body.editorialReason?.trim() || null,
      },
    });
    return NextResponse.json({ placement }, { status: 201 });
  } catch (error) {
    return failed(error, 'Failed to create homepage placement');
  }
}

export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;
  try {
    const body = await req.json();
    if (!body.id?.trim()) return NextResponse.json({ error: 'id is required.' }, { status: 400 });
    const placement = await prisma.homepagePlacement.update({
      where: { id: body.id },
      data: {
        ...(body.destinationKey !== undefined ? { destinationKey: String(body.destinationKey).trim() } : {}),
        ...(body.locale !== undefined ? { locale: String(body.locale).trim() || null } : {}),
        ...(body.sectionKey !== undefined && sections.has(body.sectionKey) ? { sectionKey: body.sectionKey } : {}),
        ...(body.entityType !== undefined && entityTypes.has(body.entityType) ? { entityType: body.entityType } : {}),
        ...(body.entityId !== undefined ? { entityId: String(body.entityId).trim() || null } : {}),
        ...(body.position !== undefined ? { position: Number(body.position) || 0 } : {}),
        ...(body.visibleFrom !== undefined ? { visibleFrom: validDate(body.visibleFrom) } : {}),
        ...(body.visibleUntil !== undefined ? { visibleUntil: validDate(body.visibleUntil) } : {}),
        ...(body.status !== undefined ? { status: body.status === 'inactive' ? 'inactive' : 'active' } : {}),
        ...(body.editorialReason !== undefined ? { editorialReason: String(body.editorialReason).trim() || null } : {}),
      },
    });
    return NextResponse.json({ placement });
  } catch (error) {
    return failed(error, 'Failed to update homepage placement');
  }
}

export async function DELETE(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required.' }, { status: 400 });
  try {
    await prisma.homepagePlacement.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return failed(error, 'Failed to delete homepage placement');
  }
}
