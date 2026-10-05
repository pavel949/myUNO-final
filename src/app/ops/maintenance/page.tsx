import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getDepartmentProjectIds, getMCProjectScopes } from '@/app/libs/projectScope';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { getOperatingSpaceMembership, getOperatingSpaceUnitIds } from '@/modules/ops';
import { getMCManagedUnits } from '@/modules/projects';
import OpsStatusPill, { opsStateTone } from '@/components/ops/OpsStatusPill';
import PreventiveMaintenanceForm from '@/components/ops/PreventiveMaintenanceForm';

export const dynamic='force-dynamic';

export default async function MaintenanceWorkspace({searchParams}:{searchParams?:{spaceId?:string}}){
  const user=await getCurrentUser();
  if(!user)redirect('/login?next=/ops/maintenance');
  const spaceId=typeof searchParams?.spaceId==='string'?searchParams.spaceId:'';
  if(!spaceId)redirect('/ops/spaces');

  const membership=user.isAdmin?null:await getOperatingSpaceMembership(prisma,spaceId,user.identityId);
  if(!user.isAdmin&&!membership?.active)redirect('/ops/spaces');

  const [space,spaceUnitIds,staffProjectIds]=await Promise.all([
    prisma.operatingSpace.findUnique({where:{id:spaceId},select:{id:true,name:true,status:true}}),
    getOperatingSpaceUnitIds(prisma,spaceId),
    getDepartmentProjectIds(user,['maintenance','housekeeping','front_desk','reservations']),
  ]);
  if(!space||space.status!=='active')redirect('/ops/spaces');

  let authorizedUnitIds=spaceUnitIds;
  if(!user.isAdmin){
    const mcIds=new Set<string>();
    for(const scope of getMCProjectScopes(user)){
      const managed=await getMCManagedUnits(prisma,user.identityId,scope.projectId,scope.organizationId);
      for(const unit of managed)mcIds.add(unit.id);
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
    })).map(unit=>unit.id);
  }
  if(!authorizedUnitIds.length)redirect('/ops/spaces');

  const labels=await getLabels({
    'staff.maintenance.title':'Maintenance',
    'staff.maintenance.subtitle':'Open work and recurring preventive plans in this operating space.',
    'staff.maintenance.open':'Open maintenance',
    'staff.maintenance.preventive':'Preventive plans',
    'staff.maintenance.frequency':'Frequency',
    'staff.maintenance.days':'days',
    'staff.maintenance.next_due':'Next due',
    'staff.maintenance.assigned':'Assigned',
    'staff.maintenance.all_homes':'All authorized homes',
    'staff.maintenance.team':'Team',
    'staff.maintenance.employee':'Employee',
    'staff.maintenance.blocks_inventory':'Blocks inventory',
    'staff.maintenance.plan_title':'Maintenance plan',
    'staff.maintenance.estimated_cost':'Estimated cost THB',
    'staff.maintenance.description':'Description',
    'staff.maintenance.creating':'Creating…',
    'staff.maintenance.create_plan':'Create plan',
  });
  const [units,teams,members,plans,tasks]=await Promise.all([
    prisma.unit.findMany({
      where:{id:{in:authorizedUnitIds}},
      select:{id:true,name:true,project:{select:{name:true}}},
      orderBy:[{project:{name:'asc'}},{name:'asc'}],
    }),
    prisma.operatingTeam.findMany({where:{operatingSpaceId:spaceId,active:true},select:{id:true,name:true},orderBy:{name:'asc'}}),
    prisma.operatingSpaceMember.findMany({where:{operatingSpaceId:spaceId,active:true},select:{identity:{select:{id:true,firstName:true,lastName:true}}},orderBy:{identity:{firstName:'asc'}}}),
    prisma.preventiveMaintenancePlan.findMany({
      where:{operatingSpaceId:spaceId},
      include:{unit:{select:{name:true,project:{select:{name:true}}}},assignedTeam:{select:{name:true}},assignee:{select:{firstName:true,lastName:true}}},
      orderBy:[{active:'desc'},{nextDueAt:'asc'}],
    }),
    prisma.operationalTask.findMany({
      where:{
        operatingSpaceId:spaceId,
        unitId:{in:authorizedUnitIds},
        taskType:{in:['maintenance_followup','preventive_maintenance','utilities','pool','garden','pest_control']},
        status:{in:['planned','assigned','in_progress','inspected','blocked']},
      },
      include:{unit:{select:{name:true,project:{select:{name:true}}}},assignedTeam:{select:{name:true}},assignee:{select:{firstName:true,lastName:true}}},
      orderBy:{dueAt:'asc'},
    }),
  ]);

  return <main className="stitch-workspace p-16 md:p-32"><div className="mx-auto max-w-7xl space-y-20">
    <header className="stitch-hero-dark"><Link href={'/ops/spaces/'+encodeURIComponent(spaceId)} className="text-small font-semibold text-brand-sun-soft hover:underline">← {space.name}</Link><h1 className="mt-12 font-display text-display-xl font-semibold tracking-[-0.025em] text-white">{labels['staff.maintenance.title']}</h1><p className="mt-8 text-body text-white/70">{labels['staff.maintenance.subtitle']}</p></header>
    <PreventiveMaintenanceForm operatingSpaceId={spaceId} units={units} teams={teams} members={members} labels={labels}/>
    <section><h2 className="font-display text-heading-2 font-semibold">{labels['staff.maintenance.open']}</h2><div className="mt-12 grid gap-12 md:grid-cols-2 xl:grid-cols-3">{tasks.map(task=><article key={task.id} className="stitch-panel p-16"><div className="flex items-start justify-between gap-8"><p className="text-small font-semibold text-brand-andaman">{task.unit.project.name}</p><OpsStatusPill tone={opsStateTone(task.status)}>{task.status.replace(/_/g,' ')}</OpsStatusPill></div><h3 className="mt-4 font-display text-heading-3 font-semibold">{task.title||task.taskType.replace(/_/g,' ')}</h3><p className="mt-8 text-small text-text-secondary font-tabular">{task.unit.name} · {task.dueAt.toISOString().slice(0,16).replace('T',' ')}</p></article>)}</div></section>
    <section><h2 className="font-display text-heading-2 font-semibold">{labels['staff.maintenance.preventive']}</h2><div className="stitch-panel mt-12 overflow-hidden">{plans.map(plan=><article key={plan.id} className="grid gap-8 border-b border-border-line p-16 transition last:border-0 hover:bg-surface-ivory md:grid-cols-4"><div><p className="font-semibold">{plan.title}</p><p className="text-small text-text-secondary">{plan.unit?plan.unit.project.name+' · '+plan.unit.name:'All scoped homes'}</p></div><div><p className="text-small text-text-secondary">{labels['staff.maintenance.frequency']}</p><p className="font-tabular">{plan.frequencyDays} {labels['staff.maintenance.days']}</p></div><div><p className="text-small text-text-secondary">{labels['staff.maintenance.next_due']}</p><p className="font-tabular">{plan.nextDueAt.toISOString().slice(0,10)}</p></div><div><p className="text-small text-text-secondary">{labels['staff.maintenance.assigned']}</p><p>{plan.assignedTeam?.name||[plan.assignee?.firstName,plan.assignee?.lastName].filter(Boolean).join(' ')||'—'}</p></div></article>)}</div></section>
  </div></main>;
}
