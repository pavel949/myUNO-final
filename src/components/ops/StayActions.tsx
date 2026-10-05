'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CheckInConditionReportModal from '@/components/ops/CheckInConditionReportModal';
import CheckOutConditionReportModal from '@/components/ops/CheckOutConditionReportModal';

export default function StayActions({
  id,status,balanceSatang,guestName,unitName,canRecordMoney,canManageReservations,canManageFrontDesk,labels,
}:{
  id:string;status:string;balanceSatang:number;guestName:string;unitName:string;
  canRecordMoney:boolean;canManageReservations:boolean;canManageFrontDesk:boolean;
  labels:Record<string,string>;
}){
  const router=useRouter();
  const [busy,setBusy]=useState(false);
  const [receipt,setReceipt]=useState('');
  const [message,setMessage]=useState('');
  const [failed,setFailed]=useState(false);
  const [checkinOpen,setCheckinOpen]=useState(false);
  const [checkoutOpen,setCheckoutOpen]=useState(false);
  const run=async(path:string,payload:unknown={})=>{
    if(busy)return;
    setBusy(true);setMessage('');setFailed(false);
    try{
      const result=await fetch('/api/bookings/'+encodeURIComponent(id)+'/'+path,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload),
      });
      const body=await result.json().catch(()=>({}));
      if(!result.ok)throw new Error(typeof body.error==='string'?body.error:labels['staff.stay_360.error']);
      setMessage(labels['staff.stay_360.success']);
      window.dispatchEvent(new Event('myuno:calendar-changed'));
      router.refresh();
    }catch(error){
      setFailed(true);
      setMessage(error instanceof Error?error.message:labels['staff.stay_360.error']);
    }finally{setBusy(false);}
  };
  const canApprove=status==='requested'&&canManageReservations;
  const canDecline=status==='requested'&&canManageReservations;
  const canCash=status==='pending_payment'&&canRecordMoney&&balanceSatang>0;
  const canCheckIn=status==='confirmed'&&canManageFrontDesk;
  const canCheckOut=status==='checked_in'&&canManageFrontDesk;
  return <section className="rounded-lg border border-border-line bg-surface-paper p-20" aria-label={labels['staff.stay_360.actions']}>
    <h2 className="text-subtitle font-semibold text-text-ink">{labels['staff.stay_360.actions']}</h2>
    <p className="mt-4 text-small text-text-secondary">
      {status==='pending_payment'
        ? labels['staff.stay_360.pending_next']
        : status==='confirmed'
          ? labels['staff.stay_360.confirmed_next']
          : status==='checked_in'
            ? labels['staff.stay_360.in_house_next']
            : labels['staff.stay_360.warning']}
    </p>
    <p className="my-12 text-small text-text-secondary">{labels['staff.stay_360.warning']}</p>
    {message&&<p role={failed?'alert':'status'} className={'mb-12 rounded-md p-12 text-small '+(failed?'bg-red-50 text-red-800':'bg-emerald-50 text-emerald-800')}>{message}</p>}
    <div className="flex flex-col gap-12">
      {canApprove&&<div className="grid gap-8 sm:grid-cols-2">
        <button type="button" disabled={busy} onClick={()=>run('respond',{action:'approve'})}
          className="rounded-md bg-brand-deep px-16 py-12 text-small font-semibold text-white disabled:opacity-50">
          {labels['staff.stay_360.request']}
        </button>
        <button type="button" disabled={busy} onClick={()=>{
          if(window.confirm(labels['staff.stay_360.decline_confirm'])) void run('respond',{action:'decline'});
        }}
          className="rounded-md border border-border-line bg-surface-paper px-16 py-12 text-small font-semibold text-text-ink disabled:opacity-50">
          {labels['staff.stay_360.decline']}
        </button>
      </div>}
      {canCash&&<div className="space-y-8">
        <label className="block text-small font-semibold text-text-secondary" htmlFor="stay-cash-receipt">
          {labels['staff.stay_360.receipt']}
        </label>
        <input id="stay-cash-receipt" value={receipt} onChange={e=>setReceipt(e.target.value)}
          className="h-40 w-full rounded-md border border-border-line px-12 text-text-ink" maxLength={120}/>
        <button type="button" disabled={busy||!receipt.trim()||balanceSatang<=0}
          onClick={()=>{
            const amount=(Math.max(0,balanceSatang)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
            if(window.confirm(labels['staff.stay_360.confirm_payment_dialog'].replace('{amount}',amount))){
              void run('record-cash-payment',{receiptRef:receipt.trim()});
            }
          }}
          className="w-full rounded-md bg-brand-deep px-16 py-12 text-small font-semibold text-white disabled:opacity-50">
          {labels['staff.stay_360.confirm_payment']}
        </button>
        <p className="text-small text-text-secondary">
          {labels['staff.stay_360.amount_to_confirm']}: ฿{(Math.max(0,balanceSatang)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}
        </p>
      </div>}
      {canCheckIn&&<button type="button" disabled={busy} onClick={()=>setCheckinOpen(true)}
        className="rounded-md bg-brand-deep px-16 py-12 text-small font-semibold text-white disabled:opacity-50">
        {labels['staff.stay_360.check_in']}
      </button>}
      {canCheckOut&&<button type="button" disabled={busy} onClick={()=>setCheckoutOpen(true)}
        className="rounded-md bg-brand-deep px-16 py-12 text-small font-semibold text-white disabled:opacity-50">
        {labels['staff.stay_360.check_out']}
      </button>}
      {!canApprove&&!canDecline&&!canCash&&!canCheckIn&&!canCheckOut&&
        <p className="text-small text-text-secondary">{labels['staff.stay_360.no_actions']}</p>}
    </div>
    <CheckInConditionReportModal
      bookingId={checkinOpen?id:null}
      guestName={guestName}
      unitName={unitName}
      labels={labels}
      onClose={()=>setCheckinOpen(false)}
      onComplete={()=>{
        setMessage(labels['staff.stay_360.checkin_complete']);
        window.dispatchEvent(new Event('myuno:calendar-changed'));
        router.refresh();
      }}
    />
    <CheckOutConditionReportModal
      bookingId={checkoutOpen?id:null}
      guestName={guestName}
      unitName={unitName}
      labels={labels}
      onClose={()=>setCheckoutOpen(false)}
      onComplete={()=>{
        setMessage(labels['staff.stay_360.checkout_complete']);
        window.dispatchEvent(new Event('myuno:calendar-changed'));
        router.refresh();
      }}
    />
  </section>;
}
