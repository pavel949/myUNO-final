import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/app/libs/onboardingGuard';
import { generateOwnerStatement, OwnerStatementGenerationError } from '@/modules/finance';

export const dynamic='force-dynamic';

export async function POST(req:NextRequest){
  const guard=await requireAdmin();
  if(!guard.ok)return guard.error;
  try{
    const body=await req.json() as {unitId?:string;periodStart?:string;periodEnd?:string};
    const statement=await generateOwnerStatement(prisma,{
      unitId:body.unitId||'',periodStart:body.periodStart||'',periodEnd:body.periodEnd||'',
    });
    return NextResponse.json({
      success:true,
      statement:{
        id:statement.id,unitId:statement.unitId,ownerEmail:statement.owner.email,
        periodStart:statement.periodStart.toISOString(),periodEnd:statement.periodEnd.toISOString(),
        grossBookingsAmountThb:statement.grossBookingsAmountTh,
        guestPaymentsReceivedThb:statement.guestPaymentsReceivedTh,
        serviceFeesAmountThb:statement.serviceFeesAmountTh,
        operatingExpensesAmountThb:statement.operatingExpensesAmountTh,
        taxesAmountThb:statement.taxesAmountTh,
        adjustedNoiThb:statement.adjustedNoiTh,
        distributableCashThb:statement.distributableCashTh,
        performanceFeeAmountThb:statement.performanceFeeAmountTh,
        performanceFeeBasisText:statement.performanceFeeBasisText,
        ownerShareThb:statement.ownerShareTh,
        estateShareThb:statement.estateShareTh,
        capApplied:statement.capApplied,
        lineItemCount:statement._count.lineItems,
        status:statement.status,
      },
    });
  }catch(error){
    if(error instanceof OwnerStatementGenerationError){
      return NextResponse.json({error:error.message,...error.details},{status:error.status});
    }
    console.error('[owner-statement] generation failed',error);
    return NextResponse.json({error:'Statement generation failed'},{status:500});
  }
}
