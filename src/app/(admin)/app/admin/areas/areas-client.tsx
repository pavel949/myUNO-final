'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/Button';
import { PageHeading, Panel } from '@/components/premium/StitchPage';

type Area = { id: string; slug: string; nameKey: string; status: string };

/** Canonical areas (geography) every newly onboarded property selects from. */
export default function AreasClient({ initialAreas, labels }: { initialAreas: Area[]; labels: Record<string, string> }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const L = (k: string) => labels['admin.areas.' + k] ?? k;
  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const response = await fetch('/api/admin/areas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: data.get('slug'), nameKey: data.get('nameKey'), status: 'live' }),
    });
    if (!response.ok) setError(L('error_create'));
    else { setError(null); form.reset(); router.refresh(); }
  };
  const toggle = async (area: Area) => {
    const response = await fetch(`/api/admin/areas/${area.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: area.status === 'live' ? 'archived' : 'live' }),
    });
    if (!response.ok) setError(L('error_update'));
    else { setError(null); router.refresh(); }
  };
  return (
    <div className="max-w-4xl space-y-24">
      <PageHeading kicker={L('kicker')} title={L('title')} subtitle={L('subtitle')} />
      {error ? <p role="alert" className="text-small text-state-error">{error}</p> : null}
      <Panel title={L('create_title')}>
        <form onSubmit={create} className="flex flex-wrap gap-8">
          <input className="stitch-control" name="slug" aria-label={L('slug')} placeholder={L('slug_placeholder')} required />
          <input className="stitch-control" name="nameKey" aria-label={L('name_key')} placeholder={L('name_key_placeholder')} required />
          <Button>{L('create')}</Button>
        </form>
      </Panel>
      <Panel title={L('list_title')}>
        {initialAreas.length ? (
          <div className="divide-y divide-border-line">
            {initialAreas.map(area => (
              <div key={area.id} className="stitch-list-row flex items-center justify-between gap-12">
                <div>
                  <strong className="text-text-ink">{area.slug}</strong>
                  <p className="text-small text-text-secondary">{area.nameKey} · {L('status.' + area.status)}</p>
                </div>
                <Button variant="secondary" onClick={() => toggle(area)}>{area.status === 'live' ? L('archive') : L('publish')}</Button>
              </div>
            ))}
          </div>
        ) : <p className="text-body text-text-secondary">{L('empty')}</p>}
      </Panel>
      <Link href="/app/admin/properties/new" className="inline-block font-semibold text-brand-andaman hover:underline">{L('continue')}</Link>
    </div>
  );
}
