'use client';

import { useState } from 'react';

type Row = {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  mapVisibility: boolean;
  googlePlaceId: string | null;
  status?: string;
};

function LocationRow({
  kind,
  initial,
  labels,
}: {
  kind: 'project' | 'provider';
  initial: Row;
  labels: Record<string, string>;
}) {
  const [row, setRow] = useState(initial);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const save = async () => {
    setState('saving');
    const response = await fetch('/api/admin/map/entities', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, ...row }),
    });
    setState(response.ok ? 'saved' : 'error');
  };

  return (
    <div className="grid gap-10 border-b border-border-line py-16 last:border-b-0 xl:grid-cols-[1.3fr_1.8fr_140px_140px_1.3fr_auto_auto] xl:items-end">
      <div>
        <p className="font-semibold text-text-ink">{row.name}</p>
        {row.status && <p className="text-small text-text-secondary">{row.status}</p>}
      </div>
      <label className="text-small text-text-secondary">
        {labels['admin.map.address']}
        <input
          value={row.address || ''}
          onChange={(event) => setRow({ ...row, address: event.target.value })}
          className="mt-4 h-40 w-full rounded-sm border border-border-line bg-surface-paper px-10 text-text-ink"
        />
      </label>
      <label className="text-small text-text-secondary">
        {labels['admin.map.latitude']}
        <input
          type="number"
          step="0.000001"
          value={row.latitude ?? ''}
          onChange={(event) =>
            setRow({ ...row, latitude: event.target.value === '' ? null : Number(event.target.value) })
          }
          className="mt-4 h-40 w-full rounded-sm border border-border-line bg-surface-paper px-10 text-text-ink"
        />
      </label>
      <label className="text-small text-text-secondary">
        {labels['admin.map.longitude']}
        <input
          type="number"
          step="0.000001"
          value={row.longitude ?? ''}
          onChange={(event) =>
            setRow({ ...row, longitude: event.target.value === '' ? null : Number(event.target.value) })
          }
          className="mt-4 h-40 w-full rounded-sm border border-border-line bg-surface-paper px-10 text-text-ink"
        />
      </label>
      <label className="text-small text-text-secondary">
        {labels['admin.map.google_place_id']}
        <input
          value={row.googlePlaceId || ''}
          onChange={(event) => setRow({ ...row, googlePlaceId: event.target.value })}
          className="mt-4 h-40 w-full rounded-sm border border-border-line bg-surface-paper px-10 text-text-ink"
        />
      </label>
      <label className="flex h-40 items-center gap-8 text-small text-text-ink">
        <input
          type="checkbox"
          checked={row.mapVisibility}
          onChange={(event) => setRow({ ...row, mapVisibility: event.target.checked })}
        />
        {labels['admin.map.visible']}
      </label>
      <div className="flex items-center gap-8">
        <button
          type="button"
          onClick={save}
          disabled={state === 'saving'}
          className="h-40 rounded-sm bg-brand-andaman px-14 text-small font-semibold text-on-dark-text disabled:opacity-50"
        >
          {labels['admin.map.save']}
        </button>
        {state === 'saved' && (
          <span className="text-small text-state-success">{labels['admin.map.saved']}</span>
        )}
        {state === 'error' && (
          <span className="text-small text-state-error">{labels['admin.map.error']}</span>
        )}
      </div>
    </div>
  );
}

export default function MapAdminClient({
  projects,
  providers,
  labels,
}: {
  projects: Row[];
  providers: Row[];
  labels: Record<string, string>;
}) {
  return (
    <div>
      <h1 className="font-display text-display-xl font-semibold text-text-ink">
        {labels['admin.map.title']}
      </h1>
      <p className="mt-8 max-w-4xl text-body text-text-secondary">{labels['admin.map.subtitle']}</p>

      <section className="mt-24 rounded-lg border border-border-line bg-surface-paper p-20">
        <h2 className="text-title font-semibold text-text-ink">{labels['admin.map.projects']}</h2>
        <div className="mt-10">
          {projects.map((row) => (
            <LocationRow key={row.id} kind="project" initial={row} labels={labels} />
          ))}
        </div>
      </section>

      <section className="mt-24 rounded-lg border border-border-line bg-surface-paper p-20">
        <h2 className="text-title font-semibold text-text-ink">{labels['admin.map.providers']}</h2>
        <div className="mt-10">
          {providers.map((row) => (
            <LocationRow key={row.id} kind="provider" initial={row} labels={labels} />
          ))}
        </div>
      </section>
    </div>
  );
}
