'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';

interface ReconciliationData {
  unmatchedPayments: Array<{
    id: string;
    amountThb: number;
    method: string;
    purpose: string;
    payer: string;
    status: string;
    createdAt: string;
  }>;
  failedRefunds: Array<{
    id: string;
    refundAmount: number;
    reason: string;
    initiatedBy: string;
    createdAt: string;
  }>;
  pendingPayouts: Array<{
    id: string;
    payeeType: string;
    amountThb: number;
    reference: string;
    executedOn: string;
    recordedBy: string;
    status: string;
  }>;
}

export default function ReconciliationClient({ labels }: { labels: Record<string, string> }) {
  const [data, setData] = useState<ReconciliationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reconciling, setReconciling] = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);

  const loadData = async () => {
    const response = await fetch('/api/admin/finance/reconciliation');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.json() as Promise<ReconciliationData>;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const next = await loadData();
        setData(next);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : labels['finance.reconciliation.error_title']);
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [labels]);

  const handleReconcilePayout = async (payoutId: string) => {
    try {
      setReconciling(payoutId);
      await fetch(`/api/admin/payouts/${payoutId}/reconcile`, { method: 'PUT' });
      setData(await loadData());
    } finally {
      setReconciling(null);
    }
  };

  const handleResolveRefund = async (refundId: string, action: 'retry' | 'write_off') => {
    try {
      setResolving(refundId);
      await fetch(`/api/admin/finance/refunds/${refundId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      setData(await loadData());
    } finally {
      setResolving(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-24">
        <h1 className="font-display text-display-xl font-semibold text-text-ink">
          {labels['finance.reconciliation.title']}
        </h1>
        <div className="bg-surface-paper border border-border-line rounded-lg p-24 text-center">
          <p className="text-body text-text-secondary">{labels['finance.reconciliation.loading']}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-24">
        <h1 className="font-display text-display-xl font-semibold text-text-ink">
          {labels['finance.reconciliation.title']}
        </h1>
        <div className="bg-state-error-soft border border-state-error rounded-lg p-24">
          <p className="text-body font-semibold text-state-error">
            {labels['finance.reconciliation.error_title']}
          </p>
          <p className="text-small text-state-error mt-8">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-24">
        <h1 className="font-display text-display-xl font-semibold text-text-ink">
          {labels['finance.reconciliation.title']}
        </h1>
        <div className="bg-surface-paper border border-border-line rounded-lg p-24 text-center">
          <p className="text-body text-text-secondary">{labels['finance.reconciliation.no_data']}</p>
        </div>
      </div>
    );
  }

  const totalUnmatched = data.unmatchedPayments.length;
  const totalFailedRefunds = data.failedRefunds.length;
  const totalPendingPayouts = data.pendingPayouts.length;

  return (
    <div className="space-y-32">
      <div>
        <h1 className="font-display text-display-xl font-semibold text-text-ink">
          {labels['finance.reconciliation.title']}
        </h1>
        <p className="text-body text-text-secondary mt-8">
          {labels['finance.reconciliation.description']}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
        <div className="bg-state-warning-soft border border-state-warning rounded-lg p-24">
          <p className="text-small font-medium text-state-warning">
            {labels['finance.reconciliation.unmatched_payments']}
          </p>
          <p className="font-display text-display font-semibold text-state-warning mt-8 tabular-nums">
            {totalUnmatched}
          </p>
        </div>
        <div className="bg-state-error-soft border border-state-error rounded-lg p-24">
          <p className="text-small font-medium text-state-error">
            {labels['finance.reconciliation.failed_refunds']}
          </p>
          <p className="font-display text-display font-semibold text-state-error mt-8 tabular-nums">
            {totalFailedRefunds}
          </p>
        </div>
        <div className="bg-state-info-soft border border-brand-andaman rounded-lg p-24">
          <p className="text-small font-medium text-brand-andaman">
            {labels['finance.reconciliation.pending_payouts']}
          </p>
          <p className="font-display text-display font-semibold text-brand-andaman mt-8 tabular-nums">
            {totalPendingPayouts}
          </p>
        </div>
      </div>

      {totalUnmatched > 0 && (
        <section className="bg-surface-paper border border-border-line rounded-lg p-24">
          <h2 className="font-display text-display font-semibold text-text-ink mb-16">
            {`${labels['finance.reconciliation.unmatched_payments']} (${totalUnmatched})`}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-small">
              <thead>
                <tr className="border-b border-border-line">
                  <th className="px-12 py-12 text-left text-text-secondary font-medium">
                    {labels['finance.reconciliation.col_amount']}
                  </th>
                  <th className="px-12 py-12 text-left text-text-secondary font-medium">
                    {labels['finance.reconciliation.col_method']}
                  </th>
                  <th className="px-12 py-12 text-left text-text-secondary font-medium">
                    {labels['finance.reconciliation.col_purpose']}
                  </th>
                  <th className="px-12 py-12 text-left text-text-secondary font-medium">
                    {labels['finance.reconciliation.col_payer']}
                  </th>
                  <th className="px-12 py-12 text-left text-text-secondary font-medium">
                    {labels['finance.reconciliation.col_status']}
                  </th>
                  <th className="px-12 py-12 text-left text-text-secondary font-medium">
                    {labels['finance.reconciliation.col_created']}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.unmatchedPayments.map((payment) => (
                  <tr key={payment.id} className="border-b border-border-line last:border-b-0">
                    <td className="px-12 py-8 text-text-ink">{`฿${payment.amountThb.toLocaleString()}`}</td>
                    <td className="px-12 py-8 capitalize text-text-ink">{payment.method}</td>
                    <td className="px-12 py-8 capitalize text-text-ink">{payment.purpose}</td>
                    <td className="px-12 py-8 text-text-ink">{payment.payer}</td>
                    <td className="px-12 py-8">
                      <span
                        className={
                          payment.status === 'failed'
                            ? 'inline-flex px-8 py-2 rounded-full text-small font-medium bg-state-error-soft text-state-error'
                            : 'inline-flex px-8 py-2 rounded-full text-small font-medium bg-state-warning-soft text-state-warning'
                        }
                      >
                        {payment.status}
                      </span>
                    </td>
                    <td className="px-12 py-8 text-text-secondary">
                      {new Date(payment.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {totalFailedRefunds > 0 && (
        <section className="bg-surface-paper border border-border-line rounded-lg p-24">
          <h2 className="font-display text-display font-semibold text-text-ink mb-16">
            {`${labels['finance.reconciliation.failed_refunds']} (${totalFailedRefunds})`}
          </h2>
          <div className="flex flex-col gap-16">
            {data.failedRefunds.map((refund) => (
              <div
                key={refund.id}
                className="border border-state-error rounded-lg p-16 bg-state-error-soft"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-16 mb-16">
                  <div>
                    <p className="text-small text-text-secondary">
                      {labels['finance.reconciliation.refund_amount']}
                    </p>
                    <p className="text-body font-bold text-text-ink">{`฿${refund.refundAmount.toLocaleString()}`}</p>
                  </div>
                  <div>
                    <p className="text-small text-text-secondary">
                      {labels['finance.reconciliation.reason']}
                    </p>
                    <p className="text-body capitalize text-text-ink">{refund.reason}</p>
                  </div>
                  <div>
                    <p className="text-small text-text-secondary">
                      {labels['finance.reconciliation.initiated_by']}
                    </p>
                    <p className="text-body text-text-ink">{refund.initiatedBy}</p>
                  </div>
                  <div>
                    <p className="text-small text-text-secondary">
                      {labels['finance.reconciliation.col_created']}
                    </p>
                    <p className="text-body text-text-ink">
                      {new Date(refund.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-8">
                  <Button
                    size="sm"
                    onClick={() => void handleResolveRefund(refund.id, 'retry')}
                    isLoading={resolving === refund.id}
                  >
                    {labels['finance.reconciliation.retry_refund']}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void handleResolveRefund(refund.id, 'write_off')}
                    isLoading={resolving === refund.id}
                  >
                    {labels['finance.reconciliation.write_off']}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {totalPendingPayouts > 0 && (
        <section className="bg-surface-paper border border-border-line rounded-lg p-24">
          <h2 className="font-display text-display font-semibold text-text-ink mb-16">
            {`${labels['finance.reconciliation.pending_payouts']} (${totalPendingPayouts})`}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-small">
              <thead>
                <tr className="border-b border-border-line">
                  <th className="px-12 py-12 text-left text-text-secondary font-medium">
                    {labels['finance.reconciliation.col_type']}
                  </th>
                  <th className="px-12 py-12 text-left text-text-secondary font-medium">
                    {labels['finance.reconciliation.col_amount']}
                  </th>
                  <th className="px-12 py-12 text-left text-text-secondary font-medium">
                    {labels['finance.reconciliation.col_reference']}
                  </th>
                  <th className="px-12 py-12 text-left text-text-secondary font-medium">
                    {labels['finance.reconciliation.col_executed']}
                  </th>
                  <th className="px-12 py-12 text-left text-text-secondary font-medium">
                    {labels['finance.reconciliation.col_recorded_by']}
                  </th>
                  <th className="px-12 py-12 text-left text-text-secondary font-medium">
                    {labels['finance.reconciliation.col_status']}
                  </th>
                  <th className="px-12 py-12 text-left text-text-secondary font-medium">
                    {labels['finance.reconciliation.col_action']}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.pendingPayouts.map((payout) => (
                  <tr key={payout.id} className="border-b border-border-line last:border-b-0">
                    <td className="px-12 py-8 font-medium capitalize text-text-ink">
                      {payout.payeeType}
                    </td>
                    <td className="px-12 py-8 font-bold text-text-ink">{`฿${payout.amountThb.toLocaleString()}`}</td>
                    <td className="px-12 py-8 font-mono text-small text-text-ink">{payout.reference}</td>
                    <td className="px-12 py-8 text-text-ink">{payout.executedOn}</td>
                    <td className="px-12 py-8 text-text-ink">{payout.recordedBy}</td>
                    <td className="px-12 py-8">
                      <span className="inline-flex px-8 py-2 rounded-full text-small font-medium bg-state-info-soft text-brand-andaman">
                        {payout.status}
                      </span>
                    </td>
                    <td className="px-12 py-8">
                      <Button
                        size="sm"
                        variant="sun"
                        onClick={() => void handleReconcilePayout(payout.id)}
                        isLoading={reconciling === payout.id}
                      >
                        {labels['finance.reconciliation.mark_reconciled']}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {totalUnmatched === 0 && totalFailedRefunds === 0 && totalPendingPayouts === 0 && (
        <section className="bg-surface-paper border border-border-line rounded-lg p-24 text-center">
          <p className="font-display text-display font-semibold text-text-ink mb-8">
            {labels['finance.reconciliation.all_clear']}
          </p>
          <p className="text-body text-text-secondary">{labels['finance.reconciliation.no_issues']}</p>
        </section>
      )}
    </div>
  );
}
