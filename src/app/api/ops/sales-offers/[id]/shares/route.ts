import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { issueOfferShare,revokeOfferShare } from '@/modules/sales-offers/share.service';
import { offerResponse,offerFailure } from '@/modules/sales-offers/http';
export async function POST(req:Request,props:{params:Promise<{id:string}>}) {
  const user=await getCurrentUser();if(!user)return offerResponse({code:'UNAUTHORIZED'},401);
  try{const body=await req.json();return offerResponse(await issueOfferShare(prisma,user.identityId,(await props.params).id,body.expiresAt),201);}
  catch(error){return offerFailure(error);}
}
export async function DELETE(req:Request,props:{params:Promise<{id:string}>}) {
  const user=await getCurrentUser();if(!user)return offerResponse({code:'UNAUTHORIZED'},401);
  try{const body=await req.json();await revokeOfferShare(prisma,user.identityId,(await props.params).id,body.shareId);return offerResponse({revoked:true});}
  catch(error){return offerFailure(error);}
}
