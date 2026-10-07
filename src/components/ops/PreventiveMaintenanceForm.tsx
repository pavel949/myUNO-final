'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PreventiveMaintenanceForm({
  operatingSpaceId,units,teams,members,labels,
}:{operatingSpaceId:string;units:Array<{id:string;name:string;project:{name:string}}>;teams:Array<{id:string;name:string}>;members:Array<{identity:{id:string;firstName:string;lastName:string}}>;labels:Record<string,string>;}){
  const router=useRouter();const[busy,setBusy]=useState(false);const[error,setError]=useState('');
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError('');
    const f=new FormData(event.currentTarget);
    const response=await fetch('/api/ops/preventive-maintenance',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
      operatingSpaceId,title:String(f.get('title')||''),description:String(f.get('description')||''),
      unitId:String(f.get('unitId')||'')||undefined,assignedTeamId:String(f.get('assignedTeamId')||'')||undefined,
      assignedIdentityId:String(f.get('assignedIdentityId')||'')||undefined,frequencyDays:Number(f.get('frequencyDays')||90),
      nextDueAt:String(f.get('nextDueAt')||''),estimatedCostThb:Number(f.get('estimatedCostThb')||0)||undefined,
      blocksInventory:f.get('blocksInventory')==='on',
    })});
    const body=await response.json();
    if(!response.ok){setError(body.error||'Plan creation failed');setBusy(false);return;}
    event.currentTarget.reset();setBusy(false);router.refresh();
  }
  return <form onSubmit={submit} className="grid gap-12 stitch-panel p-16 md:grid-cols-2 xl:grid-cols-4">
    <input required name="title" placeholder={labels['staff.maintenance.plan_title']} className="h-44 rounded-md border border-border-line px-12"/>
    <select name="unitId" className="h-44 rounded-md border border-border-line px-12"><option value="">{labels['staff.maintenance.all_homes']}</option>{units.map(u=><option key={u.id} value={u.id}>{u.project.name} · {u.name}</option>)}</select>
    <input required name="frequencyDays" type="number" min="1" defaultValue="90" className="h-44 rounded-md border border-border-line px-12"/>
    <input required name="nextDueAt" type="datetime-local" className="h-44 rounded-md border border-border-line px-12"/>
    <select name="assignedTeamId" className="h-44 rounded-md border border-border-line px-12"><option value="">{labels['staff.maintenance.team']}</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
    <select name="assignedIdentityId" className="h-44 rounded-md border border-border-line px-12"><option value="">{labels['staff.maintenance.employee']}</option>{members.map(m=><option key={m.identity.id} value={m.identity.id}>{m.identity.firstName} {m.identity.lastName}</option>)}</select>
    <input name="estimatedCostThb" type="number" min="0" placeholder={labels['staff.maintenance.estimated_cost']} className="h-44 rounded-md border border-border-line px-12"/>
    <label className="flex items-center gap-8 text-small text-text-secondary"><input name="blocksInventory" type="checkbox"/>{labels['staff.maintenance.blocks_inventory']}</label>
    <textarea name="description" placeholder={labels['staff.maintenance.description']} className="min-h-24 rounded-md border border-border-line p-12 md:col-span-2 xl:col-span-3"/>
    <button disabled={busy} className="h-44 rounded-md bg-brand-deep px-16 text-small font-semibold text-white">{busy?labels['staff.maintenance.creating']:labels['staff.maintenance.create_plan']}</button>
    {error?<p role="alert" className="text-small text-state-error md:col-span-2 xl:col-span-4">{error}</p>:null}
  </form>;
}
