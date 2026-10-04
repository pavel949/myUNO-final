import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getAuthorizedOperationalUnitIds } from '@/app/libs/projectScope';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { getOperatingSpaceMembership, getOperatingSpaceUnitIds, hasOperatingSpaceCapability } from '@/modules/ops';
import IncidentsClient from './incidents-client';

export const dynamic='force-dynamic';

export default async function IncidentsPage({searchParams}:{searchParams?:{spaceId?:string}}){
 const user=await getCurrentUser(); if(!user)redirect('/login?next=/ops/incidents');
 const spaceId=typeof searchParams?.spaceId==='string'?searchParams.spaceId:'';
 if(!spaceId)redirect('/ops/spaces');
 const space=await prisma.operatingSpace.findUnique({where:{id:spaceId},select:{id:true,name:true,status:true}});
 if(!space||space.status!=='active')redirect('/ops/spaces');
 if(!user.isAdmin){
  const membership=await getOperatingSpaceMembership(prisma,spaceId,user.identityId);
  const allowed=membership?.active&&(
    await hasOperatingSpaceCapability(prisma,spaceId,user.identityId,'manage_tasks')||
    await hasOperatingSpaceCapability(prisma,spaceId,user.identityId,'manage_maintenance')
  );
  if(!allowed)redirect('/ops/spaces/'+encodeURIComponent(spaceId));
 }
 const spaceUnitIds=await getOperatingSpaceUnitIds(prisma,spaceId);
 const unitIds=user.isAdmin?spaceUnitIds:await getAuthorizedOperationalUnitIds(user,spaceUnitIds,['maintenance','guest_care','front_desk','housekeeping']);
 if(!unitIds.length)redirect('/ops/spaces/'+encodeURIComponent(spaceId));
 const [units,members,incidents]=await Promise.all([
  prisma.unit.findMany({where:{id:{in:unitIds}},select:{id:true,name:true,project:{select:{name:true}}},orderBy:[{project:{name:'asc'}},{name:'asc'}]}),
  prisma.operatingSpaceMember.findMany({where:{operatingSpaceId:spaceId,active:true},select:{identityId:true,identity:{select:{firstName:true,lastName:true}}},orderBy:{identity:{firstName:'asc'}}}),
  prisma.incidentLog.findMany({where:{unitId:{in:unitIds},status:{in:['open','acknowledged','in_progress']}},include:{unit:{select:{name:true,project:{select:{name:true}}}},assignedTo:{select:{firstName:true,lastName:true}}},orderBy:[{severity:'desc'},{createdAt:'desc'}],take:100}),
 ]);
 const labels=await getLabels({
  'staff.incidents.back':'← Workspace','staff.incidents.title':'Incidents & accidents',
  'staff.incidents.subtitle':'Report, assign and resolve operational incidents only within this management scope.',
  'staff.incidents.report':'Report incident','staff.incidents.property':'Select property',
  'staff.incidents.unassigned':'Unassigned','staff.incidents.description':'What happened, impact, and immediate action taken',
  'staff.incidents.create':'Create incident','staff.incidents.saving':'Saving…',
  'staff.incidents.open':'Open incidents','staff.incidents.empty':'No open incidents in this operating space.',
  'staff.incidents.assigned':'Assigned to','staff.incidents.ack':'Acknowledge','staff.incidents.start':'Start work',
  'staff.incidents.resolve':'Resolve','staff.incidents.resolve_prompt':'Resolution / corrective action',
  'staff.incidents.created':'Incident created.','staff.incidents.updated':'Incident updated.',
  'staff.incidents.error':'Incident action failed.',
 });
 return <main className="min-h-screen bg-surface-ivory p-16 md:p-32"><div className="mx-auto max-w-7xl space-y-20">
  <header><Link href={'/ops/spaces/'+encodeURIComponent(spaceId)} className="text-small font-semibold text-brand-andaman">{labels['staff.incidents.back']}</Link>
   <h1 className="mt-12 font-display text-display-xl font-semibold">{labels['staff.incidents.title']}</h1>
   <p className="mt-8 text-body text-text-secondary">{space.name} · {labels['staff.incidents.subtitle']}</p>
  </header>
  <IncidentsClient spaceId={spaceId}
   units={units.map(u=>({id:u.id,name:u.name,projectName:u.project.name}))}
   members={members.map(m=>({identityId:m.identityId,name:[m.identity.firstName,m.identity.lastName].filter(Boolean).join(' ')}))}
   incidents={incidents.map(i=>({...i,createdAt:i.createdAt.toISOString()}))}
   labels={labels}/>
 </div></main>;
}
