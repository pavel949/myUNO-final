import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { readOffer, guestProjection, revalidateOffer } from '@/modules/sales-offers/offer.service';
import { OfferError, type GuestOption } from '@/modules/sales-offers/contracts';
import { OperatingAccessError } from '@/modules/ops/operating-space-access.service';
import { registeredReservationGuestIds } from '@/modules/ops/reservation-guests.service';
import { SALES_LABELS, SALES_DRAFTS } from '@/modules/content/sales-offer.seed';
import { getScopedOperationalAccess } from '@/modules/ops/operating-space-access.service';
import { RESERVATION_DEPARTMENTS } from '@/modules/ops/reservation-guests.service';
import OfferActions from './offer-actions';
export const dynamic='force-dynamic';
export default async function OfferPage(props:{params:Promise<{id:string}>}) {
  const {id}=await props.params;const user=await getCurrentUser();if(!user)redirect('/login');
  const offer=await readOffer(prisma,user.identityId,id).catch(error=>{if(error instanceof OfferError||error instanceof OperatingAccessError)notFound();throw error;});
  const access=await getScopedOperationalAccess(prisma,user.identityId,offer.operatingSpaceId,'manage_reservations',RESERVATION_DEPARTMENTS);
  const registered=await registeredReservationGuestIds(prisma,offer.operatingSpaceId,access.unitIds);
  const [labels,guests,valid,shares]=await Promise.all([
    getLabels(SALES_LABELS,undefined,SALES_DRAFTS),
    prisma.identity.findMany({where:{status:'active',OR:[{id:{in:registered}},{bookingsAsGuest:{some:{unitId:{in:access.unitIds}}}}]},select:{id:true,firstName:true,lastName:true},take:200,orderBy:{firstName:'asc'}}),
    revalidateOffer(prisma,user.identityId,id).then(()=>true).catch(error=>{if(error instanceof OfferError)return false;throw error;}),
    prisma.salesOfferShare.findMany({where:{offerId:id},select:{id:true,expiresAt:true,revokedAt:true},orderBy:{createdAt:'asc'}}),
  ]);
  return <main className="stitch-workspace p-16 md:p-32"><div className="mx-auto max-w-3xl space-y-24"><h1 className="font-display text-display-xl">{labels['sales.title']} · {labels['sales.version']} {offer.version}</h1>
    <OfferActions id={id} spaceId={offer.operatingSpaceId} guestOffer={guestProjection(offer)} options={offer.options.map(o=>({id:o.id,unitId:o.unitId,snapshot:o.snapshot as unknown as GuestOption}))}
      guests={guests.map(g=>({id:g.id,name:g.firstName+' '+g.lastName}))} labels={labels} valid={valid} shares={shares.map(s=>({id:s.id,expiresAt:s.expiresAt.toISOString(),revoked:Boolean(s.revokedAt)}))}/></div></main>;
}
