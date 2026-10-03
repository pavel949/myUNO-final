import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getDepartmentProjectIds, getMCProjectScopes } from '@/app/libs/projectScope';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { getOperatingSpaceMembership, getOperatingSpaceUnitIds } from '@/modules/ops';
import { getMCManagedUnits } from '@/modules/projects';

export const dynamic='force-dynamic';

export default async function HousekeepingBoard({searchParams}:{searchParams?:{spaceId?:string}}){
  const user=await getCurrentUser();
  if(!user)redirect('/login?next=/ops/housekeeping');
  const spaceId=typeof searchParams?.spaceId==='string'?searchParams.spaceId:'';
  if(!spaceId)redirect('/ops/spaces');
  const membership=user.isAdmin?null:await getOperatingSpaceMembership(prisma,spaceId,user.identityId);
  if(!user.isAdmin&&!membership?.active)redirect('/ops/spaces');

  const [space,spaceUnitIds,staffProjectIds]=await Promise.all([
    prisma.operatingSpace.findUnique({where:{id:spaceId},select:{id:true,name:true,status:true}}),
    getOperatingSpaceUnitIds(prisma,spaceId),
    getDepartmentProjectIds(user,['housekeeping','front_desk','maintenance','guest_care','reservations']),
  ]);
  if(!space||space.status!=='active')redirect('/ops/spaces');

  let authorizedUnitIds=spaceUnitIds;
  if(!user.isAdmin){
    const mcScopes=getMCProjectScopes(user);
    const mcIds=new Set<string>();
    for(const scope of mcScopes){
      const units=await getMCManagedUnits(prisma,user.identityId,scope.projectId,scope.organizationId);
      for(const unit of units)mcIds.add(unit.id);
    }
    authorizedUnitIds=(await prisma.unit.findMany({
      where:{
        id:{in:spaceUnitIds},
        OR:[
          ...(staffProjectIds.length?[{projectId:{in:staffProjectIds}}]:[]),
          ...(mcIds.size?[{id:{in:Array.from(mcIds)}}]:[]),
        ],
      },
      select:{id:true},
    })).map(u=>u.id);
  }
  if(!authorizedUnitIds.length)redirect('/ops/spaces');

  const now=new Date();
  const units=await prisma.unit.findMany({
    where:{id:{in:authorizedUnitIds},status:{not:'offboarded'}},
    select:{
      id:true,name:true,project:{select:{name:true}},
      bookings:{
        where:{startDate:{lte:now},endDate:{gt:now},status:{in:['confirmed','checked_in']}},
        select:{id:true,status:true},
        take:1,
      },
      operationalTasks:{
        where:{status:{in:['planned','assigned','in_progress','inspected','blocked']}},
        select:{id:true,taskType:true,status:true,blocksInventory:true,dueAt:true},
        orderBy:{dueAt:'asc'},
      },
    },
    orderBy:[{project:{name:'asc'}},{name:'asc'}],
  });

  const rows=units.map(unit=>{
    const cleaning=unit.operationalTasks.find(t=>t.taskType==='turnover_cleaning');
    const inspection=unit.operationalTasks.find(t=>t.taskType==='turnover_inspection');
    const blockingMaintenance=unit.operationalTasks.find(t=>
      t.blocksInventory && !['turnover_cleaning','turnover_inspection'].includes(t.taskType)
    );
    let state='ready';
    if(blockingMaintenance)state='maintenance';
    else if(cleaning?.status==='in_progress')state='cleaning';
    else if(cleaning&&cleaning.status!=='ready')state='dirty';
    else if(inspection&&inspection.status!=='ready')state='awaiting_inspection';
    else if(unit.bookings.length)state='occupied';
    return {...unit,state};
  });

  const counts=rows.reduce<Record<string,number>>((acc,row)=>{acc[row.state]=(acc[row.state]||0)+1;return acc;},{});
  const labels=await getLabels({
    'staff.housekeeping.title':'Housekeeping board',
    'staff.housekeeping.open_tasks':'open tasks',
    'staff.housekeeping.open_tasks_action':'Open tasks →',
  });
  return <main className="min-h-screen bg-surface-ivory p-16 md:p-32"><div className="mx-auto max-w-7xl space-y-20">
    <header><Link href={'/ops/spaces/'+encodeURIComponent(spaceId)} className="text-small font-semibold text-brand-andaman">← {space.name}</Link><h1 className="mt-12 font-display text-display-xl font-semibold">{labels['staff.housekeeping.title']}</h1></header>
    <section className="grid grid-cols-2 gap-8 md:grid-cols-5">
      {['dirty','cleaning','awaiting_inspection','ready','occupied','maintenance'].map(state=><div key={state} className="rounded-lg border border-border-line bg-surface-paper p-16"><p className="text-small text-text-secondary">{state.replace(/_/g,' ')}</p><p className="mt-4 font-display text-heading-2 font-bold">{counts[state]||0}</p></div>)}
    </section>
    <section className="grid gap-12 md:grid-cols-2 xl:grid-cols-3">{rows.map(row=><article key={row.id} className="rounded-xl border border-border-line bg-surface-paper p-16"><p className="text-small font-semibold text-brand-andaman">{row.project.name}</p><div className="mt-4 flex items-center justify-between gap-8"><h2 className="font-display text-heading-3 font-semibold">{row.name}</h2><span className="rounded-full bg-surface-ivory px-12 py-4 text-small font-semibold">{row.state.replace(/_/g,' ')}</span></div><p className="mt-12 text-small text-text-secondary">{row.operationalTasks.length} {labels['staff.housekeeping.open_tasks']}</p><Link href={'/ops/tasks?spaceId='+encodeURIComponent(spaceId)+'&unitId='+encodeURIComponent(row.id)} className="mt-12 inline-flex rounded-md border border-border-line px-12 py-8 text-small font-semibold">{labels['staff.housekeeping.open_tasks_action']}</Link></article>)}</section>
  </div></main>;
}
