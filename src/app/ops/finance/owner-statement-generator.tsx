'use client';
import { FormEvent,useState } from 'react';
import { useRouter } from 'next/navigation';

type Unit={id:string;name:string;projectName:string};

export default function OwnerStatementGenerator({spaceId,units,labels}:{spaceId:string;units:Unit[];labels:Record<string,string>}){
 const router=useRouter();const[busy,setBusy]=useState(false);const[error,setError]=useState('');const[notice,setNotice]=useState('');
 const submit=async(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();setBusy(true);setError('');setNotice('');
  const form=new FormData(event.currentTarget);
  const response=await fetch('/api/ops/statements/generate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
    spaceId,unitId:String(form.get('unitId')||''),periodStart:String(form.get('periodStart')||''),periodEnd:String(form.get('periodEnd')||''),
  })});
  const body=await response.json().catch(()=>null);setBusy(false);
  if(!response.ok){setError(body?.error||labels['staff.finance.statement_error']);return;}
  setNotice(labels['staff.finance.statement_created']);router.refresh();
 };
 return <form onSubmit={submit} className="rounded-xl border border-border-line bg-surface-paper p-20">
  <h2 className="font-display text-heading-2 font-semibold">{labels['staff.finance.generate_statement']}</h2>
  <p className="mt-4 text-small text-text-secondary">{labels['staff.finance.generate_hint']}</p>
  {error&&<div role="alert" className="mt-12 rounded-md border border-red-300 bg-red-50 p-8 text-small text-red-900">{error}</div>}
  {notice&&<div role="status" className="mt-12 rounded-md border border-emerald-200 bg-emerald-50 p-8 text-small text-emerald-900">{notice}</div>}
  <div className="mt-12 grid gap-8 md:grid-cols-3">
   <label className="text-small font-semibold">{labels['staff.finance.property']}
    <select name="unitId" required className="mt-4 h-40 w-full rounded-md border border-border-line px-12"><option value="">{labels['staff.finance.choose_property']}</option>{units.map(unit=><option key={unit.id} value={unit.id}>{unit.projectName} · {unit.name}</option>)}</select>
   </label>
   <label className="text-small font-semibold">{labels['staff.finance.period_start']}<input name="periodStart" type="date" required className="mt-4 h-40 w-full rounded-md border border-border-line px-12"/></label>
   <label className="text-small font-semibold">{labels['staff.finance.period_end']}<input name="periodEnd" type="date" required className="mt-4 h-40 w-full rounded-md border border-border-line px-12"/></label>
  </div>
  <button disabled={busy} className="mt-12 rounded-md bg-brand-deep px-16 py-8 text-small font-semibold text-white disabled:opacity-50">{busy?labels['staff.finance.generating']:labels['staff.finance.generate']}</button>
 </form>;
}
