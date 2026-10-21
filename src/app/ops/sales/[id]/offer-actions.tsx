'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import type { GuestOffer, GuestOption } from '@/modules/sales-offers/contracts';
export default function OfferActions({ id, spaceId, guestOffer, options, guests, labels, valid, shares: initialShares }: {
  id:string;spaceId:string;guestOffer:GuestOffer;options:{id:string;unitId:string;snapshot:GuestOption}[];
  guests:{id:string;name:string}[];labels:Record<string,string>;valid:boolean;shares:{id:string;expiresAt:string;revoked:boolean}[];
}) {
  const t = (k:string)=>labels['sales.'+k];
  const [busy,setBusy]=useState(false),[status,setStatus]=useState(''),[guest,setGuest]=useState(''),[option,setOption]=useState(options[0]?.id??'');
  const [expires,setExpires]=useState(()=>{const d=new Date(guestOffer.expiresAt);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);});
  const [link,setLink]=useState(''),[shares,setShares]=useState(initialShares);
  const revisionCommand=useRef<{expiry:string;id:string}|null>(null);
  async function share() {
    setBusy(true);setStatus('');setLink('');
    try{const res=await fetch(`/api/ops/sales-offers/${id}/shares`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expiresAt:new Date(expires).toISOString()})});
      if(!res.ok)throw new Error();const data=await res.json();setLink(window.location.origin+'/proposal#'+data.token);setShares(s=>[...s,{id:data.id,expiresAt:data.expiresAt,revoked:false}]);
    }catch{setStatus(t('error'));}finally{setBusy(false);}
  }
  async function revoke(shareId:string) {
    setBusy(true);setStatus('');
    try{const res=await fetch(`/api/ops/sales-offers/${id}/shares`,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({shareId})});if(!res.ok)throw new Error();setLink('');setShares(s=>s.map(x=>x.id===shareId?{...x,revoked:true}:x));}
    catch{setStatus(t('error'));}finally{setBusy(false);}
  }
  async function revise() {
    setBusy(true);setStatus('');
    try {
      if(revisionCommand.current?.expiry!==expires)revisionCommand.current={expiry:expires,id:crypto.randomUUID()};
      const res=await fetch('/api/ops/sales-offers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        commandId:revisionCommand.current!.id,spaceId,previousId:id,selections:options.map(o=>({unitId:o.unitId,stay:o.snapshot.stay})),
        locale:guestOffer.locale,expiresAt:new Date(expires).toISOString(),clientNote:guestOffer.clientNote,
      })});
      if(!res.ok)throw new Error();const data=await res.json();window.location.assign('/ops/sales/'+data.id);
    }catch{setStatus(t('error'));}finally{setBusy(false);}
  }
  async function request() {
    setBusy(true);setStatus('');
    try {
      const res=await fetch(`/api/ops/sales-offers/${id}/request`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({optionId:option,guestId:guest})});
      if(!res.ok)throw new Error();setStatus(t('requested'));
    }catch{setStatus(t('error'));}finally{setBusy(false);}
  }
  return <section className="space-y-16 rounded-lg border border-border-line bg-surface-paper p-16">
    {!valid&&<p role="alert">{t('stale')}</p>}
    <label className="block">{t('expiry')}<input className="min-h-44 w-full rounded-lg border border-border-line p-8" type="datetime-local" value={expires} onChange={e=>setExpires(e.target.value)}/></label>
    <div className="flex flex-wrap gap-16"><Link href={`/sales-preview/${id}`} className="min-h-44 py-12 text-brand-andaman">{t('preview')}</Link>
      <button disabled={busy} className="min-h-44 text-brand-andaman" onClick={()=>void revise()}>{t('revise')}</button></div>
    <button disabled={busy||!valid} className="min-h-44 rounded-lg border border-border-line px-16" onClick={()=>void share()}>{t('share')}</button>
    {link&&<label className="block">{t('share_link')}<input readOnly value={link} className="min-h-44 w-full rounded-lg border border-border-line p-8" onFocus={e=>e.currentTarget.select()}/></label>}
    {shares.map(s=><div key={s.id} className="flex flex-wrap items-center gap-12"><span>{s.expiresAt}</span><button disabled={busy||s.revoked} className="min-h-44 text-brand-andaman" onClick={()=>void revoke(s.id)}>{t(s.revoked?'revoked':'revoke')}</button></div>)}
    <label className="block">{t('compare')}<select className="min-h-44 w-full rounded-lg border border-border-line p-8" value={option} onChange={e=>setOption(e.target.value)}>{options.map(o=><option key={o.id} value={o.id}>{o.snapshot.property} · {o.snapshot.name}</option>)}</select></label>
    <label className="block">{t('guest')}<select className="min-h-44 w-full rounded-lg border border-border-line p-8" value={guest} onChange={e=>setGuest(e.target.value)}><option value="">{t('select')}</option>{guests.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
    <button disabled={busy||!valid||!guest||!option} className="min-h-44 rounded-lg bg-brand-andaman px-16 text-white" onClick={()=>void request()}>{busy?t('busy'):t('request')}</button>
    <p>{t('disclaimer')}</p>{status&&<p role="status">{status}</p>}
    <Link className="block text-brand-andaman" href={'/ops/reservations?spaceId='+encodeURIComponent(spaceId)}>{t('back')}</Link>
  </section>;
}
