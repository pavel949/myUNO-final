import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { getScopedOperationalAccess, OperatingAccessError } from '@/modules/ops/operating-space-access.service';
import OpsStatusPill, { opsStateTone } from '@/components/ops/OpsStatusPill';

export const dynamic='force-dynamic';

export default async function MaintenanceWorkspace({searchParams}:{searchParams?:{spaceId?:string}}){
  const user=await getCurrentUser();
  if(!user)redirect('/login?next=/ops/maintenance');
  const spaceId=typeof searchParams?.spaceId==='string'?searchParams.spaceId:'';
  if(!spaceId)redirect('/ops/spaces');

  const access=await getScopedOperationalAccess(prisma,user.identityId,spaceId,'manage_maintenance',['maintenance']).catch(error=>{
    if(error instanceof OperatingAccessError)notFound();
    throw error;
  });
  const space=access.space;
  const authorizedUnitIds=access.unitIds;


  const labels=await getLabels({
    'staff.maintenance.title':'Maintenance',
    'staff.maintenance.recurring_unavailable':'New recurring plans are unavailable while scheduled scope and assignment checks are being completed. Use manual tasks for daily work.',
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
  const [plans,tasks]=await Promise.all([
    prisma.preventiveMaintenancePlan.findMany({
      where:{operatingSpaceId:spaceId,OR:[{unitId:{in:authorizedUnitIds}},...(access.isAdmin?[{unitId:null}]:[])]},
      include:{unit:{select:{id:true,name:true,project:{select:{name:true}}}},assignedTeam:{select:{name:true}},assignee:{select:{firstName:true,lastName:true}}},
      orderBy:[{active:'desc'},{nextDueAt:'asc'}],
    }),
    prisma.operationalTask.findMany({
      where:{
        operatingSpaceId:spaceId,
        unitId:{in:authorizedUnitIds},
        taskType:{in:['maintenance_followup','preventive_maintenance','utilities','pool','garden','pest_control']},
        status:{in:['planned','assigned','in_progress','inspected','blocked']},
      },
      include:{unit:{select:{id:true,name:true,project:{select:{name:true}}}},assignedTeam:{select:{name:true}},assignee:{select:{firstName:true,lastName:true}}},
      orderBy:{dueAt:'asc'},
    }),
  ]);

  // Scheduling health measures timeliness only; it is not a safety or inspection certificate.
  const activePlans=plans.filter(plan=>plan.active);
  const overduePlans=activePlans.filter(plan=>plan.nextDueAt.getTime()<Date.now());
  const dueSoonPlans=activePlans.filter(plan=>plan.nextDueAt.getTime()>=Date.now()&&plan.nextDueAt.getTime()<=Date.now()+30*86400000);
  const scheduleHealth=activePlans.length>0
    ? Math.round(100*(activePlans.length-overduePlans.length)/activePlans.length)
    : null;
  const blockedTasks=tasks.filter(task=>task.status==='blocked');

  return <main className="stitch-workspace p-16 md:p-32"><div className="mx-auto max-w-7xl space-y-20">
    <header className="stitch-hero-dark"><Link href={'/ops/spaces/'+encodeURIComponent(spaceId)} className="text-small font-semibold text-brand-sun-soft hover:underline">← {space.name}</Link><h1 className="mt-12 font-display text-display-xl font-semibold tracking-[-0.025em] text-white">{labels['staff.maintenance.title']}</h1><p className="mt-8 text-body text-white/70">{labels['staff.maintenance.subtitle']}</p></header>
    <section aria-label="Maintenance schedule overview" className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
      {[
        {label:'Schedule on time',value:scheduleHealth===null?'—':scheduleHealth+'%',detail:activePlans.length===0?'No active plans':'Active plans only'},
        {label:'Overdue plans',value:String(overduePlans.length),detail:'Past next due date'},
        {label:'Due in 30 days',value:String(dueSoonPlans.length),detail:'Upcoming active plans'},
        {label:'Blocked work',value:String(blockedTasks.length),detail:'Open tasks requiring attention'},
      ].map(metric=><article key={metric.label} className="stitch-panel p-16">
        <p className="text-small text-text-secondary">{metric.label}</p>
        <p className="mt-8 font-display text-heading-2 font-semibold tabular-nums">{metric.value}</p>
        <p className="mt-4 text-small text-text-secondary">{metric.detail}</p>
      </article>)}
    </section>
    <p className="text-small text-text-secondary">Schedule on time is the share of active preventive plans not overdue. It does not certify that a unit is ready for guests.</p>
    <p className="stitch-panel p-16 text-small text-text-secondary">{labels['staff.maintenance.recurring_unavailable']}</p>
    <section><h2 className="font-display text-heading-2 font-semibold">{labels['staff.maintenance.open']}</h2><div className="mt-12 grid gap-12 md:grid-cols-2 xl:grid-cols-3">{tasks.map(task=><article key={task.id} className="stitch-panel p-16"><div className="flex items-start justify-between gap-8"><p className="text-small font-semibold text-brand-andaman">{task.unit.project.name}</p><OpsStatusPill tone={opsStateTone(task.status)}>{task.status.replace(/_/g,' ')}</OpsStatusPill></div><h3 className="mt-4 font-display text-heading-3 font-semibold"><Link href={'/ops/tasks?' + new URLSearchParams({ spaceId, unitId: task.unit.id }) + '#task-' + encodeURIComponent(task.id)} className="text-brand-andaman hover:underline">{task.title||task.taskType.replace(/_/g,' ')}</Link></h3><p className="mt-8 text-small text-text-secondary font-tabular">{task.unit.name} · {task.dueAt.toISOString().slice(0,16).replace('T',' ')}</p></article>)}</div></section>
    <section><h2 className="font-display text-heading-2 font-semibold">{labels['staff.maintenance.preventive']}</h2><div className="stitch-panel mt-12 overflow-hidden">{plans.map(plan=><article key={plan.id} className="grid gap-8 border-b border-border-line p-16 transition last:border-0 hover:bg-surface-ivory md:grid-cols-4"><div><p className="font-semibold">{plan.title}</p><p className="text-small text-text-secondary">{plan.unit?plan.unit.project.name+' · '+plan.unit.name:'All scoped homes'}</p></div><div><p className="text-small text-text-secondary">{labels['staff.maintenance.frequency']}</p><p className="font-tabular">{plan.frequencyDays} {labels['staff.maintenance.days']}</p></div><div><p className="text-small text-text-secondary">{labels['staff.maintenance.next_due']}</p><p className="font-tabular">{plan.nextDueAt.toISOString().slice(0,10)}</p></div><div><p className="text-small text-text-secondary">{labels['staff.maintenance.assigned']}</p><p>{plan.assignedTeam?.name||[plan.assignee?.firstName,plan.assignee?.lastName].filter(Boolean).join(' ')||'—'}</p></div></article>)}</div></section>
  </div></main>;
}

