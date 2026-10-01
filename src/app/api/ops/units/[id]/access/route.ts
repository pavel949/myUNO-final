import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { hasProjectDepartmentAccess } from '@/app/libs/projectScope';
import { prisma } from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/encryption';
import { canWriteUnitListing } from '@/modules/core';

export const dynamic='force-dynamic';
export const runtime='nodejs';

async function authorized(unitId:string) {
  const user=await getCurrentUser();
  if(!user)return {status:401 as const};
  const unit=await prisma.unit.findUnique({where:{id:unitId},select:{id:true,projectId:true}});
  if(!unit)return {status:404 as const};
  if(await hasProjectDepartmentAccess(user,unit.projectId,'front_desk'))return {status:200 as const,user,unit};
  const identity=await prisma.identity.findUnique({where:{id:user.identityId}});
  if(!identity)return {status:404 as const};
  if(!(await canWriteUnitListing(prisma,identity,unit.id,unit.projectId)))return {status:403 as const};
  return {status:200 as const,user,unit};
}
const noStore={'Cache-Control':'private, no-store'};
/** Access codes are never returned in property search, public listing, or room calendar responses. */
export async function GET(_request:NextRequest,{params}:{params:{id:string}}){
  const access=await authorized(params.id);
  if(access.status!==200)return NextResponse.json({error:'Not available'},{status:access.status,headers:noStore});
  const record=await prisma.unitAccessInstruction.findUnique({where:{unitId:params.id},select:{ciphertext:true,updatedAt:true}});
  if(!record)return NextResponse.json({instructions:null},{headers:noStore});
  return NextResponse.json({instructions:JSON.parse(decrypt(record.ciphertext)),updatedAt:record.updatedAt},{headers:noStore});
}
export async function PUT(req:NextRequest,{params}:{params:{id:string}}){
  const access=await authorized(params.id);
  if(access.status!==200)return NextResponse.json({error:'Not available'},{status:access.status,headers:noStore});
  try {
    const body=await req.json();
    const fields={
      checkInMethod: typeof body.checkInMethod==='string' ? body.checkInMethod.trim().slice(0,40) : '',
      entryCode: typeof body.entryCode==='string' ? body.entryCode.trim().slice(0,100) : '',
      lockboxLocation: typeof body.lockboxLocation==='string' ? body.lockboxLocation.trim().slice(0,500) : '',
      lockboxCode: typeof body.lockboxCode==='string' ? body.lockboxCode.trim().slice(0,100) : '',
      wifiSsid: typeof body.wifiSsid==='string' ? body.wifiSsid.trim().slice(0,200) : '',
      wifiPassword: typeof body.wifiPassword==='string' ? body.wifiPassword.slice(0,200) : '',
      parkingInstructions: typeof body.parkingInstructions==='string' ? body.parkingInstructions.trim().slice(0,1000) : '',
      arrivalNotes: typeof body.arrivalNotes==='string'
        ? body.arrivalNotes.trim().slice(0,2000)
        : typeof body.handoverNotes==='string'
          ? body.handoverNotes.trim().slice(0,2000)
          : '',
      emergencyContact: typeof body.emergencyContact==='string' ? body.emergencyContact.trim().slice(0,300) : '',
    };
    if(fields.checkInMethod && !['smart_lock','keypad','lockbox','key_handover','other'].includes(fields.checkInMethod)){
      return NextResponse.json({error:'Invalid check-in method'},{status:400,headers:noStore});
    }
    const ciphertext=encrypt(JSON.stringify(fields));
    await prisma.unitAccessInstruction.upsert({where:{unitId:params.id},
      create:{unitId:params.id,ciphertext,updatedById:access.user.identityId},
      update:{ciphertext,updatedById:access.user.identityId}});
    return NextResponse.json({saved:true},{headers:noStore});
  }catch {
    // Never echo a secret or a decryption exception in a response or log.
    return NextResponse.json({error:'Access instructions could not be saved'},{status:400,headers:noStore});
  }
}
