/* eslint-disable local-rules/no-literal-ui-text */
'use client';

import { FormEvent, useMemo, useState } from 'react';

type Placement = {
  id: string;
  destinationKey: string;
  locale: string | null;
  sectionKey: string;
  entityType: string;
  entityId: string | null;
  position: number;
  visibleFrom: string | Date | null;
  visibleUntil: string | Date | null;
  status: string;
  editorialReason: string | null;
};

type Candidate = { id: string; label: string; type: string };

const field = 'mt-4 h-44 w-full rounded-lg border border-border-line bg-surface-paper px-12 text-text-ink';
const textarea = 'mt-4 min-h-96 w-full rounded-lg border border-border-line bg-surface-paper p-12 text-text-ink';

export default function HomepagePlacementClient({
  initialPlacements,
  candidates,
}: {
  initialPlacements: Placement[];
  candidates: Candidate[];
}) {
  const [placements, setPlacements] = useState(initialPlacements);
  const [selectedId, setSelectedId] = useState<string | null>(initialPlacements[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const selected = placements.find((item) => item.id === selectedId) ?? null;

  const candidateLabel = useMemo(
    () => new Map(candidates.map((candidate) => [candidate.id, candidate.label])),
    [candidates]
  );

  async function refresh(select?: string | null) {
    const response = await fetch('/api/admin/homepage/placements', { cache: 'no-store' });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setMessage(data?.error || 'Could not load placements.');
      return;
    }
    setPlacements(data.placements || []);
    if (select !== undefined) setSelectedId(select);
  }

  async function createPlacement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/admin/homepage/placements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(form.entries())),
    });
    const data = await response.json().catch(() => null);
    if (response.ok) {
      event.currentTarget.reset();
      await refresh(data.placement.id);
      setMessage('Placement created.');
    } else setMessage(data?.error || 'Could not create placement.');
    setBusy(false);
  }

  async function savePlacement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/admin/homepage/placements', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selected.id, ...Object.fromEntries(form.entries()) }),
    });
    const data = await response.json().catch(() => null);
    if (response.ok) {
      await refresh(selected.id);
      setMessage('Placement saved.');
    } else setMessage(data?.error || 'Could not save placement.');
    setBusy(false);
  }

  async function deletePlacement() {
    if (!selected || !window.confirm('Delete this homepage placement?')) return;
    setBusy(true);
    const response = await fetch('/api/admin/homepage/placements?id=' + encodeURIComponent(selected.id), {
      method: 'DELETE',
    });
    if (response.ok) {
      const next = placements.find((item) => item.id !== selected.id)?.id ?? null;
      await refresh(next);
      setMessage('Placement deleted.');
    } else setMessage('Could not delete placement.');
    setBusy(false);
  }

  function editorFields(item?: Placement | null) {
    const entityType = item?.entityType ?? 'project';
    const matching = candidates.filter((candidate) => candidate.type === entityType);
    return <>
      <div className="grid gap-12 md:grid-cols-3">
        <label className="text-small">Destination
          <input name="destinationKey" defaultValue={item?.destinationKey ?? 'phuket'} className={field} required />
        </label>
        <label className="text-small">Locale
          <select name="locale" defaultValue={item?.locale ?? ''} className={field}>
            <option value="">All locales</option><option value="en">EN</option><option value="ru">RU</option><option value="th">TH</option><option value="zh">ZH</option>
          </select>
        </label>
        <label className="text-small">Section
          <select name="sectionKey" defaultValue={item?.sectionKey ?? 'projects'} className={field}>
            <option value="projects">Projects</option><option value="homes">Homes</option><option value="services">Services</option><option value="areas">Areas</option>
          </select>
        </label>
        <label className="text-small">Entity type
          <select name="entityType" defaultValue={entityType} className={field}>
            <option value="project">Project</option><option value="unit">Unit</option><option value="service">Service</option><option value="area">Area</option>
          </select>
        </label>
        <label className="text-small md:col-span-2">Entity
          <select name="entityId" defaultValue={item?.entityId ?? ''} className={field} required>
            <option value="">Choose canonical entity</option>
            {matching.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}
          </select>
        </label>
        <label className="text-small">Order
          <input name="position" type="number" defaultValue={item?.position ?? 0} className={field} />
        </label>
        <label className="text-small">Visible from
          <input name="visibleFrom" type="datetime-local" defaultValue={item?.visibleFrom ? new Date(item.visibleFrom).toISOString().slice(0, 16) : ''} className={field} />
        </label>
        <label className="text-small">Visible until
          <input name="visibleUntil" type="datetime-local" defaultValue={item?.visibleUntil ? new Date(item.visibleUntil).toISOString().slice(0, 16) : ''} className={field} />
        </label>
        <label className="text-small">Status
          <select name="status" defaultValue={item?.status ?? 'active'} className={field}><option value="active">Active</option><option value="inactive">Inactive</option></select>
        </label>
        <label className="text-small md:col-span-3">Editorial reason
          <textarea name="editorialReason" defaultValue={item?.editorialReason ?? ''} className={textarea} />
        </label>
      </div>
    </>;
  }

  return <div className="grid gap-20 xl:grid-cols-[360px_minmax(0,1fr)]">
    <aside className="rounded-lg bg-brand-deep p-16 text-white shadow-card">
      <p className="text-kicker uppercase text-brand-sun-soft">Homepage control</p>
      <h2 className="mt-4 font-display text-heading-2 font-semibold">Managed placements</h2>
      <p className="mt-8 text-small text-white/70">Ordering only. Canonical readiness, price, availability and authority cannot be overridden here.</p>
      <div className="mt-20 max-h-[520px] space-y-8 overflow-y-auto">
        {placements.map((placement) => (
          <button key={placement.id} type="button" onClick={() => setSelectedId(placement.id)}
            className={'w-full rounded-md border p-12 text-left transition ' + (selectedId === placement.id ? 'border-brand-sun bg-white/10' : 'border-white/15 hover:bg-white/5')}>
            <div className="flex items-center justify-between gap-8">
              <span className="font-semibold">{candidateLabel.get(placement.entityId || '') || placement.entityId || 'Unknown entity'}</span>
              <span className="text-small text-white/60">#{placement.position}</span>
            </div>
            <p className="mt-4 text-small text-white/65">{placement.sectionKey} · {placement.locale || 'all'} · {placement.status}</p>
          </button>
        ))}
      </div>
    </aside>

    <div className="space-y-20">
      {message ? <p role="status" className="rounded-md border border-border-line bg-surface-paper p-12 text-small">{message}</p> : null}
      <section className="rounded-lg border border-border-line bg-surface-paper p-20 shadow-card">
        <p className="text-kicker uppercase text-brand-andaman">New placement</p>
        <form onSubmit={createPlacement} className="mt-16">{editorFields(null)}
          <button disabled={busy} className="mt-16 min-h-44 rounded-lg bg-brand-andaman px-20 font-semibold text-white disabled:opacity-50">Add placement</button>
        </form>
      </section>

      {selected ? <section className="rounded-lg border border-border-line bg-surface-paper p-20 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-12">
          <div><p className="text-kicker uppercase text-brand-andaman">Selected placement</p><h2 className="mt-4 font-display text-heading-2 font-semibold">{candidateLabel.get(selected.entityId || '') || selected.entityId}</h2></div>
          <button type="button" onClick={deletePlacement} disabled={busy} className="rounded-lg border border-state-error px-16 py-12 font-semibold text-state-error disabled:opacity-50">Delete</button>
        </div>
        <form key={selected.id} onSubmit={savePlacement} className="mt-16">{editorFields(selected)}
          <button disabled={busy} className="mt-16 min-h-44 rounded-lg bg-brand-andaman px-20 font-semibold text-white disabled:opacity-50">Save placement</button>
        </form>
      </section> : null}
    </div>
  </div>;
}
