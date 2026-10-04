import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getAuthorizedOperationalUnitIds } from '@/app/libs/projectScope';
import { prisma } from '@/lib/prisma';
import { generateOwnerStatement, OwnerStatementGenerationError } from '@/modules/finance';
import { getOperatingSpaceMembership, getOperatingSpaceUnitIds, hasOperatingSpaceCapability } from '@/modules/ops';

export async function POST(req:NextRequest){
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const body=await req.json().catch(()=>null) as {spaceId?:string;unitId?:string;periodStart?:string;periodEnd?:string}|null;
  const spaceId=body?.spaceId||'',unitId=body?.unitId||'';
  if(!spaceId||!unitId)return NextResponse.json({error:'spaceId and unitId are required'},{status:400});
  const space=await prisma.operatingSpace.findUnique({where:{id:spaceId},select:{id:true,status:true}});
  if(!space||space.status!=='active')return NextResponse.json({error:'Operating space not found'},{status:404});
  if(!user.isAdmin){
    const membership=await getOperatingSpaceMembership(prisma,spaceId,user.identityId);
    if(!membership?.active||!(await hasOperatingSpaceCapability(prisma,spaceId,user.identityId,'generate_owner_report'))){
      return NextResponse.json({error:'Owner report capability required'},{status:403});
    }
  }
  const spaceUnitIds=await getOperatingSpaceUnitIds(prisma,spaceId);
  const authorized=user.isAdmin?spaceUnitIds:await getAuthorizedOperationalUnitIds(user,spaceUnitIds,['finance','reservations']);
  if(!authorized.includes(unitId))return NextResponse.json({error:'Unit outside authorized scope'},{status:403});
  try{
    const statement=await generateOwnerStatement(prisma,{
      unitId,periodStart:body?.periodStart||'',periodEnd:body?.periodEnd||'',
    });
    return NextResponse.json({success:true,statement:{
      id:statement.id,status:statement.status,unitId:statement.unitId,
      periodStart:statement.periodStart.toISOString(),periodEnd:statement.periodEnd.toISOString(),
      grossRevenueTh:statement.grossRevenueTh,totalCostsTh:statement.totalCostsTh,
      noiTh:statement.noiTh,ownerShareTh:statement.ownerShareTh,
    }},{status:201});
  }catch(error){
    if(error instanceof OwnerStatementGenerationError){
      return NextResponse.json({error:error.message,...error.details},{status:error.status});
    }
    console.error('[ops statement] generation failed',error);
    return NextResponse.json({error:'Statement generation failed'},{status:500});
  }
}
