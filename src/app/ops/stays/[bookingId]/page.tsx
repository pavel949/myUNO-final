import Link from 'next/link';
import { pmsNavigationHref } from '@/lib/pms-navigation';
import { notFound,redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { hasProjectDepartmentAccess } from '@/app/libs/projectScope';
import { prisma } from '@/lib/prisma';
import { getLabels, getRequestLocale } from '@/lib/i18n';
import { enumLabel, enumLabelDefaults } from '@/lib/enum-labels';
import { formatDate } from '@/lib/date';
import StayActions from '@/components/ops/StayActions';

export const dynamic='force-dynamic';
export default async function CanonicalStayPage({params,searchParams}:{params:{bookingId:string};searchParams?:{spaceId?:string}}){
  const user=await getCurrentUser();
  if(!user)redirect('/login?next=/ops/stays/'+params.bookingId);
  const booking=await prisma.booking.findUnique({where:{id:params.bookingId},
    select:{
      id:true,status:true,startDate:true,endDate:true,totalThb:true,balanceDueThb:true,
      refundAccruedThb:true,channel:true,projectId:true,unitId:true,guestNote:true,
      unit:{select:{name:true,inventoryCategory:{select:{name:true}}}},
      project:{select:{name:true}},
      guestIdentity:{select:{firstName:true,lastName:true}},
      payments:{select:{id:true,status:true,amountThb:true,method:true,receiptRef:true,
        refunds:{select:{status:true,amountThb:true}}},orderBy:{createdAt:'desc'}},
      changes:{select:{id:true,changeType:true,createdAt:true,priceDeltaThb:true},
        orderBy:{createdAt:'desc'},take:10},
      serviceOrders:{select:{id:true,status:true,total_thb:true,scheduled_start:true,
        service:{select:{title:true}}},orderBy:{createdAt:'desc'}},
      depositPreauth:{select:{amountThb:true,status:true,authorizedAt:true,voidedAt:true,capturedAt:true}},
      depositClaims:{select:{id:true,claimedAmountThb:true,status:true,description:true,filedAt:true},
        orderBy:{filedAt:'desc'}},
      conditionReports:{select:{id:true,reportType:true,createdAt:true,notes:true,_count:{select:{media:true}}},
        orderBy:{createdAt:'desc'}},
    },
  });
  if(!booking)notFound();
  const access=await Promise.all(['reservations','front_desk','housekeeping','guest_care','finance'].map(department=>hasProjectDepartmentAccess(user,booking.projectId,department)));
  if(!access.some(Boolean))notFound();
  const canSeeFinance=access[4];
  const locale=getRequestLocale();
  const labels=await getLabels({
    ...enumLabelDefaults('bookingStatus','bookingChannel'),
    'staff.stay_360.title':'Stay 360',
    'staff.stay_360.back':'Stay operations',
    'staff.stay_360.booking':'Booking',
    'staff.stay_360.unit':'Home',
    'staff.stay_360.category':'Category',
    'staff.stay_360.guest':'Guest',
    'staff.stay_360.channel':'Channel',
    'staff.stay_360.status':'Status',
    'staff.stay_360.dates':'Stay dates',
    'staff.stay_360.total':'Booking total',
    'staff.stay_360.collected':'Collected by operator',
    'staff.stay_360.balance':'Balance due',
    'staff.stay_360.refund':'Refund accrued',
    'staff.stay_360.payment_history':'Payment history',
    'staff.stay_360.change_history':'Change history',
    'staff.stay_360.folio':'Guest folio',
    'staff.stay_360.services':'Stay services',
    'staff.stay_360.deposit':'Damage deposit',
    'staff.stay_360.claims':'Deposit claims',
    'staff.stay_360.condition':'Condition reports',
    'staff.stay_360.media':'media',
    'staff.stay_360.no_services':'No stay-linked services.',
    'staff.stay_360.no_claims':'No deposit claims.',
    'staff.stay_360.no_condition':'No condition reports.',
    'staff.stay_360.no_payments':'No verified payments recorded.',
    'staff.stay_360.no_changes':'No booking changes recorded.',
    'staff.stay_360.request':'Approve request',
    'staff.stay_360.cash':'Record cash payment',
    'staff.stay_360.receipt':'Receipt reference',
    'staff.stay_360.check_in':'Check in',
    'staff.stay_360.check_out':'Check out',
    'staff.stay_360.error':'Action failed; check the booking and retry.',
    'staff.stay_360.success':'Booking updated.',
    'staff.stay_360.no_actions':'No available status transition.',
    'staff.stay_360.actions':'Next action',
    'staff.stay_360.warning':'Payment or refund changes require a verified financial transaction.',
    'staff.stay_360.guest_note':'Guest note',
  });
  const paid=booking.payments.filter(p=>p.status==='succeeded').reduce((s,p)=>s+p.amountThb,0);
  const amount=(n:number)=>'฿'+(n/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  return <main className="stitch-workspace p-16 md:p-32">
    <div className="mx-auto max-w-5xl space-y-24">
      <Link href={pmsNavigationHref('/ops/stays', { spaceId: searchParams?.spaceId, projectId: booking.projectId })} className="text-small font-semibold text-brand-andaman">
        ← {labels['staff.stay_360.back']}
      </Link>
      <header className="stitch-panel p-24">
        <p className="stitch-kicker">{labels['staff.stay_360.booking']} · {booking.id}</p>
        <h1 className="mt-8 font-display text-display-xl font-semibold text-text-ink">{labels['staff.stay_360.title']}</h1>
        <p className="mt-8 text-body text-text-secondary">
          {booking.project.name} · {booking.unit.name} · {booking.unit.inventoryCategory?.name}
        </p>
      </header>
      {canSeeFinance && <div className="grid grid-cols-2 gap-12 md:grid-cols-4">
        {[
          [labels['staff.stay_360.total'],amount(booking.totalThb)],
          [labels['staff.stay_360.collected'],amount(paid)],
          [labels['staff.stay_360.balance'],amount(booking.balanceDueThb)],
          [labels['staff.stay_360.refund'],amount(booking.refundAccruedThb)],
        ].map(([label,value])=><div key={label} className="stitch-panel p-16">
          <p className="text-small text-text-secondary">{label}</p>
          <p className="mt-8 font-display text-heading-3 font-semibold text-text-ink">{value}</p>
        </div>)}
      </div>}
      <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
        <section className="stitch-panel p-20">
          <dl className="grid grid-cols-2 gap-12">
            {[
              [labels['staff.stay_360.status'],enumLabel(labels,'bookingStatus',booking.status)],
              [labels['staff.stay_360.channel'],enumLabel(labels,'bookingChannel',booking.channel)],
              [labels['staff.stay_360.guest'],[booking.guestIdentity.firstName,booking.guestIdentity.lastName].join(' ')],
              [labels['staff.stay_360.dates'],formatDate(booking.startDate,locale)+' — '+formatDate(booking.endDate,locale)],
            ].map(([label,value])=><div key={label}><dt className="text-small text-text-secondary">{label}</dt>
              <dd className="mt-4 text-body font-semibold text-text-ink">{value}</dd></div>)}
          </dl>
          {booking.guestNote&&<p className="mt-16 text-small text-text-secondary">
            {labels['staff.stay_360.guest_note']}: {booking.guestNote}
          </p>}
        </section>
        <StayActions id={booking.id} status={booking.status} balanceSatang={canSeeFinance?booking.balanceDueThb:0}
          canRecordMoney={canSeeFinance} canManageReservations={access[0]} canManageFrontDesk={access[1]}
          labels={labels}/>
      </div>
      {canSeeFinance && <section className="stitch-panel p-20">
        <h2 className="text-subtitle font-semibold text-text-ink">{labels['staff.stay_360.payment_history']}</h2>
        {booking.payments.length===0?<p className="mt-12 text-small text-text-secondary">{labels['staff.stay_360.no_payments']}</p>:
          <ul className="mt-12 space-y-8">{booking.payments.map(p=><li key={p.id} className="flex flex-wrap justify-between gap-8 border-b border-border-line py-8 text-small">
            <span>{p.method} · {p.status} {p.receiptRef??''}</span><span>{amount(p.amountThb)}</span>
          </li>)}</ul>}
      </section>}
      {canSeeFinance && <section className="stitch-panel p-20">
        <div className="flex flex-wrap items-center justify-between gap-8">
          <div>
            <p className="stitch-kicker">{labels['staff.stay_360.folio']}</p>
            <h2 className="mt-4 text-subtitle font-semibold text-text-ink">{labels['staff.stay_360.services']}</h2>
          </div>
          {booking.depositPreauth ? <span className="rounded-full bg-surface-ivory px-12 py-4 text-small font-semibold">
            {labels['staff.stay_360.deposit']} · {booking.depositPreauth.status} · {amount(booking.depositPreauth.amountThb)}
          </span> : null}
        </div>
        {booking.serviceOrders.length===0?<p className="mt-12 text-small text-text-secondary">{labels['staff.stay_360.no_services']}</p>:
          <ul className="mt-12 space-y-8">{booking.serviceOrders.map(order=><li key={order.id} className="flex flex-wrap justify-between gap-8 border-b border-border-line py-8 text-small">
            <span>{order.service.title} · {order.status} · {formatDate(order.scheduled_start,locale)}</span>
            <span>{amount(order.total_thb)}</span>
          </li>)}</ul>}
        <div className="mt-20 grid gap-16 md:grid-cols-2">
          <div>
            <h3 className="font-semibold">{labels['staff.stay_360.claims']}</h3>
            {booking.depositClaims.length===0?<p className="mt-8 text-small text-text-secondary">{labels['staff.stay_360.no_claims']}</p>:
              <ul className="mt-8 space-y-8">{booking.depositClaims.map(claim=><li key={claim.id} className="rounded-md bg-surface-ivory p-12 text-small">
                <div className="flex justify-between gap-8"><span className="font-semibold">{claim.status}</span><span>{amount(claim.claimedAmountThb)}</span></div>
                <p className="mt-4 text-text-secondary">{claim.description}</p>
              </li>)}</ul>}
          </div>
          <div>
            <h3 className="font-semibold">{labels['staff.stay_360.condition']}</h3>
            {booking.conditionReports.length===0?<p className="mt-8 text-small text-text-secondary">{labels['staff.stay_360.no_condition']}</p>:
              <ul className="mt-8 space-y-8">{booking.conditionReports.map(report=><li key={report.id} className="rounded-md bg-surface-ivory p-12 text-small">
                <div className="flex justify-between gap-8"><span className="font-semibold">{report.reportType.replace(/_/g,' ')}</span><span>{report._count.media} {labels['staff.stay_360.media']}</span></div>
                <p className="mt-4 text-text-secondary">{formatDate(report.createdAt,locale)}{report.notes?' · '+report.notes:''}</p>
              </li>)}</ul>}
          </div>
        </div>
      </section>}
      <section className="stitch-panel p-20">
        <h2 className="text-subtitle font-semibold text-text-ink">{labels['staff.stay_360.change_history']}</h2>
        {booking.changes.length===0?<p className="mt-12 text-small text-text-secondary">{labels['staff.stay_360.no_changes']}</p>:
          <ul className="mt-12 space-y-8">{booking.changes.map(c=><li key={c.id} className="flex flex-wrap justify-between gap-8 border-b border-border-line py-8 text-small">
            <span>{c.createdAt.toISOString().slice(0,16)} · {c.changeType}</span>
            {canSeeFinance && <span>{amount(c.priceDeltaThb)}</span>}
          </li>)}</ul>}
      </section>
    </div>
  </main>;
}
