'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';

/**
 * "Ask about buying" — the request-due-diligence step of the buyer journey.
 *
 * It sends a message, not a purchase. What comes back is a person in the
 * enquirer's own messages, which is the only honest answer to most buying
 * questions until Ignatev Capital has looked at the title.
 */
export default function BuyingClient({
  units,
  labels,
}: {
  units: { id: string; name: string }[];
  labels: Record<string, string>;
}) {
  const [unitId, setUnitId] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async () => {
    setBusy(true);
    setError(null);

    const res = await fetch('/api/buying/interest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unitId: unitId || null, message }),
    }).catch(() => null);

    const payload = await res?.json().catch(() => null);
    if (res?.ok) {
      setThreadId(payload?.threadId ?? null);
      setMessage('');
    } else {
      setError(payload?.error ?? labels['buying.ask_error']);
    }
    setBusy(false);
  }, [unitId, message, labels]);

  const field =
    'w-full px-12 py-8 border border-border-line rounded-lg bg-surface-paper text-text-ink text-small';

  return (
    <section className="p-16 bg-surface-paper border border-border-line rounded-lg">
      <h2 className="text-heading-3 font-semibold text-text-ink mb-8">
        {labels['buying.ask_title']}
      </h2>
      <p className="text-small text-text-secondary mb-16">{labels['buying.ask_intro']}</p>

      {threadId ? (
        <div>
          <p className="text-body text-text-ink mb-12">{labels['buying.ask_sent']}</p>
          <Link
            href={`/messages/${threadId}`}
            className="text-small text-brand-andaman font-semibold hover:underline"
          >
            {labels['buying.ask_view_thread']}
          </Link>
        </div>
      ) : (
        <>
          {units.length > 0 ? (
            <label className="block mb-12">
              <span className="text-small text-text-secondary block mb-4">
                {labels['buying.ask_unit']}
              </span>
              <select value={unitId} onChange={(e) => setUnitId(e.target.value)} className={field}>
                <option value="">{labels['buying.ask_unit_none']}</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="block mb-12">
            <span className="text-small text-text-secondary block mb-4">
              {labels['buying.ask_message']}
            </span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className={field}
            />
          </label>

          {error ? (
            <p className="text-small text-state-error mb-12" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={send}
            disabled={busy || message.trim().length === 0}
            className="px-16 py-8 rounded-lg bg-brand-deep text-on-dark-text text-small font-semibold disabled:opacity-50"
          >
            {busy ? labels['buying.ask_sending'] : labels['buying.ask_submit']}
          </button>
        </>
      )}
    </section>
  );
}
