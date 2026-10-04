'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function StayActions({
  id,status,balanceSatang,canRecordMoney,canManageReservations,canManageFrontDesk,labels,
}:{
  id:string;status:string;balanceSatang:number;canRecordMoney:boolean;canManageReservations:boolean;canManageFrontDesk:boolean;
  labels:Record<string,string>;
}){
  const router=useRouter();
  const [busy,setBusy]=useState(false);
  const [receipt,setReceipt]=useState('');
  const [message,setMessage]=useState('');
  const [failed,setFailed]=useState(false);
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
  const canCash=status==='pending_payment'&&canRecordMoney;
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
      {canApprove&&<button type="button" disabled={busy} onClick={()=>run('respond',{action:'approve'})}
        className="rounded-md bg-brand-deep px-16 py-12 text-small font-semibold text-white disabled:opacity-50">
        {labels['staff.stay_360.request']}
      </button>}
      {canCash&&<div className="space-y-8">
        <label className="block text-small font-semibold text-text-secondary" htmlFor="stay-cash-receipt">
          {labels['staff.stay_360.receipt']}
        </label>
        <input id="stay-cash-receipt" value={receipt} onChange={e=>setReceipt(e.target.value)}
          className="h-40 w-full rounded-md border border-border-line px-12 text-text-ink" maxLength={120}/>
        <button type="button" disabled={busy||!receipt.trim()||balanceSatang<0}
          onClick={()=>run('record-cash-payment',{receiptRef:receipt.trim()})}
          className="w-full rounded-md bg-brand-deep px-16 py-12 text-small font-semibold text-white disabled:opacity-50">
          {labels['staff.stay_360.confirm_payment']}
        </button>
        <p className="text-small text-text-secondary">
          {labels['staff.stay_360.amount_to_confirm']}: ฿{(Math.max(0,balanceSatang)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}
        </p>
      </div>}
      {canCheckIn&&<button type="button" disabled={busy} onClick={()=>run('checkin')}
        className="rounded-md bg-brand-deep px-16 py-12 text-small font-semibold text-white disabled:opacity-50">
        {labels['staff.stay_360.check_in']}
      </button>}
      {canCheckOut&&<button type="button" disabled={busy} onClick={()=>run('check-out')}
        className="rounded-md bg-brand-deep px-16 py-12 text-small font-semibold text-white disabled:opacity-50">
        {labels['staff.stay_360.check_out']}
      </button>}
      {!canApprove&&!canCash&&!canCheckIn&&!canCheckOut&&
        <p className="text-small text-text-secondary">{labels['staff.stay_360.no_actions']}</p>}
    </div>
  </section>;
}
