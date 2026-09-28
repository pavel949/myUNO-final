'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Mode = 'stay' | 'monthly' | 'buy' | 'invest';

export function DiscoverySearch({ labels }: { labels: {
  stay: string; monthly: string; buy: string; invest: string; checkIn: string;
  checkOut: string; adults: string; children: string; explore: string; properties: string;
  hint: string; error: string;
} }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('stay');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [error, setError] = useState('');
  const today = new Date().toLocaleDateString('en-CA');
  const options: { id: Mode; title: string }[] = [
    { id: 'stay', title: labels.stay }, { id: 'monthly', title: labels.monthly },
    { id: 'buy', title: labels.buy }, { id: 'invest', title: labels.invest },
  ];
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    if (mode === 'buy') { router.push('/projects'); return; }
    if (mode === 'invest') { router.push('/buyers'); return; }
    if (!startDate || !endDate || endDate <= startDate) { setError(labels.error); return; }
    const params = new URLSearchParams({ startDate, endDate, adults: String(adults), children: String(children) });
    router.push('/search?' + params.toString());
  }
  return (
    <form onSubmit={submit} className="rounded-2xl bg-surface-paper p-16 md:p-20 text-text-ink shadow-2xl" aria-label={labels.explore}>
      <div className="flex gap-8 overflow-x-auto pb-12" role="group" aria-label={labels.explore}>
        {options.map(item => <button key={item.id} type="button" onClick={() => { setMode(item.id); setError(''); }}
          aria-pressed={mode === item.id}
          className={`shrink-0 rounded-full px-16 py-10 text-small font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-andaman ${mode === item.id ? 'bg-brand-andaman text-white' : 'bg-surface-ivory text-text-ink hover:bg-brand-andaman/10'}`}>{item.title}</button>)}
      </div>
      {(mode === 'stay' || mode === 'monthly') ? (
        <div className="grid grid-cols-2 md:grid-cols-[1fr_1fr_0.65fr_0.65fr_auto] gap-10 items-end">
          <label className="grid gap-6 text-small text-text-secondary">{labels.checkIn}<input className="min-w-0 w-full h-48 rounded-lg border border-border-line bg-white px-8 text-text-ink" type="date" required min={today} value={startDate} onChange={e=>setStartDate(e.target.value)}/></label>
          <label className="grid gap-6 text-small text-text-secondary">{labels.checkOut}<input className="min-w-0 w-full h-48 rounded-lg border border-border-line bg-white px-8 text-text-ink" type="date" required min={startDate || today} value={endDate} onChange={e=>setEndDate(e.target.value)}/></label>
          <label className="grid gap-6 text-small text-text-secondary">{labels.adults}<input className="w-full h-48 rounded-lg border border-border-line bg-white px-8 text-text-ink" type="number" min="1" max="20" value={adults} onChange={e=>setAdults(Number(e.target.value))}/></label>
          <label className="grid gap-6 text-small text-text-secondary">{labels.children}<input className="w-full h-48 rounded-lg border border-border-line bg-white px-8 text-text-ink" type="number" min="0" max="20" value={children} onChange={e=>setChildren(Number(e.target.value))}/></label>
          <button className="col-span-2 md:col-span-1 h-48 rounded-lg bg-brand-andaman px-20 font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-andaman" type="submit">{labels.explore} →</button>
        </div>
      ) : <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-12 py-12"><p className="text-body text-text-secondary">{labels.hint}</p><button type="submit" className="w-full md:w-auto rounded-lg bg-brand-andaman px-24 py-14 font-semibold text-white">{labels.properties} →</button></div>}
      {error && <p role="alert" className="mt-8 text-small text-state-error">{error}</p>}
    </form>
  );
}
