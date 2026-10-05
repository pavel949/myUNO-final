import Link from 'next/link';
import OpsStatusPill, { opsStateTone } from '@/components/ops/OpsStatusPill';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getDepartmentProjectIds } from '@/app/libs/projectScope';
import { prisma } from '@/lib/prisma';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { formatDate } from '@/lib/date';
import { bangkokCalendarDay } from '@/modules/booking';
import { deriveStayWorkItems, stayWorkDepartments } from '@/modules/booking/work-projection';
import type { StayWorkDepartment } from '@/modules/booking/work-projection';
import { getOperatingSpaceMembership, getOperatingSpaceUnitIds } from '@/modules/ops';

export const dynamic='force-dynamic';
export default async function StayOperationsPage({
  searchParams,
}:{searchParams?:{projectId?:string;department?:string;spaceId?:string}}){
  const user=await getCurrentUser();
  if(!user)redirect('/login?next=/ops/stays');
  const requestedSpaceId=typeof searchParams?.spaceId==='string'?searchParams.spaceId:'';
  const spaceMembership=requestedSpaceId&&!user.isAdmin
    ?await getOperatingSpaceMembership(prisma,requestedSpaceId,user.identityId):null;
  if(requestedSpaceId&&!user.isAdmin&&!spaceMembership?.active)redirect('/ops/spaces');
  const spaceUnitIds=requestedSpaceId?await getOperatingSpaceUnitIds(prisma,requestedSpaceId):[];
  const staffIds=await getDepartmentProjectIds(user,['reservations','front_desk','housekeeping','guest_care','finance']);
  if(!user.isAdmin&&!staffIds.length)redirect('/');
  const projects=await prisma.project.findMany({
    where:user.isAdmin?{}:{id:{in:staffIds}},
    select:{id:true,name:true},orderBy:{name:'asc'},
  });
  const allowed=new Set(projects.map(p=>p.id));
  const projectId=searchParams?.projectId&&allowed.has(searchParams.projectId)?searchParams.projectId:'';
  const departmentGrants=user.isAdmin?[]:await prisma.projectStaffPermission.findMany({
    where:{identityId:user.identityId,projectId:{in:projectId?[projectId]:staffIds}},
    select:{projectId:true,departments:true},
  });
  const projectDepartments=new Map(departmentGrants.map(grant=>[grant.projectId,grant.departments]));
  const allowedDepartments:StayWorkDepartment[]=user.isAdmin?stayWorkDepartments:
    stayWorkDepartments.filter(dept=>staffIds.some(id=>!projectDepartments.has(id)||projectDepartments.get(id)?.includes(dept)));
  const department=allowedDepartments.includes(searchParams?.department as StayWorkDepartment)
    ?searchParams?.department as StayWorkDepartment:null;
  const today=bangkokCalendarDay();
  const bookings=await prisma.booking.findMany({
    where:{
      ...(requestedSpaceId?{unitId:{in:spaceUnitIds}}:{}),
      ...(projectId?{projectId}:user.isAdmin?{}:{projectId:{in:staffIds}}),
      status:{in:['requested','pending_payment','confirmed','checked_in','checked_out','cancelled']},
    },
    select:{
      id:true,projectId:true,unitId:true,status:true,startDate:true,endDate:true,
      totalThb:true,refundAccruedThb:true,
      unit:{select:{name:true}},
      guestIdentity:{select:{firstName:true,lastName:true}},
      payments:{where:{status:'succeeded',purpose:{in:['stay','stay_balance']}},
        select:{amountThb:true}},
    },
    // The work queue must never silently omit pending stays because older
    // cancelled reservations consumed an arbitrary first-page limit.
    orderBy:{startDate:'asc'},
  });
  const bookingProjects=new Map(bookings.map(booking=>[booking.id,booking.projectId]));
  const work=bookings.flatMap(b=>deriveStayWorkItems({
    id:b.id,projectId:b.projectId,unitId:b.unitId,unitName:b.unit.name,
    guestName:[b.guestIdentity.firstName,b.guestIdentity.lastName].filter(Boolean).join(' '),
    status:b.status,startDate:b.startDate.toISOString().slice(0,10),
    endDate:b.endDate.toISOString().slice(0,10),totalSatang:b.totalThb,
    paidSatang:b.payments.reduce((sum,p)=>sum+p.amountThb,0),
    refundAccruedSatang:b.refundAccruedThb,
  },today)).filter(item=>allowedDepartments.includes(item.department) && (user.isAdmin || !projectDepartments.has(bookingProjects.get(item.bookingId)||'') || projectDepartments.get(bookingProjects.get(item.bookingId)||'')?.includes(item.department)));
  const queue=(department?work.filter(item=>item.department===department):work)
    .sort((a,b)=>(a.severity==='attention'?-1:1)-(b.severity==='attention'?-1:1)||
      a.dueDate.localeCompare(b.dueDate));
  const locale = getRequestLocale();
  const labels: Record<string, string> = await getLabels({
    'staff.stay_queue.title':'Stay operations',
    'staff.stay_queue.kicker':'ONE BOOKING · ALL DEPARTMENTS',
    'staff.stay_queue.description':'Actions are derived from the canonical reservation; no duplicate stay record.',
    'staff.stay_queue.all':'All work',
    'staff.stay_queue.reservations':'Reservations',
    'staff.stay_queue.finance':'Finance',
    'staff.stay_queue.front_desk':'Front desk',
    'staff.stay_queue.housekeeping':'Housekeeping',
    'staff.stay_queue.guest_care':'Guest care',
    'staff.stay_queue.property':'Property',
    'staff.stay_queue.all_properties':'All properties',
    'staff.stay_queue.due':'Due',
    'staff.stay_queue.action_key.balance':'Balance',
    'staff.stay_queue.action_key.care':'Care',
    'staff.stay_queue.action_key.check_in':'Check in',
    'staff.stay_queue.action_key.check_out':'Check out',
    'staff.stay_queue.action_key.collect':'Collect',
    'staff.stay_queue.action_key.inspect':'Inspect',
    'staff.stay_queue.action_key.prearrival':'Prearrival',
    'staff.stay_queue.action_key.prepare_home':'Prepare home',
    'staff.stay_queue.action_key.reconcile_cancelled':'Reconcile cancelled',
    'staff.stay_queue.action_key.refund':'Refund',
    'staff.stay_queue.action_key.respond':'Respond',
    'staff.stay_queue.action_key.turnover':'Turnover',
    'staff.stay_queue.action':'Open stay',
    'staff.stay_queue.empty':'No tasks for this filter.',
    'staff.stay_queue.attention':'Needs attention',
    'staff.stay_queue.back':'Back to calendar',
    'staff.stay_queue.total':'Work items',
    'staff.stay_queue.arrival':'Arrival',
  });
  const href=(dept:string|null,p:string)=>'/ops/stays?'+new URLSearchParams({
    ...(dept?{department:dept}:{}),...(p?{projectId:p}:{}),
    ...(requestedSpaceId?{spaceId:requestedSpaceId}:{})
  }).toString();
  return <main className="stitch-workspace p-16 md:p-32">
    <div className="mx-auto max-w-6xl space-y-24">
      <header>
        <Link href="/ops/calendar/board" className="text-small text-brand-andaman font-semibold">
          {labels['staff.stay_queue.back']}
        </Link>
        <p className="mt-16 stitch-kicker">
          {labels['staff.stay_queue.kicker']}
        </p>
        <h1 className="mt-4 font-display text-display-xl font-semibold text-text-ink">
          {labels['staff.stay_queue.title']}
        </h1>
        <p className="mt-8 text-body text-text-secondary">{labels['staff.stay_queue.description']}</p>
      </header>
      <div className="flex flex-wrap gap-8">
        <Link href={href(null,projectId)} className={'rounded-full px-16 py-8 text-small font-semibold '+(!department?'bg-brand-deep text-white':'bg-surface-paper text-text-ink border border-border-line')}>
          {labels['staff.stay_queue.all']}
        </Link>
        {allowedDepartments.map(d=><Link key={d} href={href(d,projectId)}
          className={'rounded-full px-16 py-8 text-small font-semibold '+(department===d?'bg-brand-deep text-white':'bg-surface-paper text-text-ink border border-border-line')}>
          {labels['staff.stay_queue.'+d]}
        </Link>)}
      </div>
      <nav className="flex flex-wrap gap-8" aria-label={labels['staff.stay_queue.property']}>
        <Link href={href(department,'')} className="rounded-md border border-border-line bg-surface-paper px-12 py-8 text-small">
          {labels['staff.stay_queue.all_properties']}
        </Link>
        {projects.map(p=><Link key={p.id} href={href(department,p.id)}
          className={'rounded-md border px-12 py-8 text-small '+(projectId===p.id?'border-brand-andaman text-brand-andaman':'border-border-line text-text-ink')}>
          {p.name}
        </Link>)}
      </nav>
      <div className="grid grid-cols-2 gap-12">
        <div className="stitch-panel p-20">
          <p className="text-small text-text-secondary">{labels['staff.stay_queue.total']}</p>
          <p className="mt-4 font-display text-heading-2 font-tabular text-text-ink">{queue.length}</p>
        </div>
        <div className="stitch-panel p-20">
          <p className="text-small text-text-secondary">{labels['staff.stay_queue.attention']}</p>
          <p className="mt-4 font-display text-heading-2 font-tabular text-text-ink">
            {queue.filter(x=>x.severity==='attention').length}
          </p>
        </div>
      </div>
      <section className="overflow-hidden stitch-panel">
        {queue.length===0?<p className="p-24 text-body text-text-secondary">{labels['staff.stay_queue.empty']}</p>:
        queue.map(item=><article key={item.id} className="flex flex-wrap items-center gap-12 border-b border-border-line p-16 transition last:border-0 hover:bg-surface-mint">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-text-ink">{item.unitName} · {item.guestName}</p>
            <p className="mt-4 text-small text-text-secondary font-tabular">
              {labels['staff.stay_queue.'+item.department]} · {labels['staff.stay_queue.action_key.'+item.actionKey] ?? item.actionKey}
              {' · '}{labels['staff.stay_queue.due']} {formatDate(item.dueDate+'T00:00:00Z', locale)}
            </p>
          </div>
          {item.severity==='attention'&&<OpsStatusPill tone={opsStateTone("dirty")}>
            {labels['staff.stay_queue.attention']}
          </OpsStatusPill>}
          <Link href={'/ops/stays/'+item.bookingId} className="rounded-lg bg-brand-deep px-16 py-8 text-small font-semibold text-white transition hover:bg-brand-andaman">
            {labels['staff.stay_queue.action']} →
          </Link>
        </article>)}
      </section>
    </div>
  </main>;
}
