'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import CheckOutConditionReportModal from '@/components/ops/CheckOutConditionReportModal';

export default function StayActions({
  id,status,updatedAt,balanceSatang,canConfirmUnpaid,canRecordMoney,canManageReservations,canManageFrontDesk,guestName,unitName,labels,
}:{
  id:string;guestName:string;unitName:string;status:string;updatedAt?:string;balanceSatang:number;canConfirmUnpaid?:boolean;canRecordMoney:boolean;canManageReservations:boolean;canManageFrontDesk:boolean;
  labels:Record<string,string>;
}){
  const router=useRouter();
  const [busy,setBusy]=useState(false);
  const [receipt,setReceipt]=useState('');
  const [reason,setReason]=useState('');
  const confirmation=useRef<{key:string;id:string}|null>(null);
  const [message,setMessage]=useState('');
  const [failed,setFailed]=useState(false);
  const [checkingOut,setCheckingOut]=useState(false);
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
  const canCash=(status==='pending_payment'||['confirmed','checked_in','checked_out'].includes(status))&&balanceSatang>0&&canRecordMoney;
  const canConfirm=status==='pending_payment'&&canManageReservations&&canConfirmUnpaid&&Boolean(updatedAt);
  const confirmUnpaid=()=>{
    if(!updatedAt||!reason.trim())return;
    const key=updatedAt+'|'+reason.trim();
    const commandId=confirmation.current?.key===key?confirmation.current.id:crypto.randomUUID();
    confirmation.current={key,id:commandId};
    void run('confirm-unpaid',{reason:reason.trim(),expectedUpdatedAt:updatedAt,commandId});
  };
  const canCheckIn=status==='confirmed'&&canManageFrontDesk;
  const canCheckOut=status==='checked_in'&&canManageFrontDesk;
  return <section className="stitch-panel p-20" aria-label={labels['staff.stay_360.actions']}>
    <h2 className="text-subtitle font-semibold text-text-ink">{labels['staff.stay_360.actions']}</h2>
    <p className="my-12 text-small text-text-secondary">{labels['staff.stay_360.warning']}</p>
    {message&&<p role={failed?'alert':'status'} className={'mb-12 rounded-md p-12 text-small '+(failed?'bg-state-error-soft text-state-error':'bg-state-success-soft text-state-success')}>{message}</p>}
    <div className="flex flex-col gap-12">
      {canApprove&&<button type="button" disabled={busy} onClick={()=>run('respond',{action:'approve'})}
        className="rounded-md bg-brand-deep px-16 py-12 text-small font-semibold text-white disabled:opacity-50">
        {labels['staff.stay_360.request']}
      </button>}
      {canConfirm&&<div className="space-y-8 rounded-md border border-border-line p-12">
        <p className="text-small text-text-secondary">{labels['staff.stay_360.confirm_unpaid_note']}</p>
        <p className="text-small font-semibold">{labels['staff.stay_360.balance']}: ฿{(balanceSatang/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
        <label className="block text-small font-semibold text-text-secondary" htmlFor="stay-confirmation-reason">{labels['staff.stay_360.confirm_reason']}</label>
        <input id="stay-confirmation-reason" value={reason} onChange={e=>setReason(e.target.value)} maxLength={500}
          className="h-40 w-full rounded-md border border-border-line px-12 text-text-ink"/>
        <button type="button" disabled={busy||!reason.trim()} onClick={confirmUnpaid}
          className="w-full rounded-md bg-brand-deep px-16 py-12 text-small font-semibold text-white disabled:opacity-50">
          {labels['staff.stay_360.confirm_unpaid']}
        </button>
      </div>}
      {canCash&&<div className="space-y-8">
        <label className="block text-small font-semibold text-text-secondary" htmlFor="stay-cash-receipt">
          {labels['staff.stay_360.receipt']}
        </label>
        <input id="stay-cash-receipt" value={receipt} onChange={e=>setReceipt(e.target.value)}
          className="h-40 w-full rounded-md border border-border-line px-12 text-text-ink" maxLength={120}/>
        <button type="button" disabled={busy||!receipt.trim()||balanceSatang<0}
          onClick={()=>run('record-cash-payment',{receiptRef:receipt.trim()})}
          className="w-full rounded-md bg-brand-deep px-16 py-12 text-small font-semibold text-white disabled:opacity-50">
          {labels['staff.stay_360.cash']}
        </button>
      </div>}
      {canCheckIn&&<Link href={'/ops/stays/'+encodeURIComponent(id)+'/check-in'}
        className="rounded-md bg-brand-deep px-16 py-12 text-center text-small font-semibold text-white">
        {labels['staff.stay_360.check_in']}
      </Link>}
      {canCheckOut&&<button type="button" disabled={busy} onClick={()=>setCheckingOut(true)}
        className="rounded-md bg-brand-deep px-16 py-12 text-small font-semibold text-white disabled:opacity-50">
        {labels['staff.stay_360.check_out']}
      </button>}
      {!canApprove&&!canConfirm&&!canCash&&!canCheckIn&&!canCheckOut&&
        <p className="text-small text-text-secondary">{labels['staff.stay_360.no_actions']}</p>}
    </div>
    {/* A departure always goes through the inspection, never a bare status flip. */}
    <CheckOutConditionReportModal bookingId={checkingOut?id:null} guestName={guestName} unitName={unitName} labels={labels}
      onClose={()=>setCheckingOut(false)}
      onComplete={()=>{setCheckingOut(false);setMessage(labels['staff.stay_360.success']);window.dispatchEvent(new Event('myuno:calendar-changed'));router.refresh();}}/>
  </section>;
}
