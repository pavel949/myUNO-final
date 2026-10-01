'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Mode = 'stay' | 'monthly' | 'buy' | 'invest';

export interface DiscoveryProjectOption {
  id: string;
  name: string;
}

export function DiscoverySearch({
  labels,
  projects = [],
}: {
  labels: {
    stay: string;
    monthly: string;
    buy: string;
    invest: string;
    where: string;
    allPhuket: string;
    checkIn: string;
    checkOut: string;
    adults: string;
    children: string;
    explore: string;
    properties: string;
    hint: string;
    error: string;
  };
  projects?: DiscoveryProjectOption[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('stay');
  const [projectId, setProjectId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [error, setError] = useState('');
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });

  const options: { id: Mode; title: string }[] = [
    { id: 'stay', title: labels.stay },
    { id: 'monthly', title: labels.monthly },
    { id: 'buy', title: labels.buy },
    { id: 'invest', title: labels.invest },
  ];

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');

    if (mode === 'buy') {
      router.push('/homes?intent=buy');
      return;
    }
    if (mode === 'monthly') {
      router.push('/homes?intent=rent');
      return;
    }
    if (mode === 'invest') {
      router.push('/buyers');
      return;
    }
    if (!startDate || !endDate || endDate <= startDate) {
      setError(labels.error);
      return;
    }

    const params = new URLSearchParams({
      startDate,
      endDate,
      adults: String(adults),
      children: String(children),
      ...(projectId ? { projectId } : {}),
    });
    router.push('/search?' + params.toString());
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-white/10 bg-surface-paper p-12 text-text-ink shadow-float md:p-16"
      aria-label={labels.explore}
    >
      <div className="mb-12 flex gap-4 overflow-x-auto" role="group" aria-label={labels.explore}>
        {options.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setMode(item.id);
              setError('');
            }}
            aria-pressed={mode === item.id}
            className={`shrink-0 rounded-full px-16 py-12 text-small font-semibold transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-andaman ${
              mode === item.id
                ? 'bg-brand-andaman text-white'
                : 'text-text-secondary hover:bg-surface-ivory hover:text-text-ink'
            }`}
          >
            {item.title}
          </button>
        ))}
      </div>

      {mode === 'stay' ? (
        <div className="grid grid-cols-2 gap-8 md:grid-cols-[1.35fr_1fr_1fr_.65fr_.65fr_auto] md:items-end">
          <label className="col-span-2 grid gap-8 text-small text-text-secondary md:col-span-1">
            {labels.where}
            <select
              className="h-48 min-w-0 rounded-lg border border-border-line bg-white px-12 text-text-ink"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">{labels.allPhuket}</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-8 text-small text-text-secondary">
            {labels.checkIn}
            <input
              className="h-48 min-w-0 w-full rounded-lg border border-border-line bg-white px-12 text-text-ink"
              type="date"
              required
              min={today}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>

          <label className="grid gap-8 text-small text-text-secondary">
            {labels.checkOut}
            <input
              className="h-48 min-w-0 w-full rounded-lg border border-border-line bg-white px-12 text-text-ink"
              type="date"
              required
              min={startDate || today}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>

          <label className="grid gap-8 text-small text-text-secondary">
            {labels.adults}
            <input
              className="h-48 w-full rounded-lg border border-border-line bg-white px-12 text-text-ink"
              type="number"
              min="1"
              max="20"
              value={adults}
              onChange={(e) => setAdults(Number(e.target.value))}
            />
          </label>

          <label className="grid gap-8 text-small text-text-secondary">
            {labels.children}
            <input
              className="h-48 w-full rounded-lg border border-border-line bg-white px-12 text-text-ink"
              type="number"
              min="0"
              max="20"
              value={children}
              onChange={(e) => setChildren(Number(e.target.value))}
            />
          </label>

          <button
            className="col-span-2 h-48 rounded-lg bg-brand-andaman px-24 font-semibold text-white transition-colors duration-micro hover:bg-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-andaman md:col-span-1"
            type="submit"
          >
            {labels.explore} →
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-start justify-between gap-16 rounded-xl bg-surface-ivory px-16 py-16 md:flex-row md:items-center">
          <p className="max-w-2xl text-body text-text-secondary">{labels.hint}</p>
          <button
            type="submit"
            className="h-48 w-full shrink-0 rounded-lg bg-brand-andaman px-24 font-semibold text-white transition-colors duration-micro hover:bg-brand-deep md:w-auto"
          >
            {labels.properties} →
          </button>
        </div>
      )}

      {error ? <p role="alert" className="mt-8 text-small text-state-error">{error}</p> : null}
    </form>
  );
}
