'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/Button';
import { Select } from '@/components/Select';
import { Textarea } from '@/components/Textarea';

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

  return (
    <section className="p-24 bg-surface-paper border border-border-line rounded-lg">
      <h2 className="font-display text-title font-semibold text-text-ink m-0 mb-8">
        {labels['buying.ask_title']}
      </h2>
      <p className="text-body text-text-stone mb-20">{labels['buying.ask_intro']}</p>

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
        <div className="flex flex-col gap-16">
          {units.length > 0 ? (
            <Select
              label={labels['buying.ask_unit']}
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              options={[
                { value: '', label: labels['buying.ask_unit_none'] },
                ...units.map((unit) => ({ value: unit.id, label: unit.name })),
              ]}
            />
          ) : null}

          <Textarea
            label={labels['buying.ask_message']}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
          />

          {error ? (
            <p className="text-small text-state-error m-0" role="alert">
              {error}
            </p>
          ) : null}

          <div>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={send}
              disabled={busy || message.trim().length === 0}
              isLoading={busy}
            >
              {busy ? labels['buying.ask_sending'] : labels['buying.ask_submit']}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
