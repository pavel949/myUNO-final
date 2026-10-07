'use client';


import { UI_LOCALE, APP_TZ } from '@/lib/format';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

type Reservation = {
  id: string;
  startAt: string;
  endAt: string;
  partySize: number;
  status: string;
  note: string | null;
};

type Policy = {
  slotMinutes?: number;
  minLeadMinutes?: number;
  maxAdvanceDays?: number;
  maxPartySize?: number;
  autoConfirm?: boolean;
};

export default function AmenityBookingClient({
  amenityId,
  bookingId,
  policy,
  capacity,
  labels,
}: {
  amenityId: string;
  bookingId?: string | null;
  policy: Policy;
  capacity: number | null;
  labels: Record<string,string>;
}) {
  const slotMinutes = policy.slotMinutes ?? 60;
  const maxParty = policy.maxPartySize ?? capacity ?? 20;
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [duration, setDuration] = useState(slotMinutes);

  const durationOptions = useMemo(() => [slotMinutes, slotMinutes * 2, slotMinutes * 3].filter((v,i,a)=>v>0&&a.indexOf(v)===i), [slotMinutes]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/project-amenities/${amenityId}/reservations`, { cache: 'no-store' });
    const data = await res.json().catch(() => null);
    if (res.ok) setReservations(data?.reservations ?? []);
  }, [amenityId]);
  useEffect(() => { void load(); }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const localStart = String(fd.get('startAt') || '');
    const start = new Date(localStart);
    if (Number.isNaN(start.getTime())) {
      setMessage(labels['amenity_booking.invalid_time']); return;
    }
    const end = new Date(start.getTime() + duration * 60_000);
    setBusy(true); setMessage(null);
    const res = await fetch(`/api/project-amenities/${amenityId}/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        partySize: Number(fd.get('partySize') || 1),
        note: fd.get('note'),
        bookingId: bookingId || undefined,
      }),
    });
    const data = await res.json().catch(() => null);
    setMessage(res.ok
      ? (data?.reservation?.status === 'confirmed' ? labels['amenity_booking.confirmed'] : labels['amenity_booking.requested'])
      : data?.error || labels['amenity_booking.error']);
    if (res.ok) {
      event.currentTarget.reset();
      setDuration(slotMinutes);
      await load();
    }
    setBusy(false);
  }

  async function cancel(id: string) {
    setBusy(true); setMessage(null);
    const res = await fetch(`/api/project-amenity-reservations/${id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => null);
    setMessage(res.ok ? labels['amenity_booking.cancelled'] : data?.error || labels['amenity_booking.error']);
    if (res.ok) await load();
    setBusy(false);
  }

  return <div className="grid gap-24 lg:grid-cols-[1fr_360px]">
    <form onSubmit={submit} className="rounded-md border border-border-line bg-surface-paper p-20">
      <h2 className="font-display text-heading-2 font-semibold text-text-ink">{labels['amenity_booking.new']}</h2>
      <p className="mt-8 text-small text-text-secondary">
        {labels['amenity_booking.policy']
          .replace('{slot}', String(slotMinutes))
          .replace('{lead}', String(policy.minLeadMinutes ?? 0))
          .replace('{days}', String(policy.maxAdvanceDays ?? 90))}
      </p>
      <div className="mt-16 grid gap-12 sm:grid-cols-2">
        <label className="text-small text-text-secondary">{labels['amenity_booking.start']}
          <input name="startAt" type="datetime-local" required className="mt-4 h-44 w-full rounded-md border border-border-line bg-surface-ivory px-12 text-text-ink"/>
        </label>
        <label className="text-small text-text-secondary">{labels['amenity_booking.duration']}
          <select value={duration} onChange={e=>setDuration(Number(e.target.value))} className="mt-4 h-44 w-full rounded-md border border-border-line bg-surface-ivory px-12 text-text-ink">
            {durationOptions.map(minutes => <option key={minutes} value={minutes}>{labels['amenity_booking.minutes'].replace('{count}', String(minutes))}</option>)}
          </select>
        </label>
        <label className="text-small text-text-secondary">{labels['amenity_booking.party']}
          <input name="partySize" type="number" min="1" max={maxParty} defaultValue="1" required className="mt-4 h-44 w-full rounded-md border border-border-line bg-surface-ivory px-12 text-text-ink"/>
        </label>
        <label className="text-small text-text-secondary sm:col-span-2">{labels['amenity_booking.note']}
          <textarea name="note" rows={3} className="mt-4 w-full rounded-md border border-border-line bg-surface-ivory p-12 text-text-ink"/>
        </label>
      </div>
      {message ? <p role="status" className="mt-12 rounded-md bg-surface-subtle p-12 text-small">{message}</p> : null}
      <button disabled={busy} className="mt-16 min-h-44 rounded-lg bg-brand-andaman px-20 font-semibold text-white disabled:opacity-50">{busy ? labels['amenity_booking.saving'] : labels['amenity_booking.submit']}</button>
    </form>

    <aside className="rounded-md border border-border-line bg-surface-paper p-20">
      <h2 className="font-semibold text-text-ink">{labels['amenity_booking.upcoming']}</h2>
      <div className="mt-12 space-y-12">
        {reservations.map(row => <article key={row.id} className="rounded-lg bg-surface-ivory p-12">
          <p className="font-semibold text-text-ink">{new Date(row.startAt).toLocaleString(UI_LOCALE, { timeZone: APP_TZ })}</p>
          <p className="mt-8 text-small text-text-secondary">{labels['amenity_booking.party_count'].replace('{count}', String(row.partySize))} · {row.status}</p>
          <button type="button" disabled={busy} onClick={()=>cancel(row.id)} className="mt-8 text-small font-semibold text-state-error">{labels['amenity_booking.cancel']}</button>
        </article>)}
        {!reservations.length ? <p className="text-small text-text-secondary">{labels['amenity_booking.none']}</p> : null}
      </div>
    </aside>
  </div>;
}
