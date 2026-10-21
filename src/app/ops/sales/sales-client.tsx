'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import type { GuestOption, StayInput } from '@/modules/sales-offers/contracts';
import { offerMoney, priceRows } from '@/modules/sales-offers/presentation';

type Result = GuestOption & { unitId: string };
export default function SalesDesk({ spaceId, labels, saved }: { spaceId: string; labels: Record<string,string>; saved: { id: string; version: number; createdAt: string }[] }) {
  const t = (k: string) => labels['sales.'+k];
  const [results,setResults] = useState<Result[] | null>(null), [selected,setSelected] = useState<Result[]>([]);
  const [busy,setBusy] = useState(false), [error,setError] = useState(''), [truncated,setTruncated] = useState(false);
  const [locale,setLocale] = useState('ru'), [expiry,setExpiry] = useState(''), [note,setNote] = useState('');
  const command = useRef<{ signature: string; id: string } | null>(null);
  const field = 'min-h-44 w-full rounded-lg border border-border-line bg-surface-paper p-8';
  async function search(form: HTMLFormElement) {
    setBusy(true); setError('');
    const fields = new FormData(form);
    const input = { spaceId, startDate: fields.get('start'), endDate: fields.get('end'),
      adults: Number(fields.get('adults')), children: Number(fields.get('children')), pets: Number(fields.get('pets')),
      bedrooms: Number(fields.get('bedrooms')), query: String(fields.get('query') || ''),
      ...(fields.get('budget') ? { budget: Math.round(Number(fields.get('budget'))*100) } : {}) };
    try {
      const res = await fetch('/api/ops/sales-offers/search',{ method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input) });
      if (!res.ok) throw new Error();
      const data = await res.json(); setResults(data.results); setTruncated(data.truncated);
    } catch { setError(t('error')); } finally { setBusy(false); }
  }
  async function save() {
    setBusy(true); setError('');
    try {
      const payload = { spaceId, selections: selected.map(o=>({unitId:o.unitId,stay:o.stay as StayInput})), locale, expiresAt:new Date(expiry).toISOString(), clientNote: note };
      const signature = JSON.stringify(payload);
      if (command.current?.signature !== signature) command.current = { signature, id: crypto.randomUUID() };
      const res = await fetch('/api/ops/sales-offers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,commandId:command.current!.id})});
      if (!res.ok) throw new Error();
      const data = await res.json(); window.location.assign('/ops/sales/'+encodeURIComponent(data.id));
    } catch { setError(t('error')); } finally { setBusy(false); }
  }
  const card = (o: Result) => <>
    <h3 className="font-semibold">{o.property} · {o.name}</h3>
    <p>{o.stay.startDate} → {o.stay.endDate}</p>
    <p>{t('adults')}: {o.stay.adults} · {t('children')}: {o.stay.children} · {t('actual_bedrooms')}: {o.bedrooms}</p>
    <p className="mt-8 text-small">{t(o.state)}</p>
    {o.price && <dl className="mt-8">{priceRows(o).map(([key,value])=><div key={key} className="flex justify-between gap-12"><dt>{t(key)}</dt><dd>{offerMoney(value,locale)}</dd></div>)}</dl>}
  </>;
  return <div className="space-y-24">
    <form onSubmit={e=>{e.preventDefault();void search(e.currentTarget);}} className="grid gap-12 rounded-lg border border-border-line bg-surface-paper p-16 sm:grid-cols-2 lg:grid-cols-4">
      {[['query','text'],['start','date'],['end','date'],['adults','number'],['children','number'],['pets','number'],['bedrooms','number'],['budget','number']].map(([k,type])=><label key={k} className="text-small">{t(k)}<input className={field} name={k} type={type} required={['start','end','adults'].includes(k)} min={k==='adults'?1:0} max={type==='number'?10000000:undefined} step={k==='budget'?'0.01':undefined} defaultValue={k==='adults'?2:['children','pets','bedrooms'].includes(k)?0:undefined}/></label>)}
      <button disabled={busy} className="min-h-44 rounded-lg bg-brand-andaman px-16 text-white">{busy?t('busy'):t('search')}</button>
    </form>
    {error&&<p role="alert">{error}</p>}
    {truncated&&<p role="status">{t('truncated')}</p>}
    {results?.length===0&&<p>{t('empty')}</p>}
    <div className="grid gap-24 lg:grid-cols-2">
      <section className="space-y-12">{results?.map(o=><article key={o.unitId} className="rounded-lg border border-border-line p-16">{card(o)}<button className="mt-12 min-h-44 text-brand-andaman" disabled={busy||selected.length>=4||selected.some(s=>s.unitId===o.unitId)} onClick={()=>setSelected(s=>[...s,o])}>{t('select')}</button></article>)}</section>
      <section className="space-y-16 rounded-lg bg-surface-paper p-16">
        <h2 className="font-display text-heading-2">{t('compare')}</h2>
        {selected.map(o=><article key={o.unitId} className="border-b border-border-line pb-12">{card(o)}<button className="min-h-44 text-brand-andaman" onClick={()=>setSelected(s=>s.filter(x=>x.unitId!==o.unitId))}>{t('remove')}</button></article>)}
        <label className="block">{t('locale')}<select className={field} value={locale} onChange={e=>setLocale(e.target.value)}>{['ru','en','th'].map(l=><option key={l} value={l}>{l.toUpperCase()}</option>)}</select></label>
        <label className="block">{t('expiry')}<input className={field} type="datetime-local" required value={expiry} onChange={e=>setExpiry(e.target.value)}/></label>
        <label className="block">{t('note')}<textarea className={field} maxLength={2000} value={note} onChange={e=>setNote(e.target.value)}/></label>
        <button disabled={busy||!selected.length||!expiry} className="min-h-44 rounded-lg bg-brand-andaman px-16 text-white" onClick={()=>void save()}>{busy?t('busy'):t('save')}</button>
      </section>
    </div>
    <section><h2 className="font-display text-heading-2">{t('history')}</h2>{saved.map(o=><p key={o.id} className="py-8"><Link href={'/ops/sales/'+o.id} className="text-brand-andaman">{t('version')} {o.version} · {o.createdAt}</Link></p>)}</section>
  </div>;
}
