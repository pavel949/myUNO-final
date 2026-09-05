import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, failed } from '@/app/libs/onboardingGuard';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

interface CalculateFeeRequest {
  contractId: string;
  periodStart: string;
  periodEnd: string;
  gop?: number;
  noi?: number;
  grossBooking?: number;
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.error;

  try {
    const body: CalculateFeeRequest = await req.json();

    if (!body.contractId || !body.periodStart || !body.periodEnd) {
      return NextResponse.json(
        { error: 'Missing required fields: contractId, periodStart, periodEnd' },
        { status: 400 }
      );
    }

    const contract = await prisma.managementContract.findUnique({
      where: { id: body.contractId },
    });

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    const calculatedFees: Array<{
      id: string;
      feeType: string;
      amount: number;
      calculationBasis: string;
      status: string;
    }> = [];

    let managementFeeAmount = 0;
    let calculationBasis = '';
    const rate = contract.managementFeeRate?.toNumber() ?? 0;

    if (contract.managementFeeBasis === 'fixed' && contract.managementFeeFixedAmount) {
      managementFeeAmount = contract.managementFeeFixedAmount;
      calculationBasis = 'fixed_amount';
    } else if (contract.managementFeeBasis === 'percentage_gop' && body.gop && contract.managementFeeRate) {
      managementFeeAmount = Math.round(body.gop * rate);
      calculationBasis = `percentage_gop (${body.gop} THB × ${rate * 100}%)`;
    } else if (contract.managementFeeBasis === 'percentage_noi' && body.noi && contract.managementFeeRate) {
      managementFeeAmount = Math.round(body.noi * rate);
      calculationBasis = `percentage_noi (${body.noi} THB × ${rate * 100}%)`;
    } else if (
      contract.managementFeeBasis === 'percentage_gross_booking' &&
      body.grossBooking &&
      contract.managementFeeRate
    ) {
      managementFeeAmount = Math.round(body.grossBooking * rate);
      calculationBasis = `percentage_gross_booking (${body.grossBooking} THB × ${rate * 100}%)`;
    }

    const managementFee = await prisma.earnedFee.create({
      data: {
        managementContractId: body.contractId,
        feeType: 'management',
        periodStart: new Date(body.periodStart),
        periodEnd: new Date(body.periodEnd),
        calculationBasis,
        amount: managementFeeAmount,
        status: 'accrued',
      },
    });

    calculatedFees.push({
      id: managementFee.id,
      feeType: managementFee.feeType,
      amount: managementFee.amount,
      calculationBasis: managementFee.calculationBasis,
      status: managementFee.status,
    });

    let performanceFeeAmount = 0;

    if (
      contract.performanceFeeEnabled &&
      contract.performanceFeeRate &&
      body.noi &&
      contract.performanceFeeBaseline &&
      body.noi > contract.performanceFeeBaseline
    ) {
      const perfRate = contract.performanceFeeRate.toNumber();
      const excess = body.noi - contract.performanceFeeBaseline;
      performanceFeeAmount = Math.round(excess * perfRate);
      const performanceCalculationBasis = `performance_noi (${body.noi} THB - ${contract.performanceFeeBaseline} THB baseline) × ${perfRate * 100}%`;

      const performanceFee = await prisma.earnedFee.create({
        data: {
          managementContractId: body.contractId,
          feeType: 'performance',
          periodStart: new Date(body.periodStart),
          periodEnd: new Date(body.periodEnd),
          calculationBasis: performanceCalculationBasis,
          amount: performanceFeeAmount,
          status: 'accrued',
        },
      });

      calculatedFees.push({
        id: performanceFee.id,
        feeType: performanceFee.feeType,
        amount: performanceFee.amount,
        calculationBasis: performanceFee.calculationBasis,
        status: performanceFee.status,
      });
    }

    return NextResponse.json({
      success: true,
      fees: calculatedFees,
      totalAmount: managementFeeAmount + performanceFeeAmount,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
    });
  } catch (error) {
    console.error('[FEE CALCULATE]', error);
    return failed(error, 'Internal server error');
  }
}
