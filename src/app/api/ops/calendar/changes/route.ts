import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getStaffProjectIds } from '@/app/libs/projectScope';
import { prisma } from '@/lib/prisma';

export const dynamic='force-dynamic';
export const runtime='nodejs';

/**
 * Small scoped cursor, no guest identity or financial amount. The browser
 * refreshes its existing canonical read when it changes; it never receives
 * outbox rows or maintains its own occupancy state.
 */
export async function GET(_request:NextRequest){
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({error:'unauthorized'},{status:401});
  const projectIds=getStaffProjectIds(user);
  if(!user.isAdmin&&!projectIds.length)return NextResponse.json({error:'forbidden'},{status:403});
  try{
    const latest=await prisma.unifiedDomainEvent.findFirst({
      where:user.isAdmin?{}:{project_id:{in:projectIds}},
      orderBy:[{created_at:'desc'},{id:'desc'}],
      select:{id:true,created_at:true},
    });
    return NextResponse.json({
      cursor:latest?latest.created_at.toISOString()+':'+latest.id:null,
    },{headers:{'Cache-Control':'private, no-store'}});
  }catch{
    return NextResponse.json({error:'event_stream_unavailable'},{status:503});
  }
}
