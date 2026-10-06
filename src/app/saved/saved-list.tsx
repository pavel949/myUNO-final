'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { MoneyAmount } from '@/components/MoneyAmount';

type Entry = {
  id: string;
  note: string | null;
  collection: string | null;
  unit: {
    id: string;
    name: string;
    baseNightlyThb: number;
    inventoryCategory: { baseNightlyThb: number } | null;
    coverMedia: { storageKey: string } | null;
  };
};

export default function SavedList({ entries, labels }: {
  entries: Entry[];
  labels: { emptyTitle: string; emptyHint: string; searchButton: string; perNight: string; remove: string; removing: string; removeFailed: string; defaultList: string };
}) {
  const [items, setItems] = useState(entries);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(id: string) {
    if (busyId) return;
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch(`/api/saved/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(labels.removeFailed);
      setItems(previous => previous.filter(item => item.id !== id));
    } catch {
      setError(labels.removeFailed);
    } finally {
      setBusyId(null);
    }
  }

  if (!items.length) return (
    <div className="stitch-panel p-32 text-center">
      <p className="text-body text-text-ink mb-16">{labels.emptyTitle}</p>
      <p className="text-small text-text-secondary mb-24">{labels.emptyHint}</p>
      <Link href="/search" className="inline-flex items-center justify-center h-48 px-24 bg-brand-andaman text-surface-ivory rounded-sm font-semibold hover:opacity-90 transition">
        {labels.searchButton}
      </Link>
    </div>
  );

  return <>
    {error && <p role="alert" className="mb-16 rounded-lg bg-state-error-soft p-12 text-state-error">{error}</p>}
    <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-24">
      {items.map(entry => {
        const nightly = entry.unit.inventoryCategory?.baseNightlyThb ?? entry.unit.baseNightlyThb;
        return <li key={entry.id} className="stitch-panel overflow-hidden">
          <Link href={`/units/${entry.unit.id}`} className="block hover:shadow-card transition-shadow">
            {entry.unit.coverMedia ? <Image src={entry.unit.coverMedia.storageKey} alt={entry.unit.name} width={640} height={360} className="aspect-video w-full object-cover" /> : <div className="aspect-video bg-gradient-to-br from-brand-andaman to-brand-andaman-dark" />}
            <div className="p-16 pb-8">
              <h2 className="text-subtitle font-semibold text-text-ink mb-8">{entry.unit.name}</h2>
              <p className="text-title text-brand-andaman"><MoneyAmount satang={nightly} className="font-semibold" /> {labels.perNight}</p>
              <p className="text-small text-text-secondary mt-8">{entry.collection || labels.defaultList}</p>
              {entry.note && <p className="text-small text-text-secondary mt-8 italic">{entry.note}</p>}
            </div>
          </Link>
          <div className="p-16 pt-8">
            <button type="button" disabled={busyId !== null} onClick={() => remove(entry.id)}
              className="min-h-44 rounded-sm border border-border-line px-16 text-small font-semibold text-text-ink hover:border-brand-andaman disabled:opacity-50"
              aria-label={`${labels.remove}: ${entry.unit.name}`}>
              {busyId === entry.id ? labels.removing : labels.remove}
            </button>
          </div>
        </li>;
      })}
    </ul>
  </>;
}
