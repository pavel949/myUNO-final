'use client';

import { useState } from 'react';
import { Button } from '@/components/Button';

type Labels = Record<string, string>;

export default function OrderDisputePanel({
  orderId,
  labels,
}: {
  orderId: string;
  labels: Labels;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectType: 'service_order',
          subjectId: orderId,
          title: title.trim(),
          description: description.trim(),
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || labels['service-order.detail.dispute_error']);
      }
      setSent(true);
      setOpen(false);
      setTitle('');
      setDescription('');
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['service-order.detail.dispute_error']);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-surface-paper border border-border-line rounded-lg p-24 mb-24">
      <h2 className="text-heading-3 font-bold text-text-ink mb-12">
        {labels['service-order.detail.dispute_title']}
      </h2>
      {error && (
        <p className="text-body text-state-error mb-12">{error}</p>
      )}
      {sent && !open && (
        <p className="text-body text-state-success mb-12">
          {labels['service-order.detail.dispute_sent']}
        </p>
      )}
      {open ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-12">
          <div className="flex flex-col gap-4">
            <label htmlFor="order-dispute-title" className="text-small text-text-secondary">
              {labels['service-order.detail.dispute_title_field']}
            </label>
            <input
              id="order-dispute-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              className="h-48 px-12 rounded-sm bg-surface-paper border border-border-line text-text-ink focus:border-brand-andaman focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-4">
            <label htmlFor="order-dispute-description" className="text-small text-text-secondary">
              {labels['service-order.detail.dispute_description_field']}
            </label>
            <textarea
              id="order-dispute-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={4000}
              className="px-12 py-8 rounded-sm bg-surface-paper border border-border-line text-text-ink focus:border-brand-andaman focus:outline-none"
            />
          </div>
          <div className="flex gap-12">
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              isLoading={busy}
              disabled={!title.trim() || !description.trim()}
            >
              {labels['service-order.detail.dispute_submit']}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              {labels['service-order.detail.dispute_cancel']}
            </Button>
          </div>
        </form>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setOpen(true);
            setSent(false);
          }}
        >
          {labels['service-order.detail.dispute_open']}
        </Button>
      )}
    </div>
  );
}
