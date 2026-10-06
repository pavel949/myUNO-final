import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, failed } from '@/app/libs/onboardingGuard';

export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  try {
    const body = await request.json() as {
      key?: string;
      name?: string;
      organizationId?: string;
      timezone?: string;
    };

    const key = body.key?.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
    const name = body.name?.trim();
    const organizationId = body.organizationId?.trim();
    const timezone = body.timezone?.trim() || 'Asia/Bangkok';

    if (!key || !name || !organizationId) {
      return NextResponse.json(
        { error: 'Key, name and organization are required' },
        { status: 400 },
      );
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const space = await prisma.operatingSpace.create({
      data: { key, name, organizationId, timezone, status: 'active' },
      select: { id: true, key: true, name: true, organizationId: true, timezone: true, status: true },
    });

    await prisma.auditLog.create({
      data: {
        actorIdentityId: guard.actorIdentityId,
        action: 'operating_space.created',
        entityType: 'operating_space',
        entityId: space.id,
        data: { key, name, organizationId, timezone },
      },
    });

    return NextResponse.json({ space }, { status: 201 });
  } catch (error) {
    return failed(error, 'Could not create operating space');
  }
}
