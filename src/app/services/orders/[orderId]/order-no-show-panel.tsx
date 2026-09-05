'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';

type Labels = Record<string, string>;

export default function OrderNoShowPanel({
  orderId,
  labels,
}: {
  orderId: string;
  labels: Labels;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!window.confirm(labels['service-order.detail.no_show_confirm'])) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/service-orders/${orderId}/no-show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note.trim() || undefined }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || labels['service-order.detail.no_show_error']);
      }
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['service-order.detail.no_show_error']);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-surface-paper border border-border-line rounded-lg p-24 mb-24">
      <h2 className="text-heading-3 font-bold text-text-ink mb-8">
        {labels['service-order.detail.no_show_title']}
      </h2>
      <p className="text-body text-text-secondary mb-12">
        {labels['service-order.detail.no_show_hint']}
      </p>
      {error ? (
        <p className="text-body text-state-error mb-12" role="alert">
          {error}
        </p>
      ) : null}
      {open ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-12">
          <div className="flex flex-col gap-4">
            <label htmlFor="order-no-show-note" className="text-small text-text-secondary">
              {labels['service-order.detail.no_show_note_label']}
            </label>
            <textarea
              id="order-no-show-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder={labels['service-order.detail.no_show_note_placeholder']}
              className="px-12 py-8 rounded-sm bg-surface-paper border border-border-line text-text-ink focus:border-brand-andaman focus:outline-none"
            />
          </div>
          <div className="flex gap-12">
            <Button type="submit" variant="secondary" size="sm" isLoading={busy}>
              {labels['service-order.detail.no_show_submit']}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              {labels['service-order.detail.no_show_cancel']}
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          {labels['service-order.detail.no_show_open']}
        </Button>
      )}
    </div>
  );
}
