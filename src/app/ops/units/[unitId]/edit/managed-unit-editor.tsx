'use client';
/* eslint-disable local-rules/no-literal-ui-text */
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type RecordData = { id: string; name: string; bedrooms: number; bathrooms: number; maxGuests: number; sizeSqm: number | null; floor: string | null; addressSupplement: string; inventoryCategoryId: string | null; status: string };
export default function ManagedUnitEditor({ unit }: { unit: RecordData }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const field = 'mt-4 block w-full rounded-md border border-border-line bg-surface-paper px-12 py-12';
  return <form className="mt-24 grid gap-16 rounded-lg border border-border-line bg-surface-paper p-24 md:grid-cols-2" onSubmit={async (event) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const data = new FormData(event.currentTarget);
      const response = await fetch(`/api/admin/units/${unit.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        name: String(data.get('name') || '').trim(),
        addressSupplement: String(data.get('addressSupplement') || '').trim(),
        floor: String(data.get('floor') || ''),
        bedrooms: Number(data.get('bedrooms')), bathrooms: Number(data.get('bathrooms')),
        maxGuests: Number(data.get('maxGuests')),
        sizeSqm: data.get('sizeSqm') ? Number(data.get('sizeSqm')) : null,
      }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Update failed');
      setMessage('Saved to the canonical unit record.'); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Update failed'); }
    finally { setBusy(false); }
  }}>
    <label className="text-small">Name<input required className={field} name="name" defaultValue={unit.name}/></label>
    <label className="text-small">Location / building / door<input required className={field} name="addressSupplement" defaultValue={unit.addressSupplement}/></label>
    <label className="text-small">Floor<input className={field} name="floor" defaultValue={unit.floor || ''}/></label>
    <label className="text-small">Bedrooms<input required min="0" type="number" className={field} name="bedrooms" defaultValue={unit.bedrooms}/></label>
    <label className="text-small">Bathrooms<input required min="0" type="number" className={field} name="bathrooms" defaultValue={unit.bathrooms}/></label>
    <label className="text-small">Max guests<input required min="1" type="number" className={field} name="maxGuests" defaultValue={unit.maxGuests}/></label>
    <label className="text-small">Size, sqm<input min="0" type="number" className={field} name="sizeSqm" defaultValue={unit.sizeSqm ?? ''}/></label>
    <div className="md:col-span-2"><p className="mb-12 text-small text-text-secondary">Physical facts update the same Unit used by listings and operations. Ownership, publication, compliance and financial terms require their existing approval workflows.</p><button type="submit" disabled={busy} className="rounded-md bg-brand-deep px-24 py-12 font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save changes'}</button>{message && <p role="status" className="mt-8 text-small">{message}</p>}</div>
  </form>;
}
