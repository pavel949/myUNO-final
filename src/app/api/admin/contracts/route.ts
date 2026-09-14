import { NextRequest, NextResponse } from 'next/server';
import { ManagementFeeBasis } from '@prisma/client';
import { requireAdmin, failed } from '@/app/libs/onboardingGuard';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

interface CreateContractRequest {
  unitId: string;
  /**
   * Optional and never authoritative — the contract is filed against the
   * unit's own project. Sent only so a caller that disagrees is refused
   * instead of silently writing a contract into the wrong project.
   */
  projectId?: string;
  ownerIdentityId: string;
  managementFeeBasis: ManagementFeeBasis;
  managementFeeRate?: number;
  managementFeeFixedAmount?: number;
  performanceFeeEnabled?: boolean;
  performanceFeeBasis?: string;
  performanceFeeRate?: number;
  performanceFeeBaseline?: number;
  contractStartDate: string;
  contractEndDate?: string;
}

function serializeContract(contract: {
  id: string;
  unitId: string;
  projectId: string;
  ownerIdentityId: string;
  managementFeeBasis: ManagementFeeBasis;
  managementFeeRate: { toNumber(): number } | null;
  managementFeeFixedAmount: number | null;
  performanceFeeEnabled: boolean;
  performanceFeeBasis: string | null;
  performanceFeeRate: { toNumber(): number } | null;
  performanceFeeBaseline: number | null;
  contractStartDate: Date;
  contractEndDate: Date | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  unit: { id: string; name: string };
  project: { id: string; name: string };
  ownerIdentity: { id: string; firstName: string; lastName: string; email: string | null };
}) {
  return {
    id: contract.id,
    unitId: contract.unitId,
    unitName: contract.unit.name,
    projectId: contract.projectId,
    projectName: contract.project.name,
    ownerIdentityId: contract.ownerIdentityId,
    ownerName: `${contract.ownerIdentity.firstName} ${contract.ownerIdentity.lastName}`,
    ownerEmail: contract.ownerIdentity.email,
    managementFeeBasis: contract.managementFeeBasis,
    managementFeeRate: contract.managementFeeRate?.toNumber() ?? null,
    managementFeeFixedAmount: contract.managementFeeFixedAmount,
    performanceFeeEnabled: contract.performanceFeeEnabled,
    performanceFeeBasis: contract.performanceFeeBasis,
    performanceFeeRate: contract.performanceFeeRate?.toNumber() ?? null,
    performanceFeeBaseline: contract.performanceFeeBaseline,
    status: contract.status,
    contractStartDate: contract.contractStartDate.toISOString().split('T')[0],
    contractEndDate: contract.contractEndDate?.toISOString().split('T')[0] ?? null,
    createdAt: contract.createdAt.toISOString(),
    updatedAt: contract.updatedAt.toISOString(),
  };
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  try {
    const body: CreateContractRequest = await req.json();

    if (
      !body.unitId ||
      !body.ownerIdentityId ||
      !body.managementFeeBasis ||
      !body.contractStartDate
    ) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: unitId, ownerIdentityId, managementFeeBasis, contractStartDate',
        },
        { status: 400 }
      );
    }

    if (body.managementFeeBasis === 'fixed' && !body.managementFeeFixedAmount) {
      return NextResponse.json(
        { error: 'Fixed fee basis requires managementFeeFixedAmount' },
        { status: 400 }
      );
    }

    if (body.managementFeeBasis !== 'fixed' && !body.managementFeeRate) {
      return NextResponse.json(
        { error: `${body.managementFeeBasis} fee basis requires managementFeeRate` },
        { status: 400 }
      );
    }

    const [unit, owner] = await Promise.all([
      prisma.unit.findUnique({ where: { id: body.unitId } }),
      prisma.identity.findUnique({ where: { id: body.ownerIdentityId } }),
    ]);

    if (!unit) return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    if (!owner) return NextResponse.json({ error: 'Owner identity not found' }, { status: 404 });

    // The unit decides the project. Both ids used to be accepted independently
    // — each checked only for existence — so a contract could be filed against
    // a project that does not contain the unit, on the document that decides
    // whether a performance fee is owed.
    const contractProjectId = unit.projectId;
    if (body.projectId && body.projectId !== contractProjectId) {
      return NextResponse.json(
        { error: 'Unit does not belong to the given project' },
        { status: 400 }
      );
    }

    const contract = await prisma.managementContract.create({
      data: {
        unitId: body.unitId,
        projectId: contractProjectId,
        ownerIdentityId: body.ownerIdentityId,
        managementFeeBasis: body.managementFeeBasis,
        managementFeeRate: body.managementFeeRate ?? null,
        managementFeeFixedAmount: body.managementFeeFixedAmount ?? null,
        performanceFeeEnabled: body.performanceFeeEnabled ?? false,
        performanceFeeBasis: body.performanceFeeBasis ?? null,
        performanceFeeRate: body.performanceFeeRate ?? null,
        performanceFeeBaseline: body.performanceFeeBaseline ?? null,
        contractStartDate: new Date(body.contractStartDate),
        contractEndDate: body.contractEndDate ? new Date(body.contractEndDate) : null,
      },
      include: {
        unit: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        ownerIdentity: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    return NextResponse.json({ success: true, contract: serializeContract(contract) });
  } catch (error) {
    console.error('[CONTRACT CREATE]', error);
    return failed(error, 'Internal server error');
  }
}

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  try {
    const contracts = await prisma.managementContract.findMany({
      include: {
        unit: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        ownerIdentity: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { contractStartDate: 'desc' },
    });

    return NextResponse.json({
      success: true,
      contracts: contracts.map(serializeContract),
      total: contracts.length,
    });
  } catch (error) {
    console.error('[CONTRACTS LIST]', error);
    return failed(error, 'Internal server error');
  }
}
