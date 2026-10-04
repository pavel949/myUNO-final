import type { PrismaClient } from '@prisma/client';
import {
  BookingStatus,
  LedgerEntryType,
  LineItemCategory,
  OwnerStatementStatus,
  Prisma,
} from '@prisma/client';
import { getConfig } from '@/modules/config';

type DbClient=PrismaClient|Prisma.TransactionClient;

export class OwnerStatementGenerationError extends Error {
  status:number;
  details:Record<string,unknown>;
  constructor(message:string,status=400,details:Record<string,unknown>={}){
    super(message);this.name='OwnerStatementGenerationError';this.status=status;this.details=details;
  }
}

export interface GenerateOwnerStatementInput{
  unitId:string;
  periodStart:string;
  periodEnd:string;
}

const REVENUE_BOOKING_STATUSES:BookingStatus[]=['confirmed','checked_in','checked_out','completed'];
const OPERATING_EXPENSE_ENTRY_TYPES:LedgerEntryType[]=[
  'cleaning_cost','maintenance_cost','consumables_cost','utilities_cost','setup_fee','ota_commission_cost',
];

export async function generateOwnerStatement(db:PrismaClient,input:GenerateOwnerStatementInput){
  if(!input.unitId||!input.periodStart||!input.periodEnd)throw new OwnerStatementGenerationError('Missing required fields: unitId, periodStart, periodEnd');
  const startDate=new Date(input.periodStart);
  const endDate=new Date(input.periodEnd);
  if(Number.isNaN(startDate.getTime())||Number.isNaN(endDate.getTime()))throw new OwnerStatementGenerationError('Invalid date format. Use YYYY-MM-DD');
  if(startDate>endDate)throw new OwnerStatementGenerationError('periodStart must be before periodEnd');

  const unit=await db.unit.findUnique({
    where:{id:input.unitId},
    include:{engagements:{where:{status:'active'},take:1}},
  });
  if(!unit)throw new OwnerStatementGenerationError('Unit not found',404);
  const engagement=unit.engagements[0];
  if(!engagement)throw new OwnerStatementGenerationError('Unit has no active engagement configuration');
  if(engagement.engagementType==='direct_managed'&&!engagement.noiCapAnnualThb){
    throw new OwnerStatementGenerationError('Statement generation refused: direct-managed unit has no noi_cap_annual_thb. Set the cap on the engagement first.');
  }

  const existing=await db.ownerStatement.findFirst({
    where:{unitId:input.unitId,periodStart:startDate,periodEnd:endDate},
    select:{id:true},
  });
  if(existing)throw new OwnerStatementGenerationError('A statement for this unit and period already exists',409,{statementId:existing.id});

  const nextPeriodDay=new Date(endDate.getTime()+24*60*60*1000);
  const crossingStay=await db.booking.findFirst({
    where:{
      unitId:input.unitId,status:{in:REVENUE_BOOKING_STATUSES},
      startDate:{lt:nextPeriodDay},endDate:{gt:startDate},
      OR:[{startDate:{lt:startDate}},{endDate:{gt:nextPeriodDay}}],
    },
    select:{id:true},
  });
  if(crossingStay)throw new OwnerStatementGenerationError(
    'A stay crosses this accounting period. Resolve the stay allocation policy before generating a statement.',
    409,{bookingId:crossingStay.id}
  );

  const bookings=await db.booking.findMany({
    where:{unitId:input.unitId,startDate:{gte:startDate},endDate:{lte:nextPeriodDay},status:{in:REVENUE_BOOKING_STATUSES}},
    orderBy:{startDate:'asc'},
    select:{id:true,startDate:true,endDate:true,totalThb:true},
  });
  const bookingIds=bookings.map(b=>b.id);
  const grossBookingsThb=bookings.reduce((sum,b)=>sum+(b.totalThb||0),0);

  const guestPayments=bookingIds.length?await db.payment.aggregate({
    where:{bookingId:{in:bookingIds},status:'succeeded',purpose:{in:['stay','stay_balance']}},
    _sum:{amountThb:true},
  }):{_sum:{amountThb:0}};
  const guestPaymentsReceivedThb=guestPayments._sum.amountThb||0;

  const ledgerEntries=await db.ledgerEntry.findMany({
    where:{
      unitId:input.unitId,occurredOn:{gte:startDate,lt:nextPeriodDay},
      entryType:{in:['refund_out','tax_collected',...OPERATING_EXPENSE_ENTRY_TYPES]},
    },
    orderBy:{occurredOn:'asc'},
    select:{id:true,entryType:true,amountThb:true,description:true,bookingId:true,occurredOn:true},
  });
  const sumEntries=(types:LedgerEntryType[])=>ledgerEntries.filter(entry=>types.includes(entry.entryType)).reduce((sum,entry)=>sum+Math.abs(entry.amountThb),0);
  const refundsThb=sumEntries(['refund_out']);
  const operatingExpensesThb=sumEntries(OPERATING_EXPENSE_ENTRY_TYPES);
  const taxesThb=sumEntries(['tax_collected']);

  const serviceFeePct=(await getConfig(db,'finance.statement.service_fee_pct',{unitId:unit.id,projectId:unit.projectId}))??0;
  const serviceFeesThb=Math.round((grossBookingsThb*serviceFeePct)/100);
  const adjustedNoiThb=grossBookingsThb-refundsThb-serviceFeesThb-operatingExpensesThb-taxesThb;

  const contract=await db.managementContract.findFirst({
    where:{unitId:unit.id,status:'active',performanceFeeEnabled:true},
    orderBy:{contractStartDate:'desc'},
  });
  let performanceFeeThb=0;
  let performanceFeeBasisText:string|null=null;
  if(contract?.performanceFeeRate){
    const baseline=contract.performanceFeeBaseline??0;
    const excess=Math.max(0,adjustedNoiThb-baseline);
    const rate=Number(contract.performanceFeeRate);
    performanceFeeThb=Math.round(excess*rate);
    performanceFeeBasisText=`${contract.performanceFeeBasis??'adjusted_noi'} above baseline ${baseline} THB at rate ${rate} (contract ${contract.id})`;
  }
  const distributableCashThb=adjustedNoiThb-performanceFeeThb;

  let ownerShareThb=0;
  let estateShareThb=0;
  let capApplied=false;
  if(engagement.engagementType==='direct_managed'){
    const daysInPeriod=Math.round((endDate.getTime()-startDate.getTime())/(1000*60*60*24))+1;
    const capProRataThb=Math.round((engagement.noiCapAnnualThb!*daysInPeriod)/365);
    ownerShareThb=Math.min(distributableCashThb,capProRataThb);
    estateShareThb=serviceFeesThb+performanceFeeThb+Math.max(0,distributableCashThb-capProRataThb);
    capApplied=capProRataThb<distributableCashThb;
  }else if(engagement.engagementType==='via_management_company'){
    const mcFeePct=(await getConfig(db,'engagement.via_mc.platform_fee_pct',{unitId:unit.id,projectId:unit.projectId}))??0;
    const mcFeeThb=Math.round((distributableCashThb*mcFeePct)/100);
    ownerShareThb=distributableCashThb-mcFeeThb;
    estateShareThb=serviceFeesThb+performanceFeeThb+mcFeeThb;
  }else{
    const bookingFeePct=(await getConfig(db,'engagement.owner_direct.booking_fee_pct',{unitId:unit.id,projectId:unit.projectId}))??0;
    const bookingFeeThb=Math.round((distributableCashThb*bookingFeePct)/100);
    ownerShareThb=distributableCashThb-bookingFeeThb;
    estateShareThb=serviceFeesThb+performanceFeeThb+bookingFeeThb;
  }
  const totalCostsThb=refundsThb+serviceFeesThb+operatingExpensesThb+taxesThb;

  const lineItems:Prisma.StatementLineItemCreateManyStatementInput[]=[];
  for(const booking of bookings)lineItems.push({
    category:'booking_revenue' as LineItemCategory,
    description:`Booking ${booking.id} (${booking.startDate.toISOString().slice(0,10)} → ${booking.endDate.toISOString().slice(0,10)})`,
    amountTh:booking.totalThb||0,bookingId:booking.id,
  });
  for(const entry of ledgerEntries){
    const category:LineItemCategory=entry.entryType==='refund_out'?'refund':entry.entryType==='tax_collected'?'tax':'operating_expense';
    lineItems.push({category,description:`${entry.entryType}: ${entry.description}`,amountTh:Math.abs(entry.amountThb),bookingId:entry.bookingId});
  }
  if(serviceFeesThb!==0)lineItems.push({category:'service_fee' as LineItemCategory,description:`myUNO service fee ${serviceFeePct}% of gross bookings ${grossBookingsThb} THB`,amountTh:serviceFeesThb});
  if(performanceFeeThb!==0&&performanceFeeBasisText)lineItems.push({category:'performance_fee' as LineItemCategory,description:performanceFeeBasisText,amountTh:performanceFeeThb});

  return db.ownerStatement.create({
    data:{
      unitId:input.unitId,ownerIdentityId:engagement.ownerIdentityId,engagementId:engagement.id,
      periodStart:startDate,periodEnd:endDate,grossRevenueTh:grossBookingsThb,totalCostsTh:totalCostsThb,
      noiTh:adjustedNoiThb,ownerShareTh:ownerShareThb,estateShareTh:estateShareThb,capApplied,status:'draft' as OwnerStatementStatus,
      grossBookingsAmountTh:grossBookingsThb,guestPaymentsReceivedTh:guestPaymentsReceivedThb,
      serviceFeesAmountTh:serviceFeesThb,operatingExpensesAmountTh:operatingExpensesThb,taxesAmountTh:taxesThb,
      adjustedNoiTh:adjustedNoiThb,distributableCashTh:distributableCashThb,performanceFeeAmountTh:performanceFeeThb,
      performanceFeeBasisText,lineItems:{createMany:{data:lineItems}},
    },
    include:{owner:{select:{id:true,email:true,firstName:true,lastName:true}},_count:{select:{lineItems:true}}},
  });
}
