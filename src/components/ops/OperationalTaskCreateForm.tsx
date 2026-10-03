'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type Unit={id:string;name:string;project:{name:string}};
type Team={id:string;name:string};
type Member={identity:{id:string;firstName:string;lastName:string}};

export default function OperationalTaskCreateForm({
  operatingSpaceId,units,teams,members,labels,
}:{operatingSpaceId:string;units:Unit[];teams:Team[];members:Member[];labels:Record<string,string>}){
  const router=useRouter();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError('');
    const data=new FormData(event.currentTarget);
    const files=Array.from((event.currentTarget.elements.namedItem('photos') as HTMLInputElement | null)?.files||[]);
    const mediaAssetIds:string[]=[];
    for(const file of files){
      const upload=new FormData();upload.set('file',file);upload.set('kind','photo');
      const uploaded=await fetch('/api/media/upload',{method:'POST',body:upload});
      const uploadedBody=await uploaded.json();
      if(!uploaded.ok){setError(uploadedBody.error||'Photo upload failed');setBusy(false);return;}
      mediaAssetIds.push(uploadedBody.mediaAssetId);
    }
    const response=await fetch('/api/ops/tasks',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
      operatingSpaceId,
      unitId:String(data.get('unitId')||''),
      taskType:String(data.get('taskType')||'custom'),
      title:String(data.get('title')||''),
      description:String(data.get('description')||''),
      priority:String(data.get('priority')||'normal'),
      dueAt:String(data.get('dueAt')||''),
      assignedIdentityId:String(data.get('assignedIdentityId')||'')||undefined,
      assignedTeamId:String(data.get('assignedTeamId')||'')||undefined,
      estimatedCostThb:Number(data.get('estimatedCostThb')||0)||undefined,
      blocksInventory:data.get('blocksInventory')==='on',
      mediaAssetIds,
    })});
    const body=await response.json();
    if(!response.ok){setError(body.error||'Task creation failed');setBusy(false);return;}
    event.currentTarget.reset();setBusy(false);router.refresh();
  }
  const taskTypes=['custom','turnover_cleaning','turnover_inspection','maintenance_followup','preventive_maintenance','deep_cleaning','restocking','guest_request','prearrival','owner_request','utilities','pool','garden','pest_control','compliance'];
  return <form onSubmit={submit} className="mb-20 grid gap-12 rounded-xl border border-border-line bg-surface-paper p-16 md:grid-cols-2 xl:grid-cols-4">
    <input required name="title" placeholder={labels['staff.task_form.title']} className="h-44 rounded-md border border-border-line px-12"/>
    <select required name="unitId" className="h-44 rounded-md border border-border-line px-12"><option value="">{labels['staff.task_form.property']}</option>{units.map(u=><option key={u.id} value={u.id}>{u.project.name} · {u.name}</option>)}</select>
    <select name="taskType" defaultValue={'custom'} className="h-44 rounded-md border border-border-line px-12">
      {taskTypes.map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
    </select>
    <input required name="dueAt" type="datetime-local" className="h-44 rounded-md border border-border-line px-12"/>
    <select name="assignedIdentityId" className="h-44 rounded-md border border-border-line px-12"><option value="">{labels['staff.task_form.employee']}</option>{members.map(m=><option key={m.identity.id} value={m.identity.id}>{m.identity.firstName} {m.identity.lastName}</option>)}</select>
    <select name="assignedTeamId" className="h-44 rounded-md border border-border-line px-12"><option value="">{labels['staff.task_form.team']}</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
    <select name="priority" defaultValue={'normal'} className="h-44 rounded-md border border-border-line px-12"><option value="low">{labels['staff.task_form.priority.low']}</option><option value="normal">{labels['staff.task_form.priority.normal']}</option><option value="high">{labels['staff.task_form.priority.high']}</option><option value="urgent">{labels['staff.task_form.priority.urgent']}</option></select>
    <input name="estimatedCostThb" type="number" min="0" placeholder={labels['staff.task_form.estimated_cost']} className="h-44 rounded-md border border-border-line px-12"/>
    <textarea name="description" placeholder={labels['staff.task_form.description']} className="min-h-24 rounded-md border border-border-line p-12 md:col-span-2"/>
    <label className="flex flex-col gap-4 text-small text-text-secondary">
      {labels['staff.task_form.photos']||'Photos'}
      <input name="photos" type="file" accept={labels['staff.task_form.photo_accept']||undefined} multiple className="text-small"/>
    </label>
    <label className="flex items-center gap-8 text-small text-text-secondary"><input type="checkbox" name="blocksInventory"/>{labels['staff.task_form.blocks_inventory']}</label>
    <button disabled={busy} className="h-44 rounded-md bg-brand-deep px-16 text-small font-semibold text-white">{busy?labels['staff.task_form.creating']:labels['staff.task_form.create']}</button>
    {error?<p role="alert" className="text-small text-red-700 md:col-span-2 xl:col-span-4">{error}</p>:null}
  </form>;
}
