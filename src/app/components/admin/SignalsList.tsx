'use client';

import { BuyerSignalStatus, BuyerSignalKey } from '@prisma/client';
import { useState } from 'react';
import type { AdminSignal } from '@/app/actions/getAdminSignals';

const SIGNAL_KEY_LABELS: Record<BuyerSignalKey, string> = {
  repeat_stay: 'Repeat Stay',
  long_stay: 'Long Stay',
  listing_engagement: 'Listing Engagement',
  purchase_question: 'Purchase Question',
  direct_inquiry: 'Direct Inquiry',
};

const STATUS_LABELS: Record<BuyerSignalStatus, string> = {
  open: 'Open',
  reviewed: 'Reviewed',
  handed_to_capital: 'Handed to Capital',
  dismissed: 'Dismissed',
};

export function SignalsList({ signals }: { signals: AdminSignal[] }) {
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
        throw new Error(error.error || 'Failed to update signal');
      }

      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update signal');
      setUpdating(null);
    }
  };

  if (signals.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No signals found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 font-semibold text-gray-700">
                Identity
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">
                Signal
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">
                Strength
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">
                Status
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">
                Reviewed By
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {signals.map((signal) => (
              <tr key={signal.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4">
                  <div className="text-sm">
                    <p className="font-medium text-gray-900">
                      {signal.identity?.firstName} {signal.identity?.lastName}
                    </p>
                    <p className="text-gray-500">{signal.identity?.email}</p>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className="text-sm font-medium">
                    {SIGNAL_KEY_LABELS[signal.signalKey]}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className="text-sm">{signal.strength}</span>
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`text-sm font-medium px-2 py-1 rounded ${
                      signal.status === 'open'
                        ? 'bg-blue-100 text-blue-700'
                        : signal.status === 'reviewed'
                          ? 'bg-yellow-100 text-yellow-700'
                          : signal.status === 'handed_to_capital'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {STATUS_LABELS[signal.status]}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className="text-sm">
                    {signal.reviewedBy
                      ? `${signal.reviewedBy.firstName} ${signal.reviewedBy.lastName}`
                      : '—'}
                  </span>
                </td>
                <td className="py-3 px-4">
                  {signal.status === 'open' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          handleTransition(signal.id, BuyerSignalStatus.reviewed)
                        }
                        disabled={updating === signal.id}
                        className="text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
                      >
                        Mark Reviewed
                      </button>
                    </div>
                  )}
                  {signal.status === 'reviewed' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          handleTransition(
                            signal.id,
                            BuyerSignalStatus.handed_to_capital
                          )
                        }
                        disabled={updating === signal.id}
                        className="text-xs font-medium text-green-600 hover:text-green-800 disabled:opacity-50"
                      >
                        Hand to Capital
                      </button>
                      <button
                        onClick={() =>
                          handleTransition(signal.id, BuyerSignalStatus.dismissed)
                        }
                        disabled={updating === signal.id}
                        className="text-xs font-medium text-gray-600 hover:text-gray-800 disabled:opacity-50"
                      >
                        Dismiss
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
