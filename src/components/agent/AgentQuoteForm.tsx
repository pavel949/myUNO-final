'use client';

import { FormEvent, useState } from 'react';

type Props={
  unit:{id:string;name:string;maxGuests:number;project:{name:string}};
  clients:Array<{id:string;clientName:string;clientWhatsapp:string|null}>;
};

export default function AgentQuoteForm({unit,clients}:Props){
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [shareUrl,setShareUrl]=useState('');
  const [whatsapp,setWhatsapp]=useState('');

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError('');setShareUrl('');setWhatsapp('');
    const form=new FormData(event.currentTarget);
    const clientId=String(form.get('clientProtectionId')||'');
    const response=await fetch('/api/agent/quotes',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
      unitId:unit.id,startDate:String(form.get('startDate')||''),endDate:String(form.get('endDate')||''),
      adults:Number(form.get('adults')||1),children:Number(form.get('children')||0),
      markupThb:Number(form.get('markupThb')||0),discountThb:Number(form.get('discountThb')||0),
      commissionPct:Number(form.get('commissionPct')||10),clientProtectionId:clientId||undefined,
      validHours:Number(form.get('validHours')||24),publicNote:String(form.get('publicNote')||''),
    })});
    const data=await response.json();
    if(!response.ok){setError(data.error||'Quote failed');setBusy(false);return;}
    const share=await fetch('/api/agent/share-links',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({quoteId:data.quote.id,brandMode:String(form.get('brandMode')||'myuno')})});
    const shareData=await share.json();
    if(!share.ok){setError(shareData.error||'Share link failed');setBusy(false);return;}
    const url=window.location.origin+shareData.path;
    setShareUrl(url);
    const client=clients.find(c=>c.id===clientId);
    const text=encodeURIComponent(unit.project.name+' · '+unit.name+'\n'+url);
    const phone=(client?.clientWhatsapp||'').replace(/[^0-9]/g,'');
    setWhatsapp('https://wa.me/'+phone+'?text='+text);
    setBusy(false);
  }

  return <form onSubmit={submit} className="space-y-16 rounded-xl border border-border-line bg-surface-paper p-20">
    <div className="grid gap-12 md:grid-cols-2">
      <label className="text-small font-semibold text-text-secondary">Client<select name="clientProtectionId" className="mt-4 h-44 w-full rounded-md border border-border-line px-12"><option value="">No protected client</option>{clients.map(c=><option key={c.id} value={c.id}>{c.clientName}</option>)}</select></label>
      <label className="text-small font-semibold text-text-secondary">Brand<select name="brandMode" className="mt-4 h-44 w-full rounded-md border border-border-line px-12"><option value="myuno">myUNO</option><option value="cobranded">Co-branded</option><option value="agent">Agent branded</option><option value="neutral">Neutral</option></select></label>
      <label className="text-small font-semibold text-text-secondary">Check-in<input required name="startDate" type="date" className="mt-4 h-44 w-full rounded-md border border-border-line px-12"/></label>
      <label className="text-small font-semibold text-text-secondary">Check-out<input required name="endDate" type="date" className="mt-4 h-44 w-full rounded-md border border-border-line px-12"/></label>
      <label className="text-small font-semibold text-text-secondary">Adults<input name="adults" type="number" min="1" max={unit.maxGuests} defaultValue="2" className="mt-4 h-44 w-full rounded-md border border-border-line px-12"/></label>
      <label className="text-small font-semibold text-text-secondary">Children<input name="children" type="number" min="0" defaultValue="0" className="mt-4 h-44 w-full rounded-md border border-border-line px-12"/></label>
      <label className="text-small font-semibold text-text-secondary">Markup THB<input name="markupThb" type="number" min="0" defaultValue="0" className="mt-4 h-44 w-full rounded-md border border-border-line px-12"/></label>
      <label className="text-small font-semibold text-text-secondary">Discount THB<input name="discountThb" type="number" min="0" defaultValue="0" className="mt-4 h-44 w-full rounded-md border border-border-line px-12"/></label>
      <label className="text-small font-semibold text-text-secondary">Commission %<input name="commissionPct" type="number" min="0" step="0.1" defaultValue="10" className="mt-4 h-44 w-full rounded-md border border-border-line px-12"/></label>
      <label className="text-small font-semibold text-text-secondary">Valid hours<input name="validHours" type="number" min="1" max="168" defaultValue="24" className="mt-4 h-44 w-full rounded-md border border-border-line px-12"/></label>
    </div>
    <textarea name="publicNote" placeholder="Client note" className="min-h-24 w-full rounded-md border border-border-line p-12"/>
    <button disabled={busy} className="rounded-md bg-brand-deep px-20 py-10 text-small font-semibold text-white">{busy?'Creating…':'Create & share'}</button>
    {error?<p role="alert" className="text-small text-red-700">{error}</p>:null}
    {shareUrl?<div className="rounded-lg bg-surface-ivory p-16"><p className="break-all text-small text-text-secondary">{shareUrl}</p><a href={whatsapp} target="_blank" rel="noreferrer" className="mt-10 inline-flex rounded-md bg-brand-deep px-16 py-8 text-small font-semibold text-white">Share in WhatsApp</a></div>:null}
  </form>;
}
