import { redirect, notFound } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { resolveBookingAccess, canOperateBookingAsStaff } from '@/app/libs/bookingAccess';
import { findOrCreateThread, getBookingThreadParticipants } from '@/modules/comms';

export const dynamic='force-dynamic';

export default async function BookingConversationRedirect({
  params,
}:{params:{bookingId:string}}){
  const user=await getCurrentUser();
  if(!user)redirect('/login?next=/ops/stays/'+encodeURIComponent(params.bookingId)+'/conversation');
  const booking=await prisma.booking.findUnique({
    where:{id:params.bookingId},
    select:{id:true,projectId:true,unitId:true,guestIdentityId:true,unit:{select:{ownerIdentityId:true}}},
  });
  if(!booking)notFound();
  const access=await resolveBookingAccess(user,{
    guestIdentityId:booking.guestIdentityId,
    projectId:booking.projectId,
    unitId:booking.unitId,
    ownerIdentityId:booking.unit.ownerIdentityId,
  });
  if(!canOperateBookingAsStaff(access))notFound();

  const scoped=await getBookingThreadParticipants(prisma,booking.id);
  const thread=await findOrCreateThread(prisma,{
    contextType:'booking',
    contextId:booking.id,
    projectId:booking.projectId,
    participantIdentityIds:scoped.participantIdentityIds,
    participantRoles:scoped.participantRoles,
  });
  redirect('/messages/'+encodeURIComponent(thread.id));
}
