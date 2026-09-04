import { logAudit } from '@/modules/audit';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { AssetStatus } from '@prisma/client';
import { requireAdmin } from '@/app/libs/onboardingGuard';

export const dynamic = 'force-dynamic';

interface AssetStatusRequest {
  status: AssetStatus;
  reason: string;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  try {
    const body: AssetStatusRequest = await req.json();

    if (!body.status || !body.reason?.trim()) {
      return NextResponse.json(
        { error: 'Missing required fields: status, reason' },
        { status: 400 }
      );
    }

    const validStatuses: AssetStatus[] = [
      'managed',
      'verified_partner',
      'one_off_sourced',
      'suspended',
    ];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const unit = await prisma.unit.findUnique({ where: { id: params.id } });
    if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });

    const currentStatus = unit.assetStatus;

    const updatedUnit = await prisma.unit.update({
      where: { id: params.id },
      data: {
        assetStatus: body.status,
        assetStatusChangedAt: new Date(),
        assetStatusReason: body.reason.trim(),
      },
    });

    await logAudit({
      actorIdentityId: guard.actorIdentityId,
      action: 'units:asset_status_changed',
      entityType: 'Unit',
      entityId: params.id,
      data: { from: currentStatus, to: body.status, reason: body.reason.trim() },
    });

    return NextResponse.json({
      success: true,
      unit: updatedUnit,
      message: `Asset status changed from ${currentStatus} to ${body.status}`,
    });
  } catch (error) {
    console.error('[UNIT ASSET STATUS]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
