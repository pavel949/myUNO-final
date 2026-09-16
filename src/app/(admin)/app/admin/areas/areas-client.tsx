'use client';
/* eslint-disable local-rules/no-literal-ui-text */

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/Button';

type Area = { id: string; slug: string; nameKey: string; status: string };
const input = 'h-40 rounded-sm border border-border-line bg-surface-paper px-12';

export default function AreasClient({ initialAreas }: { initialAreas: Area[] }) {
  const router = useRouter(); const [error, setError] = useState<string | null>(null);
  const create = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); const response = await fetch('/api/admin/areas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: data.get('slug'), nameKey: data.get('nameKey'), status: 'live' }) }); const body = await response.json(); if (!response.ok) setError(body.error || 'Could not create area.'); else { event.currentTarget.reset(); router.refresh(); } };
  const toggle = async (area: Area) => { const response = await fetch(`/api/admin/areas/${area.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: area.status === 'live' ? 'archived' : 'live' }) }); if (!response.ok) setError('Could not update area.'); else router.refresh(); };
  return <main className="max-w-4xl"><p className="text-kicker text-brand-andaman">Canonical geography</p><h1 className="font-display text-display-xl font-semibold mb-12">Areas</h1><p className="text-text-secondary mb-24">Areas are reusable location records selected by every newly onboarded property.</p>{error ? <p role="alert" className="text-state-error mb-12">{error}</p> : null}<form onSubmit={create} className="flex flex-wrap gap-8 mb-24"><input className={input} name="slug" placeholder="phuket-bang-tao" required/><input className={input} name="nameKey" placeholder="area.phuket_bang_tao" required/><Button>Create area</Button></form><div className="divide-y divide-border-line border border-border-line rounded-lg">{initialAreas.map(area => <div key={area.id} className="flex items-center justify-between p-16"><div><strong>{area.slug}</strong><p className="text-small text-text-secondary">{area.nameKey} · {area.status}</p></div><Button variant="secondary" onClick={() => toggle(area)}>{area.status === 'live' ? 'Archive' : 'Publish'}</Button></div>)}</div><Link href="/app/admin/properties/new" className="inline-block mt-20 text-brand-andaman underline">Continue to Add Property</Link></main>;
}
