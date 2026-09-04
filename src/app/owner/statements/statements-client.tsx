'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/Button';

interface StatementRow {
  id: string;
  periodStart: string;
  periodEnd: string;
  unitName: string;
  noiTh: number;
  ownerShareTh: number;
  status: string;
}

type Labels = Record<string, string>;

export default function OwnerStatementsClient({ labels }: { labels: Labels }) {
  const [statements, setStatements] = useState<StatementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/owner/statements');
      if (!response.ok) throw new Error(labels['owner.statements.error']);
      const data = await response.json();
      setStatements(Array.isArray(data.statements) ? data.statements : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['owner.statements.error']);
      setStatements([]);
    } finally {
      setLoading(false);
    }
  }, [labels]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="text-body text-text-secondary">{labels['owner.statements.loading']}</p>;
  }

  if (error) {
    return (
      <p className="text-small text-state-error" role="alert">
        {error}
      </p>
    );
  }

  if (statements.length === 0) {
    return <p className="text-body text-text-secondary">{labels['owner.statements.empty']}</p>;
  }

  return (
    <div className="overflow-x-auto bg-surface-paper border border-border-line rounded-lg">
      <table className="w-full text-small">
        <thead>
          <tr className="border-b border-border-line">
            <th className="px-16 py-12 text-left">{labels['owner.statements.col_period']}</th>
            <th className="px-16 py-12 text-left">{labels['owner.statements.col_unit']}</th>
            <th className="px-16 py-12 text-right">{labels['owner.statements.col_noi']}</th>
            <th className="px-16 py-12 text-right">{labels['owner.statements.col_share']}</th>
            <th className="px-16 py-12 text-left">{labels['owner.statements.col_status']}</th>
            <th className="px-16 py-12 text-left" />
          </tr>
        </thead>
        <tbody>
          {statements.map((s) => (
            <tr key={s.id} className="border-b border-border-line last:border-b-0">
              <td className="px-16 py-12">
                {new Date(s.periodStart).toLocaleDateString()} –{' '}
                {new Date(s.periodEnd).toLocaleDateString()}
              </td>
              <td className="px-16 py-12">{s.unitName}</td>
              <td className="px-16 py-12 text-right font-mono">{(s.noiTh / 100).toFixed(2)}</td>
              <td className="px-16 py-12 text-right font-mono">{(s.ownerShareTh / 100).toFixed(2)}</td>
              <td className="px-16 py-12">
                {labels[`owner.statements.status.${s.status}`] || s.status}
              </td>
              <td className="px-16 py-12">
                <Link href={`/owner/statements/${s.id}`}>
                  <Button size="sm" variant="secondary">
                    {labels['owner.statements.view']}
                  </Button>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
