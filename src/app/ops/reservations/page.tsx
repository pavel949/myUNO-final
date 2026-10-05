import { UI_LOCALE } from '@/lib/format';
import Link from 'next/link';
import type { BookingStatus } from '@prisma/client';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { getDepartmentProjectIds, getMCProjectScopes } from '@/app/libs/projectScope';
import { prisma } from '@/lib/prisma';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { enumLabel, enumLabelDefaults } from '@/lib/enum-labels';
import { formatDate } from '@/lib/date';
import {
  getOperatingSpaceMembership,
  getOperatingSpaceUnitIds,
  hasOperatingSpaceCapability,
} from '@/modules/ops';
import { getMCManagedUnits } from '@/modules/projects';
import ManualReservationForm from '@/components/ops/ManualReservationForm';
import ReservationGroupForm from '@/components/ops/ReservationGroupForm';

export const dynamic='force-dynamic';

export default async function ReservationDesk({
  searchParams,
}:{searchParams?:{spaceId?:string;status?:string}}){
  const user=await getCurrentUser();
  if(!user)redirect('/login?next=/ops/reservations');

  const spaceId=typeof searchParams?.spaceId==='string'?searchParams.spaceId:'';
  if(!spaceId)redirect('/ops/spaces');

  const space=await prisma.operatingSpace.findUnique({
    where:{id:spaceId},select:{id:true,name:true,status:true},
  });
  if(!space||space.status!=='active')redirect('/ops/spaces');

  if(!user.isAdmin){
    const membership=await getOperatingSpaceMembership(prisma,spaceId,user.identityId);
    if(!membership?.active)redirect('/ops/spaces');
  }

  const spaceUnitIds=await getOperatingSpaceUnitIds(prisma,spaceId);
  let authorizedUnitIds=spaceUnitIds;
  if(!user.isAdmin){
    const staffProjectIds=await getDepartmentProjectIds(user,[
      'reservations','front_desk','guest_care','finance',
    ]);
    const mcIds=new Set<string>();
    for(const scope of getMCProjectScopes(user)){
      const managed=await getMCManagedUnits(
        prisma,user.identityId,scope.projectId,scope.organizationId,
      );
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

  const canManage=user.isAdmin||await hasOperatingSpaceCapability(
    prisma,spaceId,user.identityId,'manage_reservations',
  );

  const allowedStatuses: BookingStatus[]=[
    'requested','pending_payment','confirmed','checked_in','checked_out','completed','cancelled',
  ];
  const requestedStatus=searchParams?.status as BookingStatus | undefined;
  const status=requestedStatus&&allowedStatuses.includes(requestedStatus)?requestedStatus:undefined;
  const now=new Date();

  const [units,guests,groups,bookings]=await Promise.all([
    prisma.unit.findMany({
      where:{id:{in:authorizedUnitIds},status:{not:'offboarded'}},
      select:{id:true,name:true,instantBook:true,project:{select:{name:true}}},
      orderBy:[{project:{name:'asc'}},{name:'asc'}],
    }),
    prisma.identity.findMany({
      where:{
        status:'active',
        OR:[
          {roleAssignments:{some:{role:{in:['guest','resident','buyer']},status:'active'}}},
          {bookingsAsGuest:{some:{}}},
        ],
      },
      select:{id:true,firstName:true,lastName:true,email:true,phone:true},
      orderBy:[{firstName:'asc'},{lastName:'asc'}],
      take:200,
    }),
    prisma.reservationGroup.findMany({
      where:{operatingSpaceId:spaceId,status:'active'},
      select:{
        id:true,title:true,guestIdentityId:true,notes:true,
        guest:{select:{firstName:true,lastName:true}},
        bookings:{
          select:{id:true,status:true,totalThb:true,unit:{select:{name:true,project:{select:{name:true}}}}},
          orderBy:{createdAt:'asc'},
        },
      },
      orderBy:{createdAt:'desc'},
      take:50,
    }),
    prisma.booking.findMany({
      where:{
        unitId:{in:authorizedUnitIds},
        ...(status?{status}:{}),
      },
      select:{
        id:true,status:true,channel:true,startDate:true,endDate:true,totalThb:true,
        balanceDueThb:true,reservationGroupId:true,
        guestIdentity:{select:{id:true,firstName:true,lastName:true}},
        unit:{select:{id:true,name:true,project:{select:{name:true}}}},
        payments:{where:{status:'succeeded',purpose:{in:['stay','stay_balance']}},select:{amountThb:true}},
      },
      orderBy:[{startDate:'asc'},{createdAt:'desc'}],
      take:300,
    }),
  ]);

  const locale=getRequestLocale();
  const labels=await getLabels({
    ...enumLabelDefaults('bookingStatus','bookingChannel'),
    'reservations.back':'← Operating space',
    'reservations.kicker':'RESERVATION DESK',
    'reservations.title':'Reservations',
    'reservations.subtitle':'One desk for requests, manual reservations, groups, payments and stay actions.',
    'reservations.total':'Reservations',
    'reservations.arrivals':'Arrivals today',
    'reservations.requests':'Requests',
    'reservations.balance':'Balance due',
    'reservations.groups':'Reservation groups',
    'reservations.open':'Open stay →',
    'reservations.create':'Create reservation',
    'reservations.create_action':'Create reservation',
    'reservations.creating':'Creating…',
    'reservations.create_failed':'Reservation creation failed',
    'reservations.unit':'Property',
    'reservations.guest':'Guest',
    'reservations.group':'Group',
    'reservations.no_group':'No group',
    'reservations.select':'Select',
    'reservations.start':'Check-in',
    'reservations.end':'Check-out',
    'reservations.adults':'Adults',
    'reservations.children':'Children',
    'reservations.pets':'Pets',
    'reservations.note':'Notes',
    'reservations.create_group':'Create group',
    'reservations.group_title':'Group title',
    'reservations.group_failed':'Group creation failed',
    'reservations.all':'All',
    'reservations.paid':'Paid',
    'reservations.group_summary':'{count} reservations · ฿{amount}',
  });

  const bangkokDay=new Intl.DateTimeFormat('en-CA',{
    timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit',
  }).format(now);
  const arrivals=bookings.filter(b=>b.startDate.toISOString().slice(0,10)===bangkokDay).length;
  const requests=bookings.filter(b=>b.status==='requested').length;
  const balance=bookings.reduce((sum,b)=>sum+Math.max(0,b.balanceDueThb),0);

  const statusHref=(value:BookingStatus|'' )=>'/ops/reservations?'+new URLSearchParams({
    spaceId,...(value?{status:value}:{}),
  }).toString();

  return <main className="stitch-workspace p-16 md:p-32">
    <div className="mx-auto max-w-7xl space-y-20">
      <header>
        <Link href={'/ops/spaces/'+encodeURIComponent(spaceId)}
          className="text-small font-semibold text-brand-andaman">{labels['reservations.back']}</Link>
        <p className="mt-16 stitch-kicker">{labels['reservations.kicker']}</p>
        <h1 className="mt-8 font-display text-display-xl font-semibold text-text-ink">{labels['reservations.title']}</h1>
        <p className="mt-8 text-body text-text-secondary">{labels['reservations.subtitle']}</p>
      </header>

      <section className="grid grid-cols-2 gap-8 md:grid-cols-4">
        {[
          [labels['reservations.total'],bookings.length],
          [labels['reservations.arrivals'],arrivals],
          [labels['reservations.requests'],requests],
          [labels['reservations.balance'],'฿'+Math.round(balance/100).toLocaleString(UI_LOCALE)],
        ].map(([label,value])=><div key={String(label)} className="stitch-panel p-16">
          <p className="text-small text-text-secondary">{label}</p>
          <p className="mt-4 font-display text-heading-2 font-bold font-tabular">{value}</p>
        </div>)}
      </section>

      {canManage?<ReservationGroupForm operatingSpaceId={spaceId} guests={guests} labels={labels}/>:null}
      {canManage?<ManualReservationForm operatingSpaceId={spaceId} units={units} guests={guests} groups={groups.map(g=>({id:g.id,title:g.title,guestIdentityId:g.guestIdentityId}))} labels={labels}/>:null}

      <nav className="flex flex-wrap gap-8">
        <Link href={statusHref('')} className="rounded-full border border-border-line bg-surface-paper px-12 py-8 text-small">{labels['reservations.all']}</Link>
        {allowedStatuses.map(value=><Link key={value} href={statusHref(value)}
          className={'rounded-full border px-12 py-8 text-small '+(status===value?'border-brand-andaman text-brand-andaman':'border-border-line bg-surface-paper')}>
          {enumLabel(labels,'bookingStatus',value)}
        </Link>)}
      </nav>

      <section className="overflow-hidden stitch-panel">
        {bookings.map(booking=>{
          const paid=booking.payments.reduce((sum,p)=>sum+p.amountThb,0);
          return <article key={booking.id} className="grid gap-12 border-b border-border-line p-16 last:border-0 md:grid-cols-6">
            <div className="md:col-span-2">
              <p className="font-semibold text-text-ink">{booking.unit.project.name} · {booking.unit.name}</p>
              <p className="text-small text-text-secondary">{booking.guestIdentity.firstName} {booking.guestIdentity.lastName}</p>
            </div>
            <div><p className="text-small text-text-secondary">{enumLabel(labels,'bookingStatus',booking.status)}</p><p>{enumLabel(labels,'bookingChannel',booking.channel)}</p></div>
            <div><p>{formatDate(booking.startDate,locale)}</p><p className="text-small text-text-secondary">→ {formatDate(booking.endDate,locale)}</p></div>
            <div><p className="font-semibold">฿{Math.round(booking.totalThb/100).toLocaleString()}</p><p className="text-small text-text-secondary">{labels['reservations.paid']} ฿{Math.round(paid/100).toLocaleString()}</p></div>
            <div><Link href={'/ops/stays/'+encodeURIComponent(booking.id)} className="text-small font-semibold text-brand-andaman">{labels['reservations.open']}</Link></div>
          </article>;
        })}
      </section>

      <section>
        <h2 className="font-display text-heading-2 font-semibold text-text-ink">{labels['reservations.groups']}</h2>
        <div className="mt-12 grid gap-12 md:grid-cols-2 xl:grid-cols-3">
          {groups.map(group=><article key={group.id} className="stitch-panel p-16">
            <p className="font-display text-heading-3 font-semibold">{group.title||group.id.slice(0,8)}</p>
            <p className="mt-4 text-small text-text-secondary">{group.guest.firstName} {group.guest.lastName}</p>
            <p className="mt-12 text-small text-text-secondary">{labels['reservations.group_summary'].replace('{count}',String(group.bookings.length)).replace('{amount}',Math.round(group.bookings.reduce((sum,b)=>sum+b.totalThb,0)/100).toLocaleString(UI_LOCALE))}</p>
            <div className="mt-8 flex flex-wrap gap-4">{group.bookings.map(b=><span key={b.id} className="rounded-full bg-surface-ivory px-8 py-4 text-small">{b.unit.project.name} · {b.unit.name}</span>)}</div>
          </article>)}
        </div>
      </section>
    </div>
  </main>;
}
