'use client';

import { BuyerSignalStatus } from '@prisma/client';
import { useState } from 'react';
import type { AdminSignal } from '@/app/actions/getAdminSignals';

// doc 06 §3.4 status → color mapping (state tokens only)
const STATUS_STYLE: Record<string, string> = {
  open: 'bg-state-warning-soft text-state-warning',
  reviewed: 'bg-state-info-soft text-state-info',
  handed_to_capital: 'bg-state-success-soft text-state-success',
  dismissed: 'bg-surface-ivory text-text-stone',
};

/** Strength as a filled-dot scale (1–3) plus the number — never color alone. */
function StrengthDots({ strength, title }: { strength: number; title: string }) {
  return (
    <span className="inline-flex items-center gap-6" title={title} aria-label={title}>
      <span className="inline-flex gap-2" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={`inline-block w-8 h-8 rounded-full ${
              i <= strength ? 'bg-brand-andaman' : 'bg-border-line'
            }`}
          />
        ))}
      </span>
      <span className="text-small text-text-ink tabular-nums">{strength}</span>
    </span>
  );
}

export function SignalsList({
  signals,
  labels,
}: {
  signals: AdminSignal[];
  labels: Record<string, string>;
}) {
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTransition = async (
    signalId: string,
    newStatus: BuyerSignalStatus,
    notes?: string
  ) => {
    setUpdating(signalId);
    setError(null);

    try {
      const response = await fetch(`/api/buyer-signals/${signalId}/transition`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newStatus,
          notes,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || labels['admin.signals.error_update']);
      }

      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['admin.signals.error_update']);
      setUpdating(null);
    }
  };

  if (signals.length === 0) {
    return (
      <div className="text-center py-32">
        <p className="text-text-secondary">{labels['admin.signals.empty']}</p>
      </div>
    );
  }

  return (
    <div className="space-y-16">
      {error && (
        <div className="bg-state-error-soft border border-state-error rounded-lg p-16 text-state-error">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border-line">
              <th className="text-left py-12 px-16 font-semibold text-text-secondary">
                {labels['admin.signals.col.identity']}
              </th>
              <th className="text-left py-12 px-16 font-semibold text-text-secondary">
                {labels['admin.signals.col.signal']}
              </th>
              <th className="text-left py-12 px-16 font-semibold text-text-secondary">
                {labels['admin.signals.col.strength']}
              </th>
              <th className="text-left py-12 px-16 font-semibold text-text-secondary">
                {labels['admin.signals.col.status']}
              </th>
              <th className="text-left py-12 px-16 font-semibold text-text-secondary">
                {labels['admin.signals.col.reviewed_by']}
              </th>
              <th className="text-left py-12 px-16 font-semibold text-text-secondary">
                {labels['admin.signals.col.actions']}
              </th>
            </tr>
          </thead>
          <tbody>
            {signals.map((signal) => (
              <tr
                key={signal.id}
                className="border-b border-border-line hover:bg-surface-ivory"
              >
                <td className="py-12 px-16">
                  <div className="text-small">
                    <p className="font-medium text-text-ink">
                      {signal.identity?.firstName} {signal.identity?.lastName}
                    </p>
                    <p className="text-text-secondary">{signal.identity?.email}</p>
                  </div>
                </td>
                <td className="py-12 px-16">
                  <span className="text-small font-medium text-text-ink">
                    {labels[`admin.signals.key.${signal.signalKey}`] || signal.signalKey}
                  </span>
                </td>
                <td className="py-12 px-16">
                  <StrengthDots
                    strength={signal.strength}
                    title={(labels['admin.signals.strength_of'] || '{value}').replace(
                      '{value}',
                      String(signal.strength)
                    )}
                  />
                </td>
                <td className="py-12 px-16">
                  <span
                    className={`text-small font-medium px-8 py-4 rounded-full ${
                      STATUS_STYLE[signal.status] || 'bg-surface-ivory text-text-stone'
                    }`}
                  >
                    {labels[`admin.signals.status.${signal.status}`] || signal.status}
                  </span>
                </td>
                <td className="py-12 px-16">
                  <span className="text-small text-text-ink">
                    {signal.reviewedBy
                      ? `${signal.reviewedBy.firstName} ${signal.reviewedBy.lastName}`
                      : '—'}
                  </span>
                </td>
                <td className="py-12 px-16">
                  {signal.status === 'open' && (
                    <div className="flex gap-8">
                      <button
                        onClick={() =>
                          handleTransition(signal.id, BuyerSignalStatus.reviewed)
                        }
                        disabled={updating === signal.id}
                        className="text-small font-medium text-brand-andaman hover:underline disabled:opacity-50"
                      >
                        {labels['admin.signals.action.mark_reviewed']}
                      </button>
                    </div>
                  )}
                  {signal.status === 'reviewed' && (
                    <div className="flex gap-8">
                      <button
                        onClick={() =>
                          handleTransition(
                            signal.id,
                            BuyerSignalStatus.handed_to_capital
                          )
                        }
                        disabled={updating === signal.id}
                        className="text-small font-medium text-state-success hover:underline disabled:opacity-50"
                      >
                        {labels['admin.signals.action.hand_to_capital']}
                      </button>
                      <button
                        onClick={() =>
                          handleTransition(signal.id, BuyerSignalStatus.dismissed)
                        }
                        disabled={updating === signal.id}
                        className="text-small font-medium text-text-stone hover:underline disabled:opacity-50"
                      >
                        {labels['admin.signals.action.dismiss']}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
