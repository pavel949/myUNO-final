'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';

interface RefundRow {
  id: string;
  amountThb: number;
  createdAt: string;
  method: string;
  receiptRef: string | null;
  unitName: string;
  guestName: string;
}

export default function RefundsClient({ refunds, labels }: { refunds: RefundRow[]; labels: Record<string, string> }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function settle(refund: RefundRow) {
    if (!window.confirm(labels['staff.refunds.confirm'].replace('{amount}', refund.amountThb.toLocaleString('en-US')))) return;
    setBusyId(refund.id);
    setError(null);
    try {
      const response = await fetch(`/api/refunds/${refund.id}/settle`, { method: 'POST' });
      if (!response.ok) throw new Error('failed');
      router.refresh();
    } catch {
      setError(labels['staff.refunds.error']);
    } finally {
      setBusyId(null);
    }
  }

  if (refunds.length === 0) {
    return <p className="text-body text-text-secondary">{labels['staff.refunds.empty']}</p>;
  }

  return (
    <div className="flex flex-col gap-12">
      {error ? <p role="alert" className="text-body text-state-error">{error}</p> : null}
      {refunds.map((refund) => (
        <div key={refund.id} className="stitch-panel flex flex-wrap items-center justify-between gap-12 p-16">
          <div>
            <p className="text-body font-semibold text-text-ink">{refund.guestName} · {refund.unitName}</p>
            <p className="text-small text-text-secondary">
              ฿{refund.amountThb.toLocaleString('en-US')} · {refund.createdAt}
              {refund.receiptRef ? ` · ${labels['staff.refunds.original_receipt']} ${refund.receiptRef}` : ''}
            </p>
          </div>
          <Button size="sm" onClick={() => settle(refund)} isLoading={busyId === refund.id}>
            {labels['staff.refunds.mark_paid']}
          </Button>
        </div>
      ))}
    </div>
  );
}
