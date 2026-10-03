'use client';

import { FormEvent, useMemo, useState } from 'react';

type Unit={id:string;name:string;project:{name:string}};
type Client={id:string;clientName:string;clientWhatsapp:string|null};

export default function AgentShortlistForm({
  units,clients,initialUnitId,
}:{units:Unit[];clients:Client[];initialUnitId:string}){
  const [selected,setSelected]=useState<string[]>(initialUnitId?[initialUnitId]:[]);
  const [query,setQuery]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [shareUrl,setShareUrl]=useState('');
  const [whatsapp,setWhatsapp]=useState('');
  const filtered=useMemo(()=>units.filter(u=>(u.project.name+' '+u.name).toLowerCase().includes(query.toLowerCase().trim())),[units,query]);

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError('');setShareUrl('');setWhatsapp('');
    const form=new FormData(event.currentTarget);
    const clientId=String(form.get('clientProtectionId')||'');
    const response=await fetch('/api/agent/shortlists',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
      title:String(form.get('title')||''),unitIds:selected,clientProtectionId:clientId||undefined,
      brandMode:String(form.get('brandMode')||'myuno'),notes:String(form.get('notes')||''),
    })});
    const data=await response.json();
    if(!response.ok){setError(data.error||'Shortlist failed');setBusy(false);return;}
    const share=await fetch('/api/agent/share-links',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({shortlistId:data.shortlist.id,brandMode:String(form.get('brandMode')||'myuno')})});
    const shareData=await share.json();
    if(!share.ok){setError(shareData.error||'Share link failed');setBusy(false);return;}
    const url=window.location.origin+shareData.path;
    setShareUrl(url);
    const client=clients.find(c=>c.id===clientId);
    const phone=(client?.clientWhatsapp||'').replace(/[^0-9]/g,'');
    const text=encodeURIComponent(String(form.get('title')||'Property shortlist')+'\n'+url);
    setWhatsapp('https://wa.me/'+phone+'?text='+text);
    setBusy(false);
  }

  return <form onSubmit={submit} className="space-y-16">
    <section className="grid gap-12 rounded-xl border border-border-line bg-surface-paper p-16 md:grid-cols-2">
      <label className="text-small font-semibold text-text-secondary">Title<input required name="title" defaultValue="Property shortlist" className="mt-4 h-44 w-full rounded-md border border-border-line px-12"/></label>
      <label className="text-small font-semibold text-text-secondary">Client<select name="clientProtectionId" className="mt-4 h-44 w-full rounded-md border border-border-line px-12"><option value="">No protected client</option>{clients.map(c=><option value={c.id} key={c.id}>{c.clientName}</option>)}</select></label>
      <label className="text-small font-semibold text-text-secondary">Brand<select name="brandMode" className="mt-4 h-44 w-full rounded-md border border-border-line px-12"><option value="myuno">myUNO</option><option value="cobranded">Co-branded</option><option value="agent">Agent branded</option><option value="neutral">Neutral</option></select></label>
      <label className="text-small font-semibold text-text-secondary">Notes<input name="notes" className="mt-4 h-44 w-full rounded-md border border-border-line px-12"/></label>
    </section>
    <section className="rounded-xl border border-border-line bg-surface-paper p-16">
      <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search inventory" className="h-44 w-full rounded-md border border-border-line px-12"/>
      <p className="mt-10 text-small text-text-secondary">{selected.length} selected</p>
      <div className="mt-10 max-h-[440px] space-y-6 overflow-auto">
        {filtered.map(u=><label key={u.id} className="flex items-center gap-10 rounded-md border border-border-line p-10"><input type="checkbox" checked={selected.includes(u.id)} onChange={e=>setSelected(prev=>e.target.checked?Array.from(new Set([...prev,u.id])):prev.filter(id=>id!==u.id))}/><span><strong>{u.project.name}</strong> · {u.name}</span></label>)}
      </div>
    </section>
    <button disabled={busy||!selected.length} className="rounded-md bg-brand-deep px-20 py-10 text-small font-semibold text-white">{busy?'Creating…':'Create & share'}</button>
    {error?<p role="alert" className="text-small text-red-700">{error}</p>:null}
    {shareUrl?<div className="rounded-lg bg-surface-paper p-16"><p className="break-all text-small text-text-secondary">{shareUrl}</p><a href={whatsapp} target="_blank" rel="noreferrer" className="mt-10 inline-flex rounded-md bg-brand-deep px-16 py-8 text-small font-semibold text-white">Share in WhatsApp</a></div>:null}
  </form>;
}
