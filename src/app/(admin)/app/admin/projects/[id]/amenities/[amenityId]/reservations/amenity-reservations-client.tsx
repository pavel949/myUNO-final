'use client';
/* eslint-disable local-rules/no-literal-ui-text */

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Reservation = {
  id: string;
  startAt: string;
  endAt: string;
  partySize: number;
  status: string;
  note: string | null;
  identity: { firstName: string; lastName: string; email: string | null };
  booking: { id: string; unit: { name: string } } | null;
};

export default function AmenityReservationsClient({ reservations }: { reservations: Reservation[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function setStatus(id: string, status: string) {
    setBusy(id); setMessage(null);
    const res = await fetch(`/api/project-amenity-reservations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const data = await res.json().catch(() => null);
    setMessage(res.ok ? 'Reservation updated.' : data?.error || 'Could not update reservation.');
    if (res.ok) router.refresh();
    setBusy(null);
  }

  return <div className="space-y-12">
    {message ? <p role="status" className="rounded-md bg-surface-muted p-12 text-small">{message}</p> : null}
    {reservations.map(row => <article key={row.id} className="rounded-xl border border-border-line bg-surface-paper p-16">
      <div className="flex flex-col gap-12 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-semibold text-text-ink">{new Date(row.startAt).toLocaleString()} – {new Date(row.endAt).toLocaleTimeString()}</p>
          <p className="mt-4 text-small text-text-secondary">{row.identity.firstName} {row.identity.lastName}{row.identity.email ? ` · ${row.identity.email}` : ''} · party {row.partySize}</p>
          <p className="mt-8 text-small text-text-secondary">{row.booking ? `${row.booking.unit.name} · Booking ${row.booking.id}` : 'Project role / no stay booking'}{row.note ? ` · ${row.note}` : ''}</p>
        </div>
        <div className="flex flex-wrap items-center gap-8">
          <span className="rounded-full bg-surface-ivory px-12 py-4 text-small">{row.status}</span>
          {row.status === 'pending' ? <button disabled={busy===row.id} onClick={()=>setStatus(row.id,'confirmed')} className="rounded-md bg-brand-andaman px-12 py-8 text-small font-semibold text-white">Confirm</button> : null}
          {['pending','confirmed'].includes(row.status) ? <button disabled={busy===row.id} onClick={()=>setStatus(row.id,'cancelled')} className="rounded-md border border-state-error px-12 py-8 text-small font-semibold text-state-error">Cancel</button> : null}
          {row.status === 'confirmed' ? <button disabled={busy===row.id} onClick={()=>setStatus(row.id,'completed')} className="rounded-md border border-border-line px-12 py-8 text-small font-semibold">Complete</button> : null}
        </div>
      </div>
    </article>)}
    {!reservations.length ? <p className="rounded-xl border border-dashed border-border-line p-24 text-center text-text-secondary">No amenity reservations yet.</p> : null}
  </div>;
}
