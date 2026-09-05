'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatThb } from '@/components/viz';

interface LedgerEntry {
  id: string;
  entryType: string;
  amountThb: number;
  unitName: string;
  description: string;
  occurredOn: string;
  createdBy: string;
  bookingId?: string | null;
  serviceOrderId?: string | null;
}

interface Props {
  projectId: string;
  projects: { id: string; name: string }[];
  entries: LedgerEntry[];
  totals: Record<string, number>;
  labels: Record<string, string>;
}

export default function LedgerAdminClient({
  projectId,
  projects,
  entries,
  totals,
  labels,
}: Props) {
  const router = useRouter();
  const [reversing, setReversing] = useState<string | null>(null);

  const handleProjectChange = (newProjectId: string) => {
    router.push(`/app/admin/ledger?projectId=${newProjectId}`);
  };

  const handleReverse = async (entryId: string) => {
    if (!confirm('Are you sure? This action cannot be undone.')) return;

    setReversing(entryId);
    try {
      const res = await fetch(`/api/admin/ledger/${entryId}/reverse`, {
        method: 'POST',
      });

      if (res.ok) {
        router.refresh();
      } else {
        alert(labels['admin.ledger.error_generic']);
      }
    } catch (error) {
      alert(labels['admin.ledger.error_generic']);
    } finally {
      setReversing(null);
    }
  };

  return (
    <div>
      <div className="mb-24 flex gap-12">
        <select
          value={projectId}
          onChange={(e) => handleProjectChange(e.target.value)}
          className="px-12 py-8 border border-border-line rounded-lg bg-surface-paper text-text-ink"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {Object.keys(totals).length > 0 && (
        <div className="mb-24 p-16 bg-surface-paper border border-border-line rounded-lg">
          <h3 className="text-heading-3 font-semibold text-text-ink mb-12">
            {labels['admin.ledger.totals']}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-12">
            {Object.entries(totals).map(([type, amount]) => (
              <div key={type}>
                <p className="text-small text-text-secondary mb-4">{type.replace(/_/g, ' ')}</p>
                <p className="text-heading-3 font-semibold text-text-ink">{formatThb(amount)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="p-24 bg-surface-paper border border-border-line rounded-lg text-center">
          <p className="text-body text-text-secondary">{labels['admin.ledger.empty']}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-small">
            <thead className="bg-surface-paper">
              <tr className="text-left text-text-secondary border-b border-border-line">
                <th className="px-12 py-12 font-semibold">{labels['admin.ledger.date']}</th>
                <th className="px-12 py-12 font-semibold">{labels['admin.ledger.type']}</th>
                <th className="px-12 py-12 font-semibold">{labels['admin.ledger.unit']}</th>
                <th className="px-12 py-12 font-semibold text-right">{labels['admin.ledger.amount']}</th>
                <th className="px-12 py-12 font-semibold">{labels['admin.ledger.description']}</th>
                <th className="px-12 py-12 font-semibold">{labels['admin.ledger.created_by']}</th>
                <th className="px-12 py-12 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-border-line hover:bg-surface-paper">
                  <td className="px-12 py-8">{new Date(entry.occurredOn).toLocaleDateString()}</td>
                  <td className="px-12 py-8">
                    <span className="px-8 py-4 bg-brand-andaman/10 text-brand-andaman rounded text-small font-semibold">
                      {entry.entryType.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-12 py-8">{entry.unitName}</td>
                  <td className="px-12 py-8 text-right font-mono">{formatThb(entry.amountThb)}</td>
                  <td className="px-12 py-8 text-text-secondary truncate max-w-xs">{entry.description}</td>
                  <td className="px-12 py-8 text-text-secondary text-small">{entry.createdBy}</td>
                  <td className="px-12 py-8">
                    <button
                      onClick={() => handleReverse(entry.id)}
                      disabled={reversing === entry.id}
                      className="text-small text-brand-andaman hover:underline disabled:opacity-50"
                    >
                      {reversing === entry.id ? '...' : labels['admin.ledger.reverse']}
                    </button>
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
