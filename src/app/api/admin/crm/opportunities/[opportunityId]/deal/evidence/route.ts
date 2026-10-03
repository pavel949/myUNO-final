import { NextRequest, NextResponse } from 'next/server';
import { internalCrm as prisma } from '@/modules/agents/internal-crm';
import { requireAdmin, failed } from '@/app/libs/onboardingGuard';
import {
  saveDealEvidence, readDealEvidence,
  isAllowedDealEvidenceType, MAX_DEAL_EVIDENCE_BYTES,
} from '@/modules/crm/private-deal-evidence';

type Params={params:{opportunityId:string}};
export async function POST(req:NextRequest,{params}:Params){
  const guard=await requireAdmin();
  if(!guard.ok)return guard.error;
  try{
    const deal=await prisma.propertyDeal.findUnique({
      where:{opportunityId:params.opportunityId},select:{id:true,status:true},
    });
    if(!deal)return NextResponse.json({error:'agreement_not_found'},{status:404});
    if(['closed','cancelled'].includes(deal.status))
      return NextResponse.json({error:'agreement_not_editable'},{status:409});
    const form=await req.formData();
    const file=form.get('file');
    if(!(file instanceof File))throw new Error('private_evidence_file_required');
    if(!isAllowedDealEvidenceType(file.type)||file.size<1||
      file.size>MAX_DEAL_EVIDENCE_BYTES)throw new Error('invalid_private_evidence_file');
    const media=await saveDealEvidence(prisma,{
      buffer:Buffer.from(await file.arrayBuffer()),
      mimeType:file.type,actorIdentityId:guard.actorIdentityId,fileName:file.name,
    });
    return NextResponse.json({mediaAssetId:media.id},{status:201});
  }catch(error){return failed(error,'Private evidence upload unavailable');}
}

export async function GET(req:NextRequest,{params}:Params){
  const guard=await requireAdmin();
  if(!guard.ok)return guard.error;
  try{
    const mediaId=req.nextUrl.searchParams.get('mediaId');
    const deal=await prisma.propertyDeal.findUnique({
      where:{opportunityId:params.opportunityId},
      select:{contractMediaId:true,completionMediaId:true},
    });
    if(!deal||!mediaId||
      (deal.contractMediaId!==mediaId&&deal.completionMediaId!==mediaId))
      return NextResponse.json({error:'private_evidence_not_found'},{status:404});
    const media=await prisma.mediaAsset.findUnique({where:{id:mediaId},
      select:{storageKey:true,mimeType:true,encrypted:true}});
    if(!media?.encrypted)return NextResponse.json({error:'private_evidence_not_found'},{status:404});
    const plain=await readDealEvidence(media.storageKey);
    return new NextResponse(new Uint8Array(plain),{
      headers:{
        'Content-Type':media.mimeType,
        'Content-Disposition':'attachment; filename="agreement-evidence"',
        'Cache-Control':'private, no-store, max-age=0',
        'X-Content-Type-Options':'nosniff',
        'Content-Security-Policy':"default-src 'none'; sandbox",
      },
    });
  }catch(error){return failed(error,'Unable to retrieve private evidence');}
}
