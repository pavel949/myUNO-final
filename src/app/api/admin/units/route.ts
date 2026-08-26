import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { can } from '@/modules/core';
import { createUnit } from '@/modules/projects';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const identity = await prisma.identity.findUnique({
    where: { id: user.identityId },
  });
  if (!identity) return NextResponse.json({ error: 'Identity not found' }, { status: 404 });

  // Check admin permission
  if (
    !(await can({
      identity,
      action: 'units:create',
      resource: { resourceType: 'platform' },
    }))
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const unit = await createUnit({
      ...body,
      actorIdentityId: user.identityId,
    });
    return NextResponse.json(unit, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to create unit' },
      { status: 400 }
    );
  }
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const identity = await prisma.identity.findUnique({
    where: { id: user.identityId },
  });
  if (!identity) return NextResponse.json({ error: 'Identity not found' }, { status: 404 });

  // Check admin permission
  if (
    !(await can({
      identity,
      action: 'units:list',
      resource: { resourceType: 'platform' },
    }))
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const projectId = req.nextUrl.searchParams.get('projectId');
    const status = req.nextUrl.searchParams.get('status');
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0');

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId query parameter is required' },
        { status: 400 }
      );
    }

    const units = await prisma.unit.findMany({
      where: {
        projectId,
        ...(status && { status: status as any }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await prisma.unit.count({
      where: {
        projectId,
        ...(status && { status: status as any }),
      },
    });

    return NextResponse.json({
      items: units,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch units' },
      { status: 400 }
    );
  }
}
