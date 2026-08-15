import { getCurrentUser } from '@/app/actions/getCurrentUser'
import { NextRequest, NextResponse } from 'next/server'
import prismadb from '@/app/libs/prismadb'
import { FeeType } from '@prisma/client'

export const dynamic = 'force-dynamic'

interface CalculateFeeRequest {
  contractId: string
  periodStart: string
  periodEnd: string
  gop?: number
  noi?: number
  grossBooking?: number
  feeType?: FeeType
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser || !currentUser.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      )
    }

    const body: CalculateFeeRequest = await req.json()

    if (!body.contractId || !body.periodStart || !body.periodEnd) {
      return NextResponse.json(
        { error: 'Missing required fields: contractId, periodStart, periodEnd' },
        { status: 400 }
      )
    }

    // Get the contract
    const contract = await prismadb.managementContract.findUnique({
      where: { id: body.contractId },
    })

    if (!contract) {
      return NextResponse.json(
        { error: 'Contract not found' },
        { status: 404 }
      )
    }

    // Calculate fees based on basis
    const calculatedFees = []
    let managementFeeAmount = 0
    let calculationBasis = ''

    // Management fee calculation
    if (contract.managementFeeBasis === 'fixed' && contract.managementFeeFixedAmount) {
      managementFeeAmount = contract.managementFeeFixedAmount
      calculationBasis = 'fixed_amount'
    } else if (contract.managementFeeBasis === 'percentage_gop' && body.gop && contract.managementFeeRate) {
      managementFeeAmount = Math.round(body.gop * contract.managementFeeRate.toNumber())
      calculationBasis = `percentage_gop (${body.gop} THB × ${contract.managementFeeRate.toNumber() * 100}%)`
    } else if (contract.managementFeeBasis === 'percentage_noi' && body.noi && contract.managementFeeRate) {
      managementFeeAmount = Math.round(body.noi * contract.managementFeeRate.toNumber())
      calculationBasis = `percentage_noi (${body.noi} THB × ${contract.managementFeeRate.toNumber() * 100}%)`
    } else if (contract.managementFeeBasis === 'percentage_gross_booking' && body.grossBooking && contract.managementFeeRate) {
      managementFeeAmount = Math.round(body.grossBooking * contract.managementFeeRate.toNumber())
      calculationBasis = `percentage_gross_booking (${body.grossBooking} THB × ${contract.managementFeeRate.toNumber() * 100}%)`
    }

    // Create management fee entry
    const managementFee = await prismadb.earnedFee.create({
      data: {
        managementContractId: body.contractId,
        feeType: 'management',
        periodStart: new Date(body.periodStart),
        periodEnd: new Date(body.periodEnd),
        calculationBasis,
        amount: managementFeeAmount,
        status: 'accrued',
      },
    })

    calculatedFees.push({
      id: managementFee.id,
      feeType: managementFee.feeType,
      amount: managementFee.amount,
      calculationBasis: managementFee.calculationBasis,
      status: managementFee.status,
    })

    // Performance fee calculation
    let performanceFeeAmount = 0
    let performanceCalculationBasis = ''

    if (
      contract.performanceFeeEnabled &&
      contract.performanceFeeRate &&
      body.noi &&
      contract.performanceFeeBaseline &&
      body.noi > contract.performanceFeeBaseline
    ) {
      const excess = body.noi - contract.performanceFeeBaseline
      performanceFeeAmount = Math.round(excess * contract.performanceFeeRate.toNumber())
      performanceCalculationBasis = `performance_noi (${body.noi} THB - ${contract.performanceFeeBaseline} THB baseline) × ${contract.performanceFeeRate.toNumber() * 100}%`

      const performanceFee = await prismadb.earnedFee.create({
        data: {
          managementContractId: body.contractId,
          feeType: 'performance',
          periodStart: new Date(body.periodStart),
          periodEnd: new Date(body.periodEnd),
          calculationBasis: performanceCalculationBasis,
          amount: performanceFeeAmount,
          status: 'accrued',
        },
      })

      calculatedFees.push({
        id: performanceFee.id,
        feeType: performanceFee.feeType,
        amount: performanceFee.amount,
        calculationBasis: performanceFee.calculationBasis,
        status: performanceFee.status,
      })
    }

    return NextResponse.json({
      success: true,
      fees: calculatedFees,
      totalAmount: managementFeeAmount + performanceFeeAmount,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
    })
  } catch (error) {
    console.error('[FEE CALCULATE]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
