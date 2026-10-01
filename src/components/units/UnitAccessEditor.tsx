'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { fieldControlClass } from '@/components/fieldStyles';

type Guide = {
  checkInMethod: string;
  entryCode: string;
  lockboxLocation: string;
  lockboxCode: string;
  wifiSsid: string;
  wifiPassword: string;
  parkingInstructions: string;
  arrivalNotes: string;
  emergencyContact: string;
};

const empty: Guide = {
  checkInMethod: '',
  entryCode: '',
  lockboxLocation: '',
  lockboxCode: '',
  wifiSsid: '',
  wifiPassword: '',
  parkingInstructions: '',
  arrivalNotes: '',
  emergencyContact: '',
};

export default function UnitAccessEditor({ unitId }: { unitId: string }) {
  const [guide, setGuide] = useState<Guide>(empty);
  const [busy, setBusy] = useState(true);
  const [saved, setSaved] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/ops/units/${unitId}/access`, { cache: 'no-store' });
        if (!response.ok) throw new Error('Could not load arrival guide.');
        const payload = await response.json();
        const instructions = payload.instructions || {};
        if (!cancelled) {
          setGuide({
            ...empty,
            ...instructions,
            arrivalNotes: instructions.arrivalNotes || instructions.handoverNotes || '',
          });
        }
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not load arrival guide.');
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [unitId]);

  const set = (patch: Partial<Guide>) => {
    setSaved('');
    setGuide((current) => ({ ...current, ...patch }));
  };

  const save = async () => {
    setBusy(true);
    setError('');
    setSaved('');
    try {
      const response = await fetch(`/api/ops/units/${unitId}/access`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(guide),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not save arrival guide.');
      setSaved('Arrival guide saved securely.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save arrival guide.');
    } finally {
      setBusy(false);
    }
  };

  const labelClass = 'block text-small font-semibold text-text-secondary';
  const textareaClass = `${fieldControlClass} min-h-24 resize-y`;

  return (
    <section className="mt-24 rounded-lg border border-border-line bg-surface-paper p-20 md:p-24">
      <div className="mb-20">
        <h2 className="font-display text-heading-3 font-semibold text-text-ink">Guest arrival guide</h2>
        <p className="mt-4 text-small text-text-secondary">
          Private arrival details are encrypted and released only to the booked guest after verification and the check-in release window.
        </p>
      </div>

      {error ? <p role="alert" className="mb-12 rounded-md bg-state-error-soft p-12 text-small text-state-error">{error}</p> : null}
      {saved ? <p role="status" className="mb-12 rounded-md bg-state-success-soft p-12 text-small text-state-success">{saved}</p> : null}

      <div className="grid gap-16 md:grid-cols-2">
        <label className={labelClass}>
          Check-in method
          <select
            className={`${fieldControlClass} mt-4`}
            value={guide.checkInMethod}
            onChange={(event) => set({ checkInMethod: event.target.value })}
            disabled={busy}
          >
            <option value="">Select method</option>
            <option value="smart_lock">Smart lock</option>
            <option value="keypad">Keypad / door code</option>
            <option value="lockbox">Lockbox</option>
            <option value="key_handover">Key handover</option>
            <option value="other">Other</option>
          </select>
        </label>

        <label className={labelClass}>
          Door / entry code
          <input
            className={`${fieldControlClass} mt-4`}
            value={guide.entryCode}
            onChange={(event) => set({ entryCode: event.target.value })}
            autoComplete="off"
            disabled={busy}
          />
        </label>

        <label className={labelClass}>
          Lockbox location
          <input
            className={`${fieldControlClass} mt-4`}
            value={guide.lockboxLocation}
            onChange={(event) => set({ lockboxLocation: event.target.value })}
            disabled={busy}
          />
        </label>

        <label className={labelClass}>
          Lockbox code
          <input
            className={`${fieldControlClass} mt-4`}
            value={guide.lockboxCode}
            onChange={(event) => set({ lockboxCode: event.target.value })}
            autoComplete="off"
            disabled={busy}
          />
        </label>

        <label className={labelClass}>
          Wi-Fi network
          <input
            className={`${fieldControlClass} mt-4`}
            value={guide.wifiSsid}
            onChange={(event) => set({ wifiSsid: event.target.value })}
            disabled={busy}
          />
        </label>

        <label className={labelClass}>
          Wi-Fi password
          <input
            className={`${fieldControlClass} mt-4`}
            value={guide.wifiPassword}
            onChange={(event) => set({ wifiPassword: event.target.value })}
            autoComplete="off"
            disabled={busy}
          />
        </label>

        <label className={`${labelClass} md:col-span-2`}>
          Parking / arrival directions
          <textarea
            className={`${textareaClass} mt-4`}
            value={guide.parkingInstructions}
            onChange={(event) => set({ parkingInstructions: event.target.value })}
            disabled={busy}
          />
        </label>

        <label className={`${labelClass} md:col-span-2`}>
          Arrival notes
          <textarea
            className={`${textareaClass} mt-4`}
            value={guide.arrivalNotes}
            onChange={(event) => set({ arrivalNotes: event.target.value })}
            disabled={busy}
          />
        </label>

        <label className={`${labelClass} md:col-span-2`}>
          Emergency / onsite contact
          <input
            className={`${fieldControlClass} mt-4`}
            value={guide.emergencyContact}
            onChange={(event) => set({ emergencyContact: event.target.value })}
            disabled={busy}
          />
        </label>
      </div>

      <div className="mt-20 flex justify-end">
        <Button type="button" onClick={() => void save()} disabled={busy}>
          {busy ? 'Saving…' : 'Save arrival guide'}
        </Button>
      </div>
    </section>
  );
}
