import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { can } from '@/modules/core';
import { getConfig } from '@/modules/config/config.service';
import { updateConfigParameter, clearConfigOverride } from '@/modules/config/edit.service';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: { paramKey: string } }
) {
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
      action: 'config:view',
      resource: { resourceType: 'platform' },
    }))
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const param = await prisma.configParameter.findUnique({
      where: { key: params.paramKey },
    });

    if (!param) {
      return NextResponse.json({ error: 'Parameter not found' }, { status: 404 });
    }

    // Get global default
    const globalValue = await getConfig(prisma, params.paramKey as any);

    // Get all overrides
    const overrides = await prisma.configOverride.findMany({
      where: { parameterKey: params.paramKey },
    });

    return NextResponse.json({
      parameter: param,
      globalValue,
      overrides: overrides.map((o) => ({
        id: o.id,
        value: o.value,
        scopeType: o.scopeType,
        scopeId: o.scopeId,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch parameter' },
      { status: 400 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { paramKey: string } }
) {
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
      action: 'config:edit',
      resource: { resourceType: 'platform' },
    }))
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { newValue, projectId, unitId } = body;

    if (newValue === undefined) {
      return NextResponse.json(
        { error: 'newValue is required' },
        { status: 400 }
      );
    }

    await updateConfigParameter(prisma, {
      identityId: user.identityId,
      paramKey: params.paramKey as any,
      newValue,
      projectId,
      unitId,
    });

    // Return the updated value
    const updated = await getConfig(prisma, params.paramKey as any, { projectId, unitId });
    return NextResponse.json({ success: true, value: updated });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update config' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { paramKey: string } }
) {
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
      action: 'config:edit',
      resource: { resourceType: 'platform' },
    }))
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { projectId, unitId } = await req.json();

    await clearConfigOverride(prisma, user.identityId, params.paramKey as any, projectId, unitId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to clear override' },
      { status: 400 }
    );
  }
}
