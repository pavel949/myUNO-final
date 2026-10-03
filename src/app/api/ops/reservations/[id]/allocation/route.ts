import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getDepartmentProjectIds, getMCProjectScopes } from '@/app/libs/projectScope';
import { prisma } from '@/lib/prisma';
import { getOperatingSpaceUnitIds, hasOperatingSpaceCapability } from '@/modules/ops';
import { getMCManagedUnits } from '@/modules/projects';
import { finalizeCategoryBookingAllocation } from '@/modules/booking';

async function authorizedUnitIds(
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>,
  operatingSpaceId: string,
) {
  const spaceUnitIds=await getOperatingSpaceUnitIds(prisma,operatingSpaceId);
  if(user.isAdmin)return spaceUnitIds;

  const canManage=await hasOperatingSpaceCapability(
    prisma,operatingSpaceId,user.identityId,'manage_reservations',
  );
  if(!canManage)return [];

  const staffProjectIds=await getDepartmentProjectIds(user,[
    'reservations','front_desk','guest_care',
  ]);
  const mcIds=new Set<string>();
  for(const scope of getMCProjectScopes(user)){
    const managed=await getMCManagedUnits(
      prisma,user.identityId,scope.projectId,scope.organizationId,
    );
    for(const unit of managed)mcIds.add(unit.id);
  }

  return (await prisma.unit.findMany({
    where:{
      id:{in:spaceUnitIds},
      OR:[
        ...(staffProjectIds.length?[{projectId:{in:staffProjectIds}}]:[]),
        ...(mcIds.size?[{id:{in:Array.from(mcIds)}}]:[]),
      ],
    },
    select:{id:true},
  })).map(unit=>unit.id);
}

export async function PUT(
  request:NextRequest,
  {params}:{params:{id:string}},
){
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});

  try{
    const body=await request.json() as {operatingSpaceId?:string;unitId?:string};
    if(!body.operatingSpaceId||!body.unitId){
      return NextResponse.json({error:'Missing operating space or unit'},{status:400});
    }

    const allowed=await authorizedUnitIds(user,body.operatingSpaceId);
    if(!allowed.includes(body.unitId)){
      return NextResponse.json({error:'Forbidden'},{status:403});
    }

    const booking=await prisma.booking.findUnique({
      where:{id:params.id},
      select:{id:true,unitId:true},
    });
    if(!booking||!allowed.includes(booking.unitId)){
      return NextResponse.json({error:'Booking not found in this operating space'},{status:404});
    }

    const updated=await finalizeCategoryBookingAllocation(prisma,{
      bookingId:booking.id,
      unitId:body.unitId,
      actorIdentityId:user.identityId,
    });
    return NextResponse.json({booking:updated});
  }catch(error){
    const code=(error as {code?:string})?.code;
    return NextResponse.json(
      {error:error instanceof Error?error.message:'Allocation failed',...(code?{code}:{})},
      {status:code==='DOUBLE_BOOK'||code==='REQUOTE_REQUIRED'?409:400},
    );
  }
}
