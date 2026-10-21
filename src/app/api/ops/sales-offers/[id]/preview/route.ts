import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { guestProjection,readOffer,revalidateOffer } from '@/modules/sales-offers/offer.service';
import { OfferError } from '@/modules/sales-offers/contracts';
import { offerResponse,offerFailure } from '@/modules/sales-offers/http';
import { getLabels } from '@/lib/i18n';
import { SALES_LABELS,SALES_DRAFTS } from '@/modules/content/sales-offer.seed';
import { offerText } from '@/modules/sales-offers/presentation';
export async function POST(_req:Request,props:{params:Promise<{id:string}>}) {
  const user=await getCurrentUser();if(!user)return offerResponse({code:'UNAUTHORIZED'},401);
  try{
    const {id}=await props.params;const stored=await readOffer(prisma,user.identityId,id);const offer=guestProjection(stored);
    let current=true;try{await revalidateOffer(prisma,user.identityId,id);}catch(error){if(error instanceof OfferError)current=false;else throw error;}
    const labels=await getLabels(SALES_LABELS,offer.locale,SALES_DRAFTS);
    return offerResponse({offer,current,labels,text:offerText(offer,labels),links:[]});
  }catch(error){return offerFailure(error);}
}
