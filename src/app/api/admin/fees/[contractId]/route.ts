import { getCurrentUser } from '@/app/actions/getCurrentUser'
import { NextResponse } from 'next/server'
import prismadb from '@/app/libs/prismadb'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: unknown,
  { params }: { params: { contractId: string } },
) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser || !currentUser.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      )
    }

    // Verify contract exists
    const contract = await prismadb.managementContract.findUnique({
      where: { id: params.contractId },
      include: {
        unit: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        ownerIdentity: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    })

    if (!contract) {
      return NextResponse.json(
        { error: 'Contract not found' },
        { status: 404 }
      )
    }

    // Get all earned fees for this contract
    const fees = await prismadb.earnedFee.findMany({
      where: { managementContractId: params.contractId },
      orderBy: { periodStart: 'desc' },
    })

    // Calculate totals by status
    const totals = {
      accrued: 0,
      invoiced: 0,
      paid: 0,
    }

    fees.forEach((fee) => {
      totals[fee.status] += fee.amount
    })

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
        paidAt: fee.paidAt?.toISOString() || null,
        createdAt: fee.createdAt.toISOString(),
      })),
      totals,
      summary: {
        total: totals.accrued + totals.invoiced + totals.paid,
        accrued: totals.accrued,
        invoiced: totals.invoiced,
        paid: totals.paid,
      },
    })
  } catch (error) {
    console.error('[FEES GET]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
