'use client';

import { FormEvent,useCallback,useEffect,useMemo,useState } from 'react';

type Space={id:string;key:string;name:string;organizationId:string;timezone:string;status:string;units:Array<{unitId:string}>;_count:{members:number;teams:number}};
type Organization={id:string;name:string;orgType:string};
type Unit={id:string;name:string;status:string;project:{id:string;name:string};inventoryCategory:{name:string}|null};
type Payload={spaces:Space[];organizations:Organization[];units:Unit[]};

export default function OperatingSpaceManager({labels}:{labels:Record<string,string>}){
 const[data,setData]=useState<Payload|null>(null);const[busy,setBusy]=useState(false);const[error,setError]=useState('');const[notice,setNotice]=useState('');
 const[id,setId]=useState('');const[name,setName]=useState('');const[key,setKey]=useState('');const[organizationId,setOrganizationId]=useState('');const[timezone,setTimezone]=useState('Asia/Bangkok');const[status,setStatus]=useState('active');const[unitIds,setUnitIds]=useState<string[]>([]);const[search,setSearch]=useState('');
 const load=useCallback(async()=>{setError('');const response=await fetch('/api/ops/spaces/manage',{cache:'no-store'});const body=await response.json().catch(()=>null);if(!response.ok){setError(body?.error||labels['staff.space_manage.error']);return;}setData(body as Payload);},[labels]);
 useEffect(()=>{void load();},[load]);
 const visibleUnits=useMemo(()=>{const needle=search.trim().toLocaleLowerCase();return(data?.units||[]).filter(unit=>!needle||[unit.name,unit.project.name,unit.inventoryCategory?.name||''].join(' ').toLocaleLowerCase().includes(needle));},[data,search]);
 const reset=()=>{setId('');setName('');setKey('');setOrganizationId('');setTimezone('Asia/Bangkok');setStatus('active');setUnitIds([]);};
 const edit=(space:Space)=>{setId(space.id);setName(space.name);setKey(space.key);setOrganizationId(space.organizationId);setTimezone(space.timezone);setStatus(space.status);setUnitIds(space.units.map(unit=>unit.unitId));window.scrollTo({top:0,behavior:'smooth'});};
 const submit=async(event:FormEvent)=>{event.preventDefault();setBusy(true);setError('');setNotice('');try{const response=await fetch('/api/ops/spaces/manage',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:id||undefined,name,key,organizationId,timezone,status,unitIds})});const body=await response.json().catch(()=>null);if(!response.ok)throw new Error(body?.error||labels['staff.space_manage.error']);setNotice(id?labels['staff.space_manage.updated']:labels['staff.space_manage.created']);reset();await load();}catch(err){setError(err instanceof Error?err.message:labels['staff.space_manage.error']);}finally{setBusy(false);}};
 const toggleUnit=(unitId:string)=>setUnitIds(current=>current.includes(unitId)?current.filter(id=>id!==unitId):[...current,unitId]);
 return <div className="space-y-24">
  {error&&<div role="alert" className="rounded-md border border-red-300 bg-red-50 p-12 text-red-900">{error}</div>}
  {notice&&<div role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-12 text-emerald-900">{notice}</div>}
  <form onSubmit={submit} className="rounded-xl border border-border-line bg-surface-paper p-20">
   <div className="flex flex-wrap items-start justify-between gap-12"><div><h2 className="font-display text-heading-2 font-semibold">{id?labels['staff.space_manage.edit']:labels['staff.space_manage.create']}</h2><p className="mt-4 text-small text-text-secondary">{labels['staff.space_manage.hint']}</p></div>{id&&<button type="button" onClick={reset} className="text-small font-semibold text-brand-andaman underline">{labels['staff.space_manage.cancel']}</button>}</div>
   <div className="mt-16 grid gap-12 md:grid-cols-2 xl:grid-cols-4">
    <label className="text-small font-semibold">{labels['staff.space_manage.name']}<input required value={name} onChange={e=>setName(e.target.value)} className="mt-4 h-40 w-full rounded-md border border-border-line px-12"/></label>
    <label className="text-small font-semibold">{labels['staff.space_manage.key']}<input required value={key} onChange={e=>setKey(e.target.value)} className="mt-4 h-40 w-full rounded-md border border-border-line px-12"/></label>
    <label className="text-small font-semibold">{labels['staff.space_manage.organization']}<select required value={organizationId} onChange={e=>setOrganizationId(e.target.value)} className="mt-4 h-40 w-full rounded-md border border-border-line px-12"><option value="">{labels['staff.space_manage.choose']}</option>{(data?.organizations||[]).map(org=><option key={org.id} value={org.id}>{org.name} · {org.orgType.replace(/_/g,' ')}</option>)}</select></label>
    <label className="text-small font-semibold">{labels['staff.space_manage.status']}<select value={status} onChange={e=>setStatus(e.target.value)} className="mt-4 h-40 w-full rounded-md border border-border-line px-12"><option value="active">{labels['staff.space_manage.active']}</option><option value="archived">{labels['staff.space_manage.archived']}</option></select></label>
   </div>
   <div className="mt-40 flex flex-wrap items-end justify-between gap-8"><div><h3 className="font-semibold">{labels['staff.space_manage.properties']}</h3><p className="text-small text-text-secondary">{labels['staff.space_manage.properties_hint']}</p></div><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder={labels['staff.space_manage.search']} className="h-40 rounded-md border border-border-line px-12"/></div>
   <div className="mt-8 grid max-h-[420px] gap-8 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">{visibleUnits.map(unit=><label key={unit.id} className="flex items-start gap-8 rounded-md bg-surface-ivory p-8 text-small"><input type="checkbox" checked={unitIds.includes(unit.id)} onChange={()=>toggleUnit(unit.id)}/><span><strong>{unit.name}</strong><span className="block text-text-secondary">{unit.project.name}{unit.inventoryCategory?' · '+unit.inventoryCategory.name:''}</span></span></label>)}</div>
   <p className="mt-8 text-small text-text-secondary">{unitIds.length} {labels['staff.space_manage.selected']}</p>
   <button disabled={busy||!unitIds.length} className="mt-16 rounded-md bg-brand-deep px-16 py-8 text-small font-semibold text-white disabled:opacity-50">{busy?labels['staff.space_manage.saving']:labels['staff.space_manage.save']}</button>
  </form>
  <section><h2 className="font-display text-heading-2 font-semibold">{labels['staff.space_manage.existing']}</h2><div className="mt-12 grid gap-12 md:grid-cols-2 xl:grid-cols-3">{(data?.spaces||[]).map(space=><article key={space.id} className="rounded-xl border border-border-line bg-surface-paper p-16"><div className="flex items-start justify-between gap-8"><div><p className="text-small font-semibold text-brand-andaman">{space.key}</p><h3 className="mt-4 font-semibold">{space.name}</h3></div><span className="rounded-full bg-surface-ivory px-8 py-4 text-caption">{space.status}</span></div><p className="mt-8 text-small text-text-secondary">{space.units.length} {labels['staff.space_manage.properties_count']} · {space._count.members} {labels['staff.space_manage.members_count']} · {space._count.teams} {labels['staff.space_manage.teams_count']}</p><button type="button" onClick={()=>edit(space)} className="mt-12 rounded-md border border-border-line px-12 py-8 text-small font-semibold">{labels['staff.space_manage.edit_action']}</button></article>)}</div></section>
 </div>;
}
