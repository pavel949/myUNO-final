'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AgentClientProtectionForm() {
  const router=useRouter();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    setBusy(true);setError('');
    const form=new FormData(event.currentTarget);
    const response=await fetch('/api/agent/clients',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        clientName:String(form.get('clientName')||''),
        clientWhatsapp:String(form.get('clientWhatsapp')||''),
        clientPhone:String(form.get('clientPhone')||''),
        transactionScope:String(form.get('transactionScope')||'all'),
        protectionDays:Number(form.get('protectionDays')||90),
      }),
    });
    const data=await response.json();
    if(!response.ok){setError(data.error||'Request failed');setBusy(false);return;}
    event.currentTarget.reset();
    setBusy(false);
    router.refresh();
  }
  return <form onSubmit={submit} className="grid gap-10 rounded-xl border border-border-line bg-surface-paper p-16 md:grid-cols-5">
    <input required name="clientName" placeholder="Client name" className="h-44 rounded-md border border-border-line px-12"/>
    <input name="clientWhatsapp" placeholder="WhatsApp" className="h-44 rounded-md border border-border-line px-12"/>
    <input name="clientPhone" placeholder="Phone" className="h-44 rounded-md border border-border-line px-12"/>
    <select name="transactionScope" className="h-44 rounded-md border border-border-line px-12">
      <option value="all">All</option><option value="stay">Stay</option><option value="long_rent">Long rent</option><option value="buy">Buy</option>
    </select>
    <div className="flex gap-8"><input name="protectionDays" type="number" min="1" max="365" defaultValue="90" className="h-44 w-24 rounded-md border border-border-line px-8"/>
      <button disabled={busy} className="h-44 flex-1 rounded-md bg-brand-deep px-12 text-small font-semibold text-white">Protect</button></div>
    {error?<p role="alert" className="md:col-span-5 text-small text-red-700">{error}</p>:null}
  </form>;
}
