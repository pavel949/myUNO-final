import { createHash, randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { OfferError } from './contracts';
import { guestProjection, readOffer, revalidateOffer } from './offer.service';
import { OperatingAccessError } from '@/modules/ops/operating-space-access.service';
const hash = (token:string) => createHash('sha256').update(token).digest('hex');

export async function issueOfferShare(db:PrismaClient,actor:string,offerId:string,expiresAt:string) {
  const expires=new Date(expiresAt);
  if(!Number.isFinite(expires.getTime())||expires<=new Date())throw new OfferError('INVALID_EXPIRY',400);
  const offer=await revalidateOffer(db,actor,offerId);
  if(expires<=new Date())throw new OfferError('INVALID_EXPIRY',400);
  if(expires>offer.expiresAt)throw new OfferError('INVALID_EXPIRY',400);
  const token=randomBytes(32).toString('base64url');
  const share=await db.salesOfferShare.create({data:{offerId,createdByIdentityId:actor,tokenHash:hash(token),expiresAt:expires}});
  await db.auditLog.create({data:{actorIdentityId:actor,action:'sales_offer:shared',entityType:'SalesOffer',entityId:offerId,data:{shareId:share.id}}});
  return {id:share.id,token,expiresAt:expires.toISOString()};
}
export async function revokeOfferShare(db:PrismaClient,actor:string,offerId:string,shareId:string) {
  await readOffer(db,actor,offerId);
  const result=await db.salesOfferShare.updateMany({where:{id:shareId,offerId,revokedAt:null},data:{revokedAt:new Date()}});
  if(!result.count)throw new OfferError('NOT_FOUND',404);
  await db.auditLog.create({data:{actorIdentityId:actor,action:'sales_offer:share_revoked',entityType:'SalesOffer',entityId:offerId,data:{shareId}}});
}
/** No staff session is involved. The capability grants this sanitized snapshot only. */
export async function viewOfferShare(db:PrismaClient,token:unknown) {
  if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))throw new OfferError('NOT_FOUND',404);
  const share=await db.salesOfferShare.findUnique({where:{tokenHash:hash(token)}});
  if(!share||share.revokedAt||share.expiresAt<=new Date())throw new OfferError('NOT_FOUND',404);
  // Withdrawal of the issuing staff member's authority also withdraws the capability.
  let stored;
  try{stored=await readOffer(db,share.createdByIdentityId,share.offerId);}
  catch(error){if(error instanceof OfferError||error instanceof OperatingAccessError)throw new OfferError('NOT_FOUND',404);throw error;}
  let current=true;
  try{await revalidateOffer(db,share.createdByIdentityId,share.offerId);}
  catch(error){if(error instanceof OfferError)current=false;else throw error;}
  // Even a superseded snapshot remains identifiable, but its CTA/export is disabled.
  const offer=guestProjection(stored);
  const links=current ? stored.options.map(o=>{
    const snapshot=offer.options[o.position];
    const query=new URLSearchParams({startDate:snapshot.stay.startDate,endDate:snapshot.stay.endDate,
      adults:String(snapshot.stay.adults),children:String(snapshot.stay.children),pets:String(snapshot.stay.pets)});
    return '/units/'+encodeURIComponent(o.unitId)+'?'+query.toString();
  }) : [];
  return {offer,current,links};
}
