'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProcessStepper } from '@/components/premium/PremiumPrimitives';
import { CHECK_IN_CHECKLIST_ITEMS, type CheckInChecklistItem } from '@/modules/ops';

export default function CheckInWizard({
  bookingId,
  guestCount,
  expectedGuests,
  verificationStatus,
  readiness,
  labels,
}: {
  bookingId: string;
  guestCount: number;
  expectedGuests: number;
  verificationStatus: string;
  readiness: string;
  labels: Record<string,string>;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState<CheckInChecklistItem[]>([]);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const partyReady = guestCount >= expectedGuests;
  const identityReady = !['failed','pending'].includes(verificationStatus);
  const propertyReady = readiness === 'ready';

  const toggle = (item: CheckInChecklistItem) => {
    setChecked((current) =>
      current.includes(item) ? current.filter((value) => value !== item) : [...current, item]
    );
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/bookings/'+encodeURIComponent(bookingId)+'/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checklistItems: checked, notes }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || labels['staff.checkin.error']);
      router.push('/ops/stays/'+encodeURIComponent(bookingId));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['staff.checkin.error']);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-20">
      <ProcessStepper
        steps={[
          { label: labels['staff.checkin.step.booking'], state: 'done' },
          { label: labels['staff.checkin.step.guests'], state: partyReady && identityReady ? 'done' : 'blocked' },
          { label: labels['staff.checkin.step.property'], state: propertyReady ? 'done' : 'blocked' },
          { label: labels['staff.checkin.step.confirm'], state: partyReady && identityReady && propertyReady ? 'active' : 'waiting' },
        ]}
      />

      <div className="grid gap-16 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="stitch-panel p-20">
          <p className="stitch-kicker">{labels['staff.checkin.condition_kicker']}</p>
          <h2 className="mt-8 font-display text-heading-2 font-semibold">{labels['staff.checkin.condition_title']}</h2>
          <div className="mt-16 grid gap-8 sm:grid-cols-2">
            {CHECK_IN_CHECKLIST_ITEMS.map((item) => (
              <label key={item} className="flex min-h-48 items-center gap-12 rounded-md border border-border-line bg-surface-ivory px-12">
                <input
                  type="checkbox"
                  checked={checked.includes(item)}
                  onChange={() => toggle(item)}
                />
                <span className="text-body font-semibold">{labels['staff.checkin.item.'+item] || item}</span>
              </label>
            ))}
          </div>
          <label className="mt-16 block">
            <span className="text-small font-semibold text-text-secondary">{labels['staff.checkin.notes']}</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="mt-4 min-h-120 w-full rounded-md border border-border-line bg-surface-paper p-12"
            />
          </label>
        </section>

        <aside className="space-y-12">
          <div className="stitch-panel p-16">
            <p className="text-small text-text-secondary">{labels['staff.checkin.party']}</p>
            <p className="mt-4 font-display text-heading-3 font-semibold">{guestCount}/{expectedGuests}</p>
          </div>
          <div className="stitch-panel p-16">
            <p className="text-small text-text-secondary">{labels['staff.checkin.verification']}</p>
            <p className="mt-4 font-semibold capitalize">{verificationStatus.replace(/_/g,' ')}</p>
          </div>
          <div className="stitch-panel p-16">
            <p className="text-small text-text-secondary">{labels['staff.checkin.readiness']}</p>
            <p className="mt-4 font-semibold capitalize">{readiness.replace(/_/g,' ')}</p>
          </div>

          {error ? <div role="alert" className="rounded-md border border-state-error bg-state-error-soft p-12 text-small text-state-error">{error}</div> : null}

          <button
            type="button"
            onClick={submit}
            disabled={busy || !partyReady || !propertyReady}
            className="w-full rounded-md bg-brand-deep px-16 py-12 text-small font-semibold text-white disabled:opacity-50"
          >
            {busy ? labels['staff.checkin.working'] : labels['staff.checkin.confirm']}
          </button>
          <p className="text-small text-text-secondary">{labels['staff.checkin.note']}</p>
        </aside>
      </div>
    </div>
  );
}
