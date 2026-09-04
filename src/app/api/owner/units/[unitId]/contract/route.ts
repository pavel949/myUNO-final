import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { can } from '@/modules/core';

export const dynamic = 'force-dynamic';

/**
 * GET /api/owner/units/[unitId]/contract
 * Read-only management contract for an owner's unit (CLAUDE.md fee transparency).
 */
export async function GET(
  _req: unknown,
  { params }: { params: { unitId: string } }
) {
  const user = await getCurrentUser();
  if (!user?.identityId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const identity = await prisma.identity.findUnique({ where: { id: user.identityId } });
  if (!identity) {
    return NextResponse.json({ error: 'Identity not found' }, { status: 404 });
  }

  const unit = await prisma.unit.findUnique({
    where: { id: params.unitId },
    select: { id: true, name: true, projectId: true, ownerIdentityId: true },
  });

  if (!unit) {
    return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
  }

  if (
    !(await can({
      identity,
      action: 'units:view_full_record',
      resource: {
        projectId: unit.projectId,
        unitId: unit.id,
        ownerId: unit.ownerIdentityId ?? undefined,
      },
    }))
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const contract = await prisma.managementContract.findFirst({
    where: {
      unitId: unit.id,
      status: 'active',
    },
    orderBy: { contractStartDate: 'desc' },
    include: {
      project: { select: { name: true } },
    },
  });

  if (!contract) {
    return NextResponse.json({ contract: null });
  }

  return NextResponse.json({
    contract: {
      id: contract.id,
      unitName: unit.name,
      projectName: contract.project.name,
      managementFeeBasis: contract.managementFeeBasis,
      managementFeeRate: contract.managementFeeRate?.toNumber() ?? null,
      managementFeeFixedAmount: contract.managementFeeFixedAmount,
      performanceFeeEnabled: contract.performanceFeeEnabled,
      performanceFeeRate: contract.performanceFeeRate?.toNumber() ?? null,
      performanceFeeBaseline: contract.performanceFeeBaseline,
      contractStartDate: contract.contractStartDate.toISOString().split('T')[0],
      contractEndDate: contract.contractEndDate?.toISOString().split('T')[0] ?? null,
      status: contract.status,
    },
  });
}
