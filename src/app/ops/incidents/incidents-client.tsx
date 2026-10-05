'use client';
import { FormEvent,useState } from 'react';
import { useRouter } from 'next/navigation';

type Unit={id:string;name:string;projectName:string};
type Member={identityId:string;name:string};
type Incident={id:string;unitId:string;incidentType:string;severity:string;description:string;status:string;createdAt:string;unit:{name:string;project:{name:string}};assignedTo:{firstName:string;lastName:string}|null};

export default function IncidentsClient({spaceId,units,members,incidents,labels}:{spaceId:string;units:Unit[];members:Member[];incidents:Incident[];labels:Record<string,string>}){
 const router=useRouter();const[busy,setBusy]=useState('');const[error,setError]=useState('');const[notice,setNotice]=useState('');
 const submit=async(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();setBusy('create');setError('');setNotice('');
  const form=new FormData(event.currentTarget);
  const response=await fetch('/api/ops/incidents',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
    spaceId,unitId:String(form.get('unitId')||''),incidentType:String(form.get('incidentType')||''),severity:String(form.get('severity')||''),
    description:String(form.get('description')||''),assignedToIdentityId:String(form.get('assignedToIdentityId')||'')||null,
  })});
  const body=await response.json().catch(()=>null);setBusy('');
  if(!response.ok){setError(body?.error||labels['staff.incidents.error']);return;}
  event.currentTarget.reset();setNotice(labels['staff.incidents.created']);router.refresh();
 };
 const transition=async(id:string,status:string)=>{
  setBusy(id);setError('');setNotice('');
  const resolutionNotes=status==='resolved'?window.prompt(labels['staff.incidents.resolve_prompt'])||'':'';
  if(status==='resolved'&&!resolutionNotes.trim()){setBusy('');return;}
  const response=await fetch(`/api/ops/incidents/${encodeURIComponent(id)}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({spaceId,status,resolutionNotes})});
  const body=await response.json().catch(()=>null);setBusy('');
  if(!response.ok){setError(body?.error||labels['staff.incidents.error']);return;}
  setNotice(labels['staff.incidents.updated']);router.refresh();
 };
 return <div className="space-y-20">
  {error&&<div role="alert" className="rounded-md border border-red-300 bg-red-50 p-12 text-red-900">{error}</div>}
  {notice&&<div role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-12 text-emerald-900">{notice}</div>}
  <form onSubmit={submit} className="rounded-xl border border-border-line bg-surface-paper p-20">
   <h2 className="font-display text-heading-2 font-semibold">{labels['staff.incidents.report']}</h2>
   <div className="mt-12 grid gap-8 md:grid-cols-2 xl:grid-cols-4">
    <select required name="unitId" className="h-40 rounded-md border border-border-line px-12"><option value="">{labels['staff.incidents.property']}</option>{units.map(u=><option key={u.id} value={u.id}>{u.projectName} · {u.name}</option>)}</select>
    <select required name="incidentType" className="h-40 rounded-md border border-border-line px-12">{['maintenance','complaint','violation'].map(v=><option key={v} value={v}>{v}</option>)}</select>
    <select required name="severity" className="h-40 rounded-md border border-border-line px-12">{['low','medium','high','critical'].map(v=><option key={v} value={v}>{v}</option>)}</select>
    <select name="assignedToIdentityId" className="h-40 rounded-md border border-border-line px-12"><option value="">{labels['staff.incidents.unassigned']}</option>{members.map(m=><option key={m.identityId} value={m.identityId}>{m.name}</option>)}</select>
   </div>
   <textarea required name="description" rows={3} placeholder={labels['staff.incidents.description']} className="mt-8 w-full rounded-md border border-border-line p-12"/>
   <button disabled={busy==='create'} className="mt-8 rounded-md bg-brand-deep px-16 py-8 text-small font-semibold text-white disabled:opacity-50">{busy==='create'?labels['staff.incidents.saving']:labels['staff.incidents.create']}</button>
  </form>
  <section className="space-y-8"><h2 className="font-display text-heading-2 font-semibold">{labels['staff.incidents.open']}</h2>
   {!incidents.length?<p className="rounded-xl border border-border-line bg-surface-paper p-20 text-text-secondary">{labels['staff.incidents.empty']}</p>:
    incidents.map(item=><article key={item.id} className="rounded-xl border border-border-line bg-surface-paper p-16">
     <div className="flex flex-wrap items-start justify-between gap-8"><div><p className="font-semibold">{item.unit.project.name} · {item.unit.name}</p><p className="mt-4 text-small text-text-secondary">{item.incidentType} · {item.severity} · {new Date(item.createdAt).toLocaleString('en-GB',{timeZone:'Asia/Bangkok'})}</p></div><span className="rounded-full bg-surface-ivory px-8 py-4 text-small font-semibold">{item.status.replace(/_/g,' ')}</span></div>
     <p className="mt-8 text-body">{item.description}</p>
     {item.assignedTo&&<p className="mt-4 text-small text-text-secondary">{labels['staff.incidents.assigned']}: {item.assignedTo.firstName} {item.assignedTo.lastName}</p>}
     <div className="mt-12 flex flex-wrap gap-8">{item.status==='open'&&<button disabled={busy===item.id} onClick={()=>void transition(item.id,'acknowledged')} className="rounded-md border border-border-line px-12 py-8 text-small font-semibold">{labels['staff.incidents.ack']}</button>}
      {['open','acknowledged'].includes(item.status)&&<button disabled={busy===item.id} onClick={()=>void transition(item.id,'in_progress')} className="rounded-md border border-border-line px-12 py-8 text-small font-semibold">{labels['staff.incidents.start']}</button>}
      {!['resolved','closed'].includes(item.status)&&<button disabled={busy===item.id} onClick={()=>void transition(item.id,'resolved')} className="rounded-md bg-brand-deep px-12 py-8 text-small font-semibold text-white">{labels['staff.incidents.resolve']}</button>}
     </div>
    </article>)}
  </section>
 </div>;
}
