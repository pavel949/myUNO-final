'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Dispute {
  id: string;
  subjectType: 'booking' | 'service_order' | 'statement';
  createdAt: string;
  title: string;
  description: string;
  unitName: string | null;
  raisedBy: string;
}

export default function DisputesAdminClient({
  disputes,
  labels,
}: {
  disputes: Dispute[];
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const decide = useCallback(
    async (id: string) => {
      const note = (notes[id] ?? '').trim();
      if (!note) {
        setError(labels['admin.disputes.note_required']);
        return;
      }
      setBusy(id);
      setError(null);

      const amountBaht = (amounts[id] ?? '').trim();
      const resolutionAmountThb = amountBaht ? Math.round(Number(amountBaht) * 100) : undefined;

      const res = await fetch(`/api/admin/disputes/${id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolutionAmountThb, decisionNote: note }),
      }).catch(() => null);

      if (res?.ok) {
        router.refresh();
      } else {
        const payload = await res?.json().catch(() => null);
        setError(payload?.error ?? labels['admin.disputes.error']);
      }
      setBusy(null);
    },
    [amounts, notes, router, labels]
  );

  if (disputes.length === 0) {
    return (
      <div className="p-24 bg-surface-paper border border-border-line rounded-lg text-center">
        <p className="text-body text-text-secondary">{labels['admin.disputes.empty']}</p>
      </div>
    );
  }

  return (
    <div>
      {error ? (
        <p className="mb-16 text-small text-state-error" role="alert">
          {error}
        </p>
      ) : null}

      <ul className="flex flex-col gap-16">
        {disputes.map((dispute) => (
          <li key={dispute.id} className="p-16 bg-surface-paper border border-border-line rounded-lg">
            <div className="flex flex-wrap items-baseline justify-between gap-16 mb-8">
              <div>
                <span className="inline-flex items-center px-8 py-2 rounded-full text-xsmall font-medium bg-state-warning-soft text-state-warning mr-8">
                  {labels[`admin.disputes.subject.${dispute.subjectType}`]}
                </span>
                <span className="text-body font-semibold text-text-ink">{dispute.title}</span>
              </div>
              <span className="text-small text-text-secondary">
                {new Date(dispute.createdAt).toLocaleDateString()}
              </span>
            </div>

            <div className="flex flex-wrap gap-16 mb-12 text-small text-text-secondary">
              <span>
                {labels['admin.disputes.raised_by']}: {dispute.raisedBy}
              </span>
              {dispute.unitName ? (
                <span>
                  {labels['admin.disputes.unit']}: {dispute.unitName}
                </span>
              ) : null}
            </div>

            <p className="text-body text-text-ink mb-16 whitespace-pre-wrap">{dispute.description}</p>

            <div className="grid md:grid-cols-2 gap-12 mb-12">
              <label className="text-small text-text-secondary">
                {labels['admin.disputes.amount']}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amounts[dispute.id] ?? ''}
                  onChange={(e) => setAmounts((prev) => ({ ...prev, [dispute.id]: e.target.value }))}
                  className="block w-full h-40 mt-4 px-12 rounded-sm border border-border-line text-body text-text-ink"
                />
                <span className="block text-xsmall text-text-secondary mt-4">
                  {labels['admin.disputes.amount_hint']}
                </span>
              </label>
              <label className="text-small text-text-secondary">
                {labels['admin.disputes.note']}
                <textarea
                  value={notes[dispute.id] ?? ''}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [dispute.id]: e.target.value }))}
                  rows={2}
                  className="block w-full mt-4 px-12 py-8 rounded-sm border border-border-line text-body text-text-ink"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={() => decide(dispute.id)}
              disabled={busy === dispute.id}
              className="h-40 px-20 rounded-md bg-brand-andaman text-surface-ivory font-medium hover:bg-brand-deep disabled:opacity-50 transition-colors duration-micro"
            >
              {busy === dispute.id ? labels['admin.disputes.working'] : labels['admin.disputes.decide']}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
