'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

type UnitRow={id:string;name:string;project:{id:string;name:string}};
type Member={
  identityId:string;
  capabilities:string[];
  unitIds:string[];
  identity:{firstName:string;lastName:string;email:string|null;status:string};
};
type Team={
  id:string;name:string;teamType:string;
  members:Array<{identityId:string;identity:{firstName:string;lastName:string}}>;
};
type Payload={capabilities:string[];units:UnitRow[];members:Member[];teams:Team[]};

export default function OperatingSpaceAccessClient({spaceId,labels}:{spaceId:string;labels:Record<string,string>}){
  const[data,setData]=useState<Payload|null>(null);
  const[busy,setBusy]=useState(false);
  const[error,setError]=useState('');
  const[notice,setNotice]=useState('');
  const[email,setEmail]=useState('');
  const[selectedCaps,setSelectedCaps]=useState<string[]>([]);
  const[selectedUnits,setSelectedUnits]=useState<string[]>([]);
  const[teamName,setTeamName]=useState('');
  const[teamType,setTeamType]=useState('operations');

  const load=useCallback(async()=>{
    setError('');
    const response=await fetch(`/api/ops/spaces/${encodeURIComponent(spaceId)}/access`,{cache:'no-store'});
    const body=await response.json().catch(()=>null);
    if(!response.ok){setError(body?.error||labels['staff.space_access.error']);return;}
    setData(body as Payload);
  },[spaceId,labels]);
  useEffect(()=>{void load();},[load]);

  const allUnitIds=useMemo(()=>data?.units.map(unit=>unit.id)||[],[data]);
  const toggle=(list:string[],value:string,setter:(next:string[])=>void)=>
    setter(list.includes(value)?list.filter(item=>item!==value):[...list,value]);

  const saveMember=async(event:FormEvent)=>{
    event.preventDefault();setBusy(true);setError('');setNotice('');
    try{
      const response=await fetch(`/api/ops/spaces/${encodeURIComponent(spaceId)}/access`,{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({action:'upsert_member',email,capabilities:selectedCaps,unitIds:selectedUnits}),
      });
      const body=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(body?.error||labels['staff.space_access.error']);
      setEmail('');setSelectedCaps([]);setSelectedUnits([]);setNotice(labels['staff.space_access.saved']);await load();
    }catch(err){setError(err instanceof Error?err.message:labels['staff.space_access.error']);}
    finally{setBusy(false);}
  };

  const editMember=(member:Member)=>{
    setEmail(member.identity.email||'');
    setSelectedCaps(member.capabilities);
    setSelectedUnits(member.unitIds);
    window.scrollTo({top:0,behavior:'smooth'});
  };

  const removeMember=async(member:Member)=>{
    if(!window.confirm(labels['staff.space_access.remove_confirm']))return;
    setBusy(true);setError('');setNotice('');
    try{
      const response=await fetch(`/api/ops/spaces/${encodeURIComponent(spaceId)}/access`,{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({action:'remove_member',identityId:member.identityId}),
      });
      const body=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(body?.error||labels['staff.space_access.error']);
      setNotice(labels['staff.space_access.removed']);await load();
    }catch(err){setError(err instanceof Error?err.message:labels['staff.space_access.error']);}
    finally{setBusy(false);}
  };

  const createTeam=async(event:FormEvent)=>{
    event.preventDefault();setBusy(true);setError('');setNotice('');
    try{
      const response=await fetch(`/api/ops/spaces/${encodeURIComponent(spaceId)}/access`,{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({action:'create_team',name:teamName,teamType}),
      });
      const body=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(body?.error||labels['staff.space_access.error']);
      setTeamName('');setNotice(labels['staff.space_access.team_created']);await load();
    }catch(err){setError(err instanceof Error?err.message:labels['staff.space_access.error']);}
    finally{setBusy(false);}
  };

  const setTeamMembers=async(team:Team,identityId:string,checked:boolean)=>{
    const current=team.members.map(member=>member.identityId);
    const memberIdentityIds=checked?Array.from(new Set([...current,identityId])):current.filter(id=>id!==identityId);
    setBusy(true);setError('');setNotice('');
    try{
      const response=await fetch(`/api/ops/spaces/${encodeURIComponent(spaceId)}/access`,{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({action:'set_team_members',teamId:team.id,memberIdentityIds}),
      });
      const body=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(body?.error||labels['staff.space_access.error']);
      setNotice(labels['staff.space_access.team_saved']);await load();
    }catch(err){setError(err instanceof Error?err.message:labels['staff.space_access.error']);}
    finally{setBusy(false);}
  };

  if(!data&&!error)return <p className="text-body text-text-secondary">{labels['staff.space_access.loading']}</p>;

  return <div className="space-y-24">
    {error&&<div role="alert" className="rounded-md border border-red-300 bg-red-50 p-12 text-red-900">{error}</div>}
    {notice&&<div role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-12 text-emerald-900">{notice}</div>}

    <form onSubmit={saveMember} className="rounded-xl border border-border-line bg-surface-paper p-20">
      <h2 className="font-display text-heading-2 font-semibold">{labels['staff.space_access.member_title']}</h2>
      <p className="mt-4 text-small text-text-secondary">{labels['staff.space_access.member_hint']}</p>
      <label className="mt-16 block text-small font-semibold">{labels['staff.space_access.email']}
        <input type="email" required value={email} onChange={event=>setEmail(event.target.value)}
          className="mt-4 h-44 w-full max-w-xl rounded-md border border-border-line px-12"/>
      </label>

      <div className="mt-40 grid gap-20 xl:grid-cols-2">
        <section>
          <div className="flex items-center justify-between gap-8">
            <h3 className="font-semibold">{labels['staff.space_access.capabilities']}</h3>
            <button type="button" className="text-small text-brand-andaman underline"
              onClick={()=>setSelectedCaps(data?.capabilities||[])}>{labels['staff.space_access.select_all']}</button>
          </div>
          <div className="mt-8 grid gap-8 sm:grid-cols-2">
            {(data?.capabilities||[]).map(capability=><label key={capability} className="flex items-start gap-8 rounded-md bg-surface-ivory p-8 text-small">
              <input type="checkbox" checked={selectedCaps.includes(capability)}
                onChange={()=>toggle(selectedCaps,capability,setSelectedCaps)}/>
              <span>{capability.replace(/_/g,' ')}</span>
            </label>)}
          </div>
        </section>
        <section>
          <div className="flex items-center justify-between gap-8">
            <h3 className="font-semibold">{labels['staff.space_access.properties']}</h3>
            <button type="button" className="text-small text-brand-andaman underline"
              onClick={()=>setSelectedUnits(allUnitIds)}>{labels['staff.space_access.select_all']}</button>
          </div>
          <div className="mt-8 max-h-80 space-y-4 overflow-y-auto">
            {(data?.units||[]).map(unit=><label key={unit.id} className="flex items-start gap-8 rounded-md bg-surface-ivory p-8 text-small">
              <input type="checkbox" checked={selectedUnits.includes(unit.id)}
                onChange={()=>toggle(selectedUnits,unit.id,setSelectedUnits)}/>
              <span><strong>{unit.name}</strong><span className="block text-text-secondary">{unit.project.name}</span></span>
            </label>)}
          </div>
        </section>
      </div>
      <button disabled={busy||!email||!selectedUnits.length} className="mt-40 rounded-md bg-brand-deep px-16 py-8 text-small font-semibold text-white disabled:opacity-50">
        {busy?labels['staff.space_access.saving']:labels['staff.space_access.save_member']}
      </button>
    </form>

    <section className="rounded-xl border border-border-line bg-surface-paper p-20">
      <h2 className="font-display text-heading-2 font-semibold">{labels['staff.space_access.members']}</h2>
      {!data?.members.length?<p className="mt-12 text-text-secondary">{labels['staff.space_access.members_empty']}</p>:
      <div className="mt-12 space-y-8">{data.members.map(member=><article key={member.identityId} className="rounded-lg bg-surface-ivory p-12">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div><p className="font-semibold">{member.identity.firstName} {member.identity.lastName}</p>
            <p className="text-small text-text-secondary">{member.identity.email||'—'} · {member.unitIds.length} {labels['staff.space_access.properties_count']}</p>
            <p className="mt-4 text-caption text-text-secondary">{member.capabilities.map(value=>value.replace(/_/g,' ')).join(' · ')||labels['staff.space_access.no_capabilities']}</p>
          </div>
          <div className="flex gap-8">
            <button type="button" onClick={()=>editMember(member)} className="rounded-md border border-border-line px-12 py-8 text-small font-semibold">{labels['staff.space_access.edit']}</button>
            <button type="button" disabled={busy} onClick={()=>void removeMember(member)} className="rounded-md border border-red-200 px-12 py-8 text-small font-semibold text-red-800">{labels['staff.space_access.remove']}</button>
          </div>
        </div>
      </article>)}</div>}
    </section>

    <section className="rounded-xl border border-border-line bg-surface-paper p-20">
      <h2 className="font-display text-heading-2 font-semibold">{labels['staff.space_access.teams']}</h2>
      <form onSubmit={createTeam} className="mt-12 flex flex-wrap gap-8">
        <input required value={teamName} onChange={event=>setTeamName(event.target.value)} placeholder={labels['staff.space_access.team_name']}
          className="h-40 min-w-64 flex-1 rounded-md border border-border-line px-12"/>
        <select value={teamType} onChange={event=>setTeamType(event.target.value)} className="h-40 rounded-md border border-border-line px-12">
          {['operations','front_desk','housekeeping','maintenance','guest_care','reservations'].map(value=><option key={value} value={value}>{value.replace(/_/g,' ')}</option>)}
        </select>
        <button disabled={busy} className="rounded-md bg-brand-deep px-16 py-8 text-small font-semibold text-white">{labels['staff.space_access.create_team']}</button>
      </form>
      <div className="mt-16 grid gap-12 lg:grid-cols-2">{(data?.teams||[]).map(team=><article key={team.id} className="rounded-lg bg-surface-ivory p-12">
        <p className="font-semibold">{team.name}</p><p className="text-small text-text-secondary">{team.teamType.replace(/_/g,' ')}</p>
        <div className="mt-8 space-y-4">{(data?.members||[]).map(member=><label key={member.identityId} className="flex items-center gap-8 text-small">
          <input type="checkbox" disabled={busy} checked={team.members.some(item=>item.identityId===member.identityId)}
            onChange={event=>void setTeamMembers(team,member.identityId,event.target.checked)}/>
          <span>{member.identity.firstName} {member.identity.lastName}</span>
        </label>)}</div>
      </article>)}</div>
    </section>
  </div>;
}
