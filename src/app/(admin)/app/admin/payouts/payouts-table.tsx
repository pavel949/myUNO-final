'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/Button';

export interface PayoutRow {
  id: string;
  reference: string;
  amountThb: number;
  status: string;
  payeeType: string;
  recordedByName: string;
}

export default function PayoutsTable({
  payouts,
  labels,
}: {
  payouts: PayoutRow[];
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reconcile = useCallback(
    async (payoutId: string) => {
      setBusyId(payoutId);
      setError(null);
      try {
        const response = await fetch(`/api/admin/payouts/${payoutId}/reconcile`, {
          method: 'PUT',
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error || labels['admin.payouts.error']);
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : labels['admin.payouts.error']);
      } finally {
        setBusyId(null);
      }
    },
    [labels, router]
  );

  const statusLabel = (status: string) => {
    if (status === 'recorded') return labels['admin.payouts.status_recorded'];
    if (status === 'reconciled') return labels['admin.payouts.status_reconciled'];
    return status;
  };

  const payeeLabel = (payeeType: string) => {
    if (payeeType === 'owner') return labels['admin.payouts.payee_owner'];
    if (payeeType === 'provider') return labels['admin.payouts.payee_provider'];
    return payeeType;
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-16 mb-16">
        <h2 className="text-heading-3 font-bold text-text-ink">
          {labels['admin.payouts.history_title']}
        </h2>
        <Link
          href="/admin/finance/reconciliation"
          className="text-brand-andaman font-semibold hover:underline text-small"
        >
          {labels['admin.payouts.reconciliation_link']}
        </Link>
      </div>

      {error ? (
        <p className="mb-16 text-small text-state-error" role="alert">
          {error}
        </p>
      ) : null}

      {payouts.length === 0 ? (
        <p className="text-body text-text-secondary">{labels['admin.payouts.empty']}</p>
      ) : (
        <div className="overflow-x-auto bg-surface-paper border border-border-line rounded-lg">
          <table className="w-full text-small">
            <thead>
              <tr className="border-b border-border-line">
                <th className="px-12 py-12 text-left text-text-secondary font-medium">
                  {labels['admin.payouts.payee_type']}
                </th>
                <th className="px-12 py-12 text-left text-text-secondary font-medium">
                  {labels['admin.payouts.reference']}
                </th>
                <th className="px-12 py-12 text-right text-text-secondary font-medium">
                  {labels['admin.payouts.amount']}
                </th>
                <th className="px-12 py-12 text-left text-text-secondary font-medium">
                  {labels['admin.payouts.status']}
                </th>
                <th className="px-12 py-12 text-left text-text-secondary font-medium">
                  {labels['admin.payouts.recorded_by']}
                </th>
                <th className="px-12 py-12 text-left text-text-secondary font-medium">
                  {labels['admin.payouts.action']}
                </th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((payout) => (
                <tr key={payout.id} className="border-b border-border-line last:border-b-0">
                  <td className="px-12 py-8 capitalize text-text-ink">{payeeLabel(payout.payeeType)}</td>
                  <td className="px-12 py-8 font-mono text-text-ink">{payout.reference}</td>
                  <td className="px-12 py-8 text-right font-mono text-text-ink">
                    {(payout.amountThb / 100).toFixed(2)}
                  </td>
                  <td className="px-12 py-8">
                    <span
                      className={
                        payout.status === 'reconciled'
                          ? 'inline-flex px-8 py-2 rounded-full text-small font-medium bg-state-success-soft text-state-success'
                          : 'inline-flex px-8 py-2 rounded-full text-small font-medium bg-state-warning-soft text-state-warning'
                      }
                    >
                      {statusLabel(payout.status)}
                    </span>
                  </td>
                  <td className="px-12 py-8 text-text-ink">{payout.recordedByName}</td>
                  <td className="px-12 py-8">
                    {payout.status === 'recorded' ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void reconcile(payout.id)}
                        isLoading={busyId === payout.id}
                      >
                        {labels['admin.payouts.reconcile']}
                      </Button>
                    ) : (
                      <span className="text-text-secondary">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
