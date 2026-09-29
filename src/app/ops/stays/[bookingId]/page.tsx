import Link from 'next/link';
import { notFound,redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { hasProjectDepartmentAccess } from '@/app/libs/projectScope';
import { prisma } from '@/lib/prisma';
import { getLabels } from '@/lib/i18n';
import StayActions from '@/components/ops/StayActions';

export const dynamic='force-dynamic';
export default async function CanonicalStayPage({params}:{params:{bookingId:string}}){
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
    },
  });
  if(!booking)notFound();
  const access=await Promise.all(['reservations','front_desk','housekeeping','guest_care','finance'].map(department=>hasProjectDepartmentAccess(user,booking.projectId,department)));
  if(!access.some(Boolean))notFound();
  const canSeeFinance=access[4];
  const labels=await getLabels({
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
  return <main className="min-h-screen bg-surface-ivory p-16 md:p-32">
    <div className="mx-auto max-w-5xl space-y-24">
      <Link href="/ops/stays" className="text-small font-semibold text-brand-andaman">
        ← {labels['staff.stay_360.back']}
      </Link>
      <header className="rounded-lg border border-border-line bg-surface-paper p-24">
        <p className="text-kicker font-semibold tracking-widest text-brand-andaman">{labels['staff.stay_360.booking']} · {booking.id}</p>
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
        ].map(([label,value])=><div key={label} className="rounded-lg border border-border-line bg-surface-paper p-16">
          <p className="text-small text-text-secondary">{label}</p>
          <p className="mt-8 font-display text-heading-3 font-semibold text-text-ink">{value}</p>
        </div>)}
      </div>}
      <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
        <section className="rounded-lg border border-border-line bg-surface-paper p-20">
          <dl className="grid grid-cols-2 gap-12">
            {[
              [labels['staff.stay_360.status'],booking.status.replace(/_/g,' ')],
              [labels['staff.stay_360.channel'],booking.channel.replace(/_/g,' ')],
              [labels['staff.stay_360.guest'],[booking.guestIdentity.firstName,booking.guestIdentity.lastName].join(' ')],
              [labels['staff.stay_360.dates'],booking.startDate.toISOString().slice(0,10)+' — '+booking.endDate.toISOString().slice(0,10)],
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
      {canSeeFinance && <section className="rounded-lg border border-border-line bg-surface-paper p-20">
        <h2 className="text-subtitle font-semibold text-text-ink">{labels['staff.stay_360.payment_history']}</h2>
        {booking.payments.length===0?<p className="mt-12 text-small text-text-secondary">{labels['staff.stay_360.no_payments']}</p>:
          <ul className="mt-12 space-y-8">{booking.payments.map(p=><li key={p.id} className="flex flex-wrap justify-between gap-8 border-b border-border-line py-8 text-small">
            <span>{p.method} · {p.status} {p.receiptRef??''}</span><span>{amount(p.amountThb)}</span>
          </li>)}</ul>}
      </section>}
      <section className="rounded-lg border border-border-line bg-surface-paper p-20">
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
