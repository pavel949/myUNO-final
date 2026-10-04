import Link from 'next/link';
import { notFound,redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/actions/getCurrentUser';
import { hasManagedUnitMcAccess, hasProjectDepartmentAccess } from '@/app/libs/projectScope';
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
      payments:{select:{
        id:true,status:true,amountThb:true,method:true,receiptRef:true,createdAt:true,receivedAt:true,succeededAt:true,
        receivedBy:{select:{firstName:true,lastName:true}},
        refunds:{select:{status:true,amountThb:true}}
      },orderBy:{createdAt:'desc'}},
      changes:{select:{
        id:true,changeType:true,createdAt:true,priceDeltaThb:true,oldValue:true,newValue:true,
        actor:{select:{firstName:true,lastName:true}}
      },orderBy:{createdAt:'desc'},take:10},
    },
  });
  if(!booking)notFound();
  const access=await Promise.all(['reservations','front_desk','housekeeping','guest_care','finance'].map(department=>hasProjectDepartmentAccess(user,booking.projectId,department)));
  const mcAccess=await hasManagedUnitMcAccess(user,{projectId:booking.projectId,unitId:booking.unitId});
  if(!access.some(Boolean)&&!mcAccess)notFound();
  const canSeeFinance=access[4]||mcAccess;
  const backHref=mcAccess&&!access.some(Boolean)
    ? '/mc/properties/'+encodeURIComponent(booking.unitId)+'?tab=reservations'
    : '/ops/stays';
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
    'staff.stay_360.pending_inventory':'Dates are locked while payment is pending.',
    'staff.stay_360.confirmed_inventory':'Booking confirmed. Inventory remains reserved.',
    'staff.stay_360.pending_next':'Payment is the next required step. Confirming payment will change the booking to Confirmed.',
    'staff.stay_360.confirmed_next':'Payment is confirmed. The next operational step is guest check-in.',
    'staff.stay_360.in_house_next':'The guest is in house. Complete checkout when the stay ends.',
    'staff.stay_360.confirm_payment':'Confirm payment & booking',
    'staff.stay_360.amount_to_confirm':'Amount to confirm',
    'staff.stay_360.decline':'Decline request',
    'staff.stay_360.decline_confirm':'Decline this booking request? The guest will be notified and the dates will remain available.',
    'staff.stay_360.confirm_payment_dialog':'Confirm receipt of ฿{amount}? This will mark the booking Confirmed and keep the dates reserved.',
    'staff.stay_360.checkin_complete':'Check-in completed.',
    'staff.stay_360.checkout_complete':'Check-out completed.',
    'staff.stay_360.nights':'nights',
    'staff.stay_360.received_by':'Received by',
    'staff.stay_360.changed_by':'Changed by',
    'staff.stay_360.status.requested':'Booking request',
    'staff.stay_360.status.pending_payment':'Payment pending',
    'staff.stay_360.status.confirmed':'Confirmed',
    'staff.stay_360.status.checked_in':'Checked in',
    'staff.stay_360.status.checked_out':'Checked out',
    'staff.ops.error_generic':'Action failed. Please try again.',
    'staff.ops.checkin.title':'Check in — {guest_name} · {unit_name}',
    'staff.ops.checkin.hint':'Complete the walkthrough checklist and capture photos before confirming check-in.',
    'staff.ops.checkin.close':'Close',
    'staff.ops.checkin.checklist_title':'Walkthrough checklist',
    'staff.ops.checkin.checklist.entry':'Entry and exterior',
    'staff.ops.checkin.checklist.living':'Living area',
    'staff.ops.checkin.checklist.kitchen':'Kitchen',
    'staff.ops.checkin.checklist.bedrooms':'Bedrooms',
    'staff.ops.checkin.checklist.bathrooms':'Bathrooms',
    'staff.ops.checkin.checklist.appliances':'Appliances working',
    'staff.ops.checkin.checklist_required':'Check at least one area on the walkthrough checklist.',
    'staff.ops.checkin.photos_title':'Condition photos',
    'staff.ops.checkin.photos_hint':'Upload photos of any issues or the overall condition.',
    'staff.ops.checkin.photo_upload_error':'Could not upload a photo.',
    'staff.ops.checkin.notes_title':'Notes',
    'staff.ops.checkin.notes_placeholder':'Any damage, missing items, or guest requests…',
    'staff.ops.checkin.submit':'Confirm check-in',
    'staff.ops.checkout.title':'Check out — {guest_name} · {unit_name}',
    'staff.ops.checkout.hint':'Complete the departure inspection checklist and capture photos before confirming check-out.',
    'staff.ops.checkout.close':'Close',
    'staff.ops.checkout.checklist_title':'Departure inspection',
    'staff.ops.checkout.checklist.entry':'Entry and exterior',
    'staff.ops.checkout.checklist.living':'Living area',
    'staff.ops.checkout.checklist.kitchen':'Kitchen',
    'staff.ops.checkout.checklist.bedrooms':'Bedrooms',
    'staff.ops.checkout.checklist.bathrooms':'Bathrooms',
    'staff.ops.checkout.checklist.appliances':'Appliances and utilities',
    'staff.ops.checkout.checklist_required':'Check at least one area on the inspection checklist.',
    'staff.ops.checkout.photos_title':'Condition photos',
    'staff.ops.checkout.photos_hint':'Photograph any damage or issues found during inspection.',
    'staff.ops.checkout.photo_upload_error':'Could not upload a photo.',
    'staff.ops.checkout.notes_title':'Notes',
    'staff.ops.checkout.notes_placeholder':'Damage, missing items, or follow-up needed…',
    'staff.ops.checkout.submit':'Confirm check-out',
  });
  const paid=booking.payments.filter(p=>p.status==='succeeded').reduce((s,p)=>s+p.amountThb,0);
  const amount=(n:number)=>'฿'+(n/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const statusLabel=labels['staff.stay_360.status.'+booking.status]||booking.status.replace(/_/g,' ');
  const formatBangkok=(value:Date)=>value.toLocaleString('en-GB',{timeZone:'Asia/Bangkok',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
  const nights=Math.max(0,Math.round((booking.endDate.getTime()-booking.startDate.getTime())/86400000));
  const guestName=[booking.guestIdentity.firstName,booking.guestIdentity.lastName].filter(Boolean).join(' ');
  return <main className="min-h-screen bg-surface-ivory p-16 md:p-32">
    <div className="mx-auto max-w-5xl space-y-24">
      <Link href={backHref} className="text-small font-semibold text-brand-andaman">
        ← {labels['staff.stay_360.back']}
      </Link>
      <header className="rounded-lg border border-border-line bg-surface-paper p-24">
        <div className="flex flex-wrap items-start justify-between gap-12">
          <div>
            <p className="text-kicker font-semibold tracking-widest text-brand-andaman">{labels['staff.stay_360.booking']} · {booking.id}</p>
            <h1 className="mt-8 font-display text-display-xl font-semibold text-text-ink">{labels['staff.stay_360.title']}</h1>
            <p className="mt-8 text-body text-text-secondary">
              {booking.project.name} · {booking.unit.name} · {booking.unit.inventoryCategory?.name}
            </p>
          </div>
          <div className="flex flex-col items-end gap-4">
            <span className={booking.status==='confirmed'
              ? 'rounded-full bg-emerald-100 px-12 py-4 text-small font-semibold text-emerald-900'
              : booking.status==='pending_payment'
                ? 'rounded-full bg-amber-100 px-12 py-4 text-small font-semibold text-amber-900'
                : booking.status==='checked_in'
                  ? 'rounded-full bg-teal-100 px-12 py-4 text-small font-semibold text-teal-900'
                  : 'rounded-full bg-surface-ivory px-12 py-4 text-small font-semibold text-text-ink'}>
              {statusLabel}
            </span>
            {booking.status==='pending_payment' && <span className="text-small text-text-secondary">{labels['staff.stay_360.pending_inventory']}</span>}
            {booking.status==='confirmed' && <span className="text-small text-text-secondary">{labels['staff.stay_360.confirmed_inventory']}</span>}
          </div>
        </div>
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
              [labels['staff.stay_360.status'],statusLabel],
              [labels['staff.stay_360.channel'],booking.channel.replace(/_/g,' ')],
              [labels['staff.stay_360.guest'],guestName],
              [labels['staff.stay_360.dates'],booking.startDate.toISOString().slice(0,10)+' — '+booking.endDate.toISOString().slice(0,10)+' · '+nights+' '+labels['staff.stay_360.nights']],
            ].map(([label,value])=><div key={label}><dt className="text-small text-text-secondary">{label}</dt>
              <dd className="mt-4 text-body font-semibold text-text-ink">{value}</dd></div>)}
          </dl>
          {booking.guestNote&&<p className="mt-16 text-small text-text-secondary">
            {labels['staff.stay_360.guest_note']}: {booking.guestNote}
          </p>}
        </section>
        <StayActions id={booking.id} status={booking.status} balanceSatang={canSeeFinance?booking.balanceDueThb:0}
          guestName={guestName} unitName={booking.unit.name}
          canRecordMoney={canSeeFinance} canManageReservations={access[0]||mcAccess} canManageFrontDesk={access[1]||mcAccess}
          labels={labels}/>
      </div>
      {canSeeFinance && <section className="rounded-lg border border-border-line bg-surface-paper p-20">
        <h2 className="text-subtitle font-semibold text-text-ink">{labels['staff.stay_360.payment_history']}</h2>
        {booking.payments.length===0?<p className="mt-12 text-small text-text-secondary">{labels['staff.stay_360.no_payments']}</p>:
          <ul className="mt-12 space-y-8">{booking.payments.map(p=><li key={p.id} className="border-b border-border-line py-8 text-small">
            <div className="flex flex-wrap justify-between gap-8">
              <span className="font-semibold">{p.method.replace(/_/g,' ')} · {p.status.replace(/_/g,' ')} {p.receiptRef??''}</span>
              <span>{amount(p.amountThb)}</span>
            </div>
            <p className="mt-2 text-caption text-text-secondary">
              {formatBangkok(p.receivedAt||p.succeededAt||p.createdAt)}
              {p.receivedBy ? ' · '+labels['staff.stay_360.received_by']+' '+[p.receivedBy.firstName,p.receivedBy.lastName].filter(Boolean).join(' ') : ''}
            </p>
          </li>)}</ul>}
      </section>}
      <section className="rounded-lg border border-border-line bg-surface-paper p-20">
        <h2 className="text-subtitle font-semibold text-text-ink">{labels['staff.stay_360.change_history']}</h2>
        {booking.changes.length===0?<p className="mt-12 text-small text-text-secondary">{labels['staff.stay_360.no_changes']}</p>:
          <ul className="mt-12 space-y-8">{booking.changes.map(change=><li key={change.id} className="border-b border-border-line py-8 text-small">
            <div className="flex flex-wrap justify-between gap-8">
              <span className="font-semibold">{formatBangkok(change.createdAt)} · {change.changeType.replace(/_/g,' ')}</span>
              {canSeeFinance && <span>{amount(change.priceDeltaThb)}</span>}
            </div>
            <p className="mt-2 text-caption text-text-secondary">{labels['staff.stay_360.changed_by']} {[change.actor.firstName,change.actor.lastName].filter(Boolean).join(' ')}</p>
            {(change.oldValue!=null||change.newValue!=null) && <p className="mt-2 break-words text-caption text-text-secondary">
              {change.oldValue!=null ? JSON.stringify(change.oldValue) : '—'} → {change.newValue!=null ? JSON.stringify(change.newValue) : '—'}
            </p>}
          </li>)}</ul>}
      </section>
    </div>
  </main>;
}
