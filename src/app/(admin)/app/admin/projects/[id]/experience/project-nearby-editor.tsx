/* eslint-disable local-rules/no-literal-ui-text */
'use client';

import { FormEvent, useMemo, useState } from 'react';

export type NearbyPlaceAdminRow = {
  id: string;
  slug: string;
  name: string;
  categoryKey: string;
  shortDescription: string | null;
  address: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  distanceMeters: number | null;
  walkingMinutes: number | null;
  drivingMinutes: number | null;
  externalUrl: string | null;
  isFeatured: boolean;
  published: boolean;
  sort: number;
};

const input = 'mt-4 h-40 w-full rounded-md border border-border-line bg-surface-paper px-12 text-text-ink';
const area = 'mt-4 min-h-80 w-full rounded-md border border-border-line bg-surface-paper p-12 text-text-ink';

export default function ProjectNearbyEditor({
  projectId,
  initialPlaces,
}: {
  projectId: string;
  initialPlaces: NearbyPlaceAdminRow[];
}) {
  const [places, setPlaces] = useState(initialPlaces);
  const [selectedId, setSelectedId] = useState<string | null>(initialPlaces[0]?.id ?? null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selected = places.find((place) => place.id === selectedId) ?? null;
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? places.filter((place) =>
          [place.name, place.categoryKey, place.address]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(needle))
        )
      : places;
  }, [places, query]);

  async function refresh(select?: string | null) {
    const response = await fetch(`/api/admin/projects/${projectId}/places`, { cache: 'no-store' });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setMessage(data?.error || 'Could not load nearby places.');
      return;
    }
    setPlaces(data.places || []);
    if (select !== undefined) setSelectedId(select);
  }

  async function createPlace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/admin/projects/${projectId}/places`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.get('name'),
        categoryKey: form.get('categoryKey'),
        shortDescription: form.get('shortDescription'),
        published: false,
      }),
    });
    const data = await response.json().catch(() => null);
    if (response.ok) {
      event.currentTarget.reset();
      await refresh(data.place.id);
      setMessage('Nearby place created as draft.');
    } else {
      setMessage(data?.error || 'Could not create nearby place.');
    }
    setBusy(false);
  }

  async function savePlace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch(
      `/api/admin/projects/${projectId}/places/${selected.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.get('name'),
          slug: form.get('slug'),
          categoryKey: form.get('categoryKey'),
          shortDescription: form.get('shortDescription'),
          address: form.get('address'),
          latitude: form.get('latitude'),
          longitude: form.get('longitude'),
          distanceKm: form.get('distanceKm'),
          walkingMinutes: form.get('walkingMinutes'),
          drivingMinutes: form.get('drivingMinutes'),
          externalUrl: form.get('externalUrl'),
          isFeatured: form.get('isFeatured') === 'on',
          published: form.get('published') === 'on',
          sort: form.get('sort'),
        }),
      }
    );
    const data = await response.json().catch(() => null);
    if (response.ok) {
      await refresh(selected.id);
      setMessage('Nearby place saved.');
    } else {
      setMessage(data?.error || 'Could not save nearby place.');
    }
    setBusy(false);
  }

  async function deletePlace() {
    if (!selected || !window.confirm('Delete ' + selected.name + ' from this project?')) return;
    setBusy(true);
    const response = await fetch(
      '/api/admin/projects/' + projectId + '/places/' + selected.id,
      { method: 'DELETE' }
    );
    if (response.ok) {
      const nextId = places.find((place) => place.id !== selected.id)?.id ?? null;
      await refresh(nextId);
      setMessage('Nearby place deleted.');
    } else {
      setMessage('Could not delete nearby place.');
    }
    setBusy(false);
  }

  return (
    <section className="rounded-md border border-border-line bg-surface-ivory p-20">
      <div className="mb-16">
        <p className="text-kicker uppercase text-brand-andaman">Around the project</p>
        <h2 className="mt-4 font-display text-heading-2 font-semibold text-text-ink">
          Nearby places & distances
        </h2>
        <p className="mt-8 max-w-3xl text-small text-text-secondary">
          Add beaches, restaurants, cafes, shops, attractions, schools, medical points and transport.
          Straight-line distance is calculated from coordinates when both project and place coordinates are valid;
          otherwise the entered distance is used.
        </p>
      </div>

      <div className="grid gap-20 lg:grid-cols-[300px_1fr]">
        <aside className="space-y-12">
          <form onSubmit={createPlace} className="rounded-md border border-border-line bg-surface-paper p-16">
            <h3 className="font-semibold text-text-ink">Add nearby place</h3>
            <label className="mt-12 block text-small">
              Name
              <input name="name" required className={input} />
            </label>
            <label className="mt-8 block text-small">
              Category
              <input name="categoryKey" className={input} placeholder="beach, dining, grocery…" />
            </label>
            <label className="mt-8 block text-small">
              Short description
              <textarea name="shortDescription" className={area} />
            </label>
            <button
              disabled={busy}
              className="mt-12 min-h-40 rounded-md bg-brand-andaman px-16 font-semibold text-white disabled:opacity-50"
            >
              Add draft
            </button>
          </form>

          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={input}
            placeholder="Search nearby places…"
          />
          <div className="max-h-[560px] space-y-8 overflow-y-auto pr-4">
            {filtered.map((place) => (
              <button
                key={place.id}
                type="button"
                onClick={() => setSelectedId(place.id)}
                className={
                  'w-full rounded-lg border p-12 text-left ' +
                  (selectedId === place.id
                    ? 'border-brand-andaman bg-surface-paper'
                    : 'border-border-line bg-surface-ivory')
                }
              >
                <div className="flex justify-between gap-8">
                  <span className="font-medium text-text-ink">{place.name}</span>
                  <span className="text-small text-text-secondary">
                    {place.published ? 'Live' : 'Draft'}
                  </span>
                </div>
                <p className="mt-4 text-small text-text-secondary">{place.categoryKey}</p>
              </button>
            ))}
          </div>
        </aside>

        <div>
          {message ? (
            <p role="status" className="mb-12 rounded-lg bg-surface-subtle p-12 text-small">
              {message}
            </p>
          ) : null}
          {!selected ? (
            <div className="rounded-md border border-border-line bg-surface-paper p-24 text-text-secondary">
              Select a nearby place or add a new one.
            </div>
          ) : (
            <form key={selected.id} onSubmit={savePlace} className="rounded-md border border-border-line bg-surface-paper p-20">
              <div className="flex flex-wrap items-start justify-between gap-12">
                <div>
                  <h3 className="font-display text-heading-3 font-semibold text-text-ink">{selected.name}</h3>
                  <p className="mt-4 text-small text-text-secondary">Project-local discovery record</p>
                </div>
                <div className="flex gap-12">
                  <label className="flex items-center gap-8 text-small">
                    <input type="checkbox" name="isFeatured" defaultChecked={selected.isFeatured} />
                    Featured
                  </label>
                  <label className="flex items-center gap-8 text-small">
                    <input type="checkbox" name="published" defaultChecked={selected.published} />
                    Published
                  </label>
                </div>
              </div>

              <div className="mt-16 grid gap-12 md:grid-cols-2">
                <label className="text-small">
                  Name
                  <input name="name" required defaultValue={selected.name} className={input} />
                </label>
                <label className="text-small">
                  Slug
                  <input name="slug" required defaultValue={selected.slug} className={input} />
                </label>
                <label className="text-small">
                  Category
                  <input name="categoryKey" defaultValue={selected.categoryKey} className={input} />
                </label>
                <label className="text-small">
                  Display order
                  <input type="number" min="0" name="sort" defaultValue={selected.sort} className={input} />
                </label>
                <label className="text-small md:col-span-2">
                  Short description
                  <textarea name="shortDescription" defaultValue={selected.shortDescription || ''} className={area} />
                </label>
                <label className="text-small md:col-span-2">
                  Address / place label
                  <input name="address" defaultValue={selected.address || ''} className={input} />
                </label>
                <label className="text-small">
                  Latitude
                  <input name="latitude" defaultValue={selected.latitude ?? ''} className={input} />
                </label>
                <label className="text-small">
                  Longitude
                  <input name="longitude" defaultValue={selected.longitude ?? ''} className={input} />
                </label>
                <label className="text-small">
                  Fallback distance, km
                  <input
                    name="distanceKm"
                    type="number"
                    min="0"
                    step="0.05"
                    defaultValue={selected.distanceMeters === null ? '' : selected.distanceMeters / 1000}
                    className={input}
                  />
                </label>
                <label className="text-small">
                  Walking estimate, min
                  <input name="walkingMinutes" type="number" min="1" defaultValue={selected.walkingMinutes ?? ''} className={input} />
                </label>
                <label className="text-small">
                  Driving estimate, min
                  <input name="drivingMinutes" type="number" min="1" defaultValue={selected.drivingMinutes ?? ''} className={input} />
                </label>
                <label className="text-small">
                  Map / external URL
                  <input name="externalUrl" defaultValue={selected.externalUrl || ''} className={input} />
                </label>
              </div>

              <div className="mt-20 flex flex-wrap gap-8">
                <button
                  disabled={busy}
                  className="min-h-40 rounded-md bg-brand-andaman px-16 font-semibold text-white disabled:opacity-50"
                >
                  Save place
                </button>
                <button
                  type="button"
                  onClick={deletePlace}
                  disabled={busy}
                  className="min-h-40 rounded-md border border-state-error px-16 font-semibold text-state-error disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
