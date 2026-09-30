import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { hasProjectDepartmentAccess } from '@/app/libs/projectScope';
import { prisma } from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/encryption';

export const dynamic='force-dynamic';
export const runtime='nodejs';

async function authorized(unitId:string) {
  const user=await getCurrentUser();
  if(!user)return {status:401 as const};
  const unit=await prisma.unit.findUnique({where:{id:unitId},select:{id:true,projectId:true}});
  if(!unit)return {status:404 as const};
  if(!(await hasProjectDepartmentAccess(user,unit.projectId,'front_desk')))return {status:403 as const};
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
    if(typeof body.entryCode!=='string'||body.entryCode.length>100||
      typeof body.handoverNotes!=='string'||body.handoverNotes.length>2000){
      return NextResponse.json({error:'Invalid access instructions'},{status:400,headers:noStore});
    }
    const ciphertext=encrypt(JSON.stringify({entryCode:body.entryCode, handoverNotes:body.handoverNotes}));
    await prisma.unitAccessInstruction.upsert({where:{unitId:params.id},
      create:{unitId:params.id,ciphertext,updatedById:access.user.identityId},
      update:{ciphertext,updatedById:access.user.identityId}});
    return NextResponse.json({saved:true},{headers:noStore});
  }catch {
    // Never echo a secret or a decryption exception in a response or log.
    return NextResponse.json({error:'Access instructions could not be saved'},{status:400,headers:noStore});
  }
}
