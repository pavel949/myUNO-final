import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getStaffProjectIds } from '@/app/libs/projectScope';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import { bangkokCalendarDay } from '@/modules/booking/calendar-projection';
import { deriveStayWorkItems, stayWorkDepartments } from '@/modules/booking/work-projection';
import type { StayWorkDepartment } from '@/modules/booking/work-projection';

export const dynamic='force-dynamic';
export default async function StayOperationsPage({
  searchParams,
}:{searchParams?:{projectId?:string;department?:string}}){
  const user=await getCurrentUser();
  if(!user)redirect('/login?next=/ops/stays');
  const staffIds=getStaffProjectIds(user);
  if(!user.isAdmin&&!staffIds.length)redirect('/');
  const projects=await prisma.project.findMany({
    where:user.isAdmin?{}:{id:{in:staffIds}},
    select:{id:true,name:true},orderBy:{name:'asc'},
  });
  const allowed=new Set(projects.map(p=>p.id));
  const projectId=searchParams?.projectId&&allowed.has(searchParams.projectId)?searchParams.projectId:'';
  const allowedDepartments:StayWorkDepartment[]=user.isAdmin||
    user.roles.some(r=>r.role==='staff_ops')
    ?stayWorkDepartments:['front_desk','housekeeping','guest_care'];
  const department=allowedDepartments.includes(searchParams?.department as StayWorkDepartment)
    ?searchParams?.department as StayWorkDepartment:null;
  const today=bangkokCalendarDay();
  const bookings=await prisma.booking.findMany({
    where:{
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
    orderBy:{startDate:'asc'},take:300,
  });
  const work=bookings.flatMap(b=>deriveStayWorkItems({
    id:b.id,projectId:b.projectId,unitId:b.unitId,unitName:b.unit.name,
    guestName:[b.guestIdentity.firstName,b.guestIdentity.lastName].filter(Boolean).join(' '),
    status:b.status,startDate:b.startDate.toISOString().slice(0,10),
    endDate:b.endDate.toISOString().slice(0,10),totalSatang:b.totalThb,
    paidSatang:b.payments.reduce((sum,p)=>sum+p.amountThb,0),
    refundAccruedSatang:b.refundAccruedThb,
  },today)).filter(item=>allowedDepartments.includes(item.department));
  const queue=(department?work.filter(item=>item.department===department):work)
    .sort((a,b)=>(a.severity==='attention'?-1:1)-(b.severity==='attention'?-1:1)||
      a.dueDate.localeCompare(b.dueDate));
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
    'staff.stay_queue.action':'Open stay',
    'staff.stay_queue.empty':'No tasks for this filter.',
    'staff.stay_queue.attention':'Needs attention',
    'staff.stay_queue.back':'Back to calendar',
    'staff.stay_queue.total':'Work items',
    'staff.stay_queue.arrival':'Arrival',
  });
  const href=(dept:string|null,p:string)=>'/ops/stays?'+new URLSearchParams({
    ...(dept?{department:dept}:{}),...(p?{projectId:p}:{})
  }).toString();
  return <main className="min-h-screen bg-surface-ivory p-16 md:p-32">
    <div className="mx-auto max-w-6xl space-y-24">
      <header>
        <Link href="/ops/calendar/board" className="text-small text-brand-andaman font-semibold">
          {labels['staff.stay_queue.back']}
        </Link>
        <p className="mt-16 text-kicker font-semibold tracking-widest text-brand-andaman">
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
        <div className="rounded-lg border border-border-line bg-surface-paper p-20">
          <p className="text-small text-text-secondary">{labels['staff.stay_queue.total']}</p>
          <p className="mt-4 font-display text-heading-2 text-text-ink">{queue.length}</p>
        </div>
        <div className="rounded-lg border border-border-line bg-surface-paper p-20">
          <p className="text-small text-text-secondary">{labels['staff.stay_queue.attention']}</p>
          <p className="mt-4 font-display text-heading-2 text-text-ink">
            {queue.filter(x=>x.severity==='attention').length}
          </p>
        </div>
      </div>
      <section className="overflow-hidden rounded-lg border border-border-line bg-surface-paper">
        {queue.length===0?<p className="p-24 text-body text-text-secondary">{labels['staff.stay_queue.empty']}</p>:
        queue.map(item=><article key={item.id} className="flex flex-wrap items-center gap-12 border-b border-border-line p-16 last:border-0">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-text-ink">{item.unitName} · {item.guestName}</p>
            <p className="mt-4 text-small text-text-secondary">
              {labels['staff.stay_queue.'+item.department]} · {item.actionKey.replace(/_/g,' ')}
              {' · '}{labels['staff.stay_queue.due']} {item.dueDate}
            </p>
          </div>
          {item.severity==='attention'&&<span className="rounded-full bg-amber-100 px-12 py-6 text-small font-semibold text-amber-900">
            {labels['staff.stay_queue.attention']}
          </span>}
          <Link href={'/ops/stays/'+item.bookingId} className="rounded-md bg-brand-deep px-16 py-8 text-small font-semibold text-white">
            {labels['staff.stay_queue.action']} →
          </Link>
        </article>)}
      </section>
    </div>
  </main>;
}
