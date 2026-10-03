'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CategoryAllocationForm({
  bookingId,operatingSpaceId,units,labels,
}:{
  bookingId:string;
  operatingSpaceId:string;
  units:Array<{id:string;name:string}>;
  labels:Record<string,string>;
}){
  const router=useRouter();
  const [unitId,setUnitId]=useState(units[0]?.id||'');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  async function assign(){
    if(!unitId)return;
    setBusy(true);setError('');
    const response=await fetch('/api/ops/reservations/'+encodeURIComponent(bookingId)+'/allocation',{
      method:'PUT',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({operatingSpaceId,unitId}),
    });
    const body=await response.json();
    if(!response.ok){setError(body.error||labels['reservations.allocation_failed']);setBusy(false);return;}
    setBusy(false);router.refresh();
  }

  return <div className="mt-8 rounded-md bg-surface-ivory p-10">
    <p className="text-small font-semibold text-text-secondary">{labels['reservations.assignment_pending']}</p>
    <div className="mt-6 flex flex-wrap gap-6">
      <select value={unitId} onChange={e=>setUnitId(e.target.value)}
        className="h-40 min-w-40 rounded-md border border-border-line bg-white px-8 text-small">
        {units.map(unit=><option key={unit.id} value={unit.id}>{unit.name}</option>)}
      </select>
      <button type="button" disabled={busy||!unitId} onClick={assign}
        className="rounded-md bg-brand-deep px-12 py-7 text-small font-semibold text-white">
        {busy?labels['reservations.assigning']:labels['reservations.assign_unit']}
      </button>
    </div>
    {error?<p role="alert" className="mt-6 text-small text-red-700">{error}</p>:null}
  </div>;
}
