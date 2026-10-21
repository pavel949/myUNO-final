import { prisma } from '@/lib/prisma';
import { viewOfferShare } from '@/modules/sales-offers/share.service';
import { offerFailure,offerResponse } from '@/modules/sales-offers/http';
import { getLabels } from '@/lib/i18n';
import { SALES_DRAFTS,SALES_LABELS } from '@/modules/content/sales-offer.seed';
import { offerText } from '@/modules/sales-offers/presentation';
import { checkRateLimit } from '@/app/libs/rateLimit';
export async function POST(req:Request) {
  const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
  const limit=await checkRateLimit('sales-proposal:'+ip,{maxAttempts:60,windowMs:60000,backoffMs:30000});
  if(!limit.allowed)return offerResponse({code:'RATE_LIMITED'},429);
  try{
    // Token is never placed in URL, analytics, error messages or logs.
    const body=await req.json();const result=await viewOfferShare(prisma,body.token);
    const labels=await getLabels(SALES_LABELS,result.offer.locale,SALES_DRAFTS);
    return offerResponse({...result,labels,text:offerText(result.offer,labels)});
  }catch(error){return offerFailure(error);}
}
