import { NextResponse } from 'next/server';
import { requireAdmin, failed } from '@/app/libs/onboardingGuard';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: unknown,
  { params }: { params: { contractId: string } }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  try {
    const contract = await prisma.managementContract.findUnique({
      where: { id: params.contractId },
      include: {
        unit: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        ownerIdentity: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    const fees = await prisma.earnedFee.findMany({
      where: { managementContractId: params.contractId },
      orderBy: { periodStart: 'desc' },
    });

    const totals = { accrued: 0, invoiced: 0, paid: 0 };
    for (const fee of fees) {
      totals[fee.status] += fee.amount;
    }

    return NextResponse.json({
      success: true,
      contract: {
        id: contract.id,
        unitId: contract.unitId,
        unitName: contract.unit.name,
        projectId: contract.projectId,
        projectName: contract.project.name,
        ownerIdentityId: contract.ownerIdentityId,
        ownerName: `${contract.ownerIdentity.firstName} ${contract.ownerIdentity.lastName}`,
        ownerEmail: contract.ownerIdentity.email,
        status: contract.status,
      },
      fees: fees.map((fee) => ({
        id: fee.id,
        feeType: fee.feeType,
        periodStart: fee.periodStart.toISOString().split('T')[0],
        periodEnd: fee.periodEnd.toISOString().split('T')[0],
        calculationBasis: fee.calculationBasis,
        amount: fee.amount,
        status: fee.status,
        invoiceId: fee.invoiceId,
        paidAt: fee.paidAt?.toISOString() ?? null,
        createdAt: fee.createdAt.toISOString(),
      })),
      totals,
      summary: {
        total: totals.accrued + totals.invoiced + totals.paid,
        accrued: totals.accrued,
        invoiced: totals.invoiced,
        paid: totals.paid,
      },
    });
  } catch (error) {
    console.error('[FEES GET]', error);
    return failed(error, 'Internal server error');
  }
}
