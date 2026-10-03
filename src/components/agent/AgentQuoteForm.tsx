'use client';

import { FormEvent, useState } from 'react';

type Props={
  unit:{id:string;name:string;maxGuests:number;project:{name:string}};
  clients:Array<{id:string;clientName:string;clientWhatsapp:string|null}>;
  labels:Record<string,string>;
};

export default function AgentQuoteForm({unit,clients,labels}:Props){
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
      <label className="text-small font-semibold text-text-secondary">{labels['agent.common.client']}<select name="clientProtectionId" className="mt-4 h-44 w-full rounded-md border border-border-line px-12"><option value="">{labels['agent.common.no_client']}</option>{clients.map(c=><option key={c.id} value={c.id}>{c.clientName}</option>)}</select></label>
      <label className="text-small font-semibold text-text-secondary">{labels['agent.common.brand']}<select name="brandMode" className="mt-4 h-44 w-full rounded-md border border-border-line px-12"><option value="myuno">{labels['agent.common.brand.myuno']}</option><option value="cobranded">{labels['agent.common.brand.cobranded']}</option><option value="agent">{labels['agent.common.brand.agent']}</option><option value="neutral">{labels['agent.common.brand.neutral']}</option></select></label>
      <label className="text-small font-semibold text-text-secondary">{labels['agent.quote.checkin']}<input required name="startDate" type="date" className="mt-4 h-44 w-full rounded-md border border-border-line px-12"/></label>
      <label className="text-small font-semibold text-text-secondary">{labels['agent.quote.checkout']}<input required name="endDate" type="date" className="mt-4 h-44 w-full rounded-md border border-border-line px-12"/></label>
      <label className="text-small font-semibold text-text-secondary">{labels['agent.quote.adults']}<input name="adults" type="number" min="1" max={unit.maxGuests} defaultValue="2" className="mt-4 h-44 w-full rounded-md border border-border-line px-12"/></label>
      <label className="text-small font-semibold text-text-secondary">{labels['agent.quote.children']}<input name="children" type="number" min="0" defaultValue="0" className="mt-4 h-44 w-full rounded-md border border-border-line px-12"/></label>
      <label className="text-small font-semibold text-text-secondary">{labels['agent.quote.markup']}<input name="markupThb" type="number" min="0" defaultValue="0" className="mt-4 h-44 w-full rounded-md border border-border-line px-12"/></label>
      <label className="text-small font-semibold text-text-secondary">{labels['agent.quote.discount']}<input name="discountThb" type="number" min="0" defaultValue="0" className="mt-4 h-44 w-full rounded-md border border-border-line px-12"/></label>
      <label className="text-small font-semibold text-text-secondary">{labels['agent.quote.commission']}<input name="commissionPct" type="number" min="0" step="0.1" defaultValue="10" className="mt-4 h-44 w-full rounded-md border border-border-line px-12"/></label>
      <label className="text-small font-semibold text-text-secondary">{labels['agent.quote.valid_hours']}<input name="validHours" type="number" min="1" max="168" defaultValue="24" className="mt-4 h-44 w-full rounded-md border border-border-line px-12"/></label>
    </div>
    <textarea name="publicNote" placeholder={labels['agent.quote.public_note']} className="min-h-24 w-full rounded-md border border-border-line p-12"/>
    <button disabled={busy} className="rounded-md bg-brand-deep px-20 py-10 text-small font-semibold text-white">{busy?labels['agent.quote.creating']:labels['agent.quote.create_share']}</button>
    {error?<p role="alert" className="text-small text-red-700">{error}</p>:null}
    {shareUrl?<div className="rounded-lg bg-surface-ivory p-16"><p className="break-all text-small text-text-secondary">{shareUrl}</p><a href={whatsapp} target="_blank" rel="noreferrer" className="mt-10 inline-flex rounded-md bg-brand-deep px-16 py-8 text-small font-semibold text-white">{labels['agent.common.whatsapp_share']}</a></div>:null}
  </form>;
}
