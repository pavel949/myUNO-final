'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { StatTile } from '@/components';

interface CrmSummary {
  totalDeals: number;
  totalValue: number;
  weightedForecast: number;
  winRate: string;
}

interface CrmTask {
  id: string;
  subject: string;
  dueAt: string | null;
  opportunity: { id: string; title: string; stage?: string } | null;
}

interface CrmDashboardPanelProps {
  labels: Record<string, string>;
}

function formatThb(value: number): string {
  return `฿${value.toLocaleString()}`;
}

export default function CrmDashboardPanel({ labels }: CrmDashboardPanelProps) {
  const [summary, setSummary] = useState<CrmSummary | null>(null);
  const [overdueCount, setOverdueCount] = useState(0);
  const [overduePreview, setOverduePreview] = useState<CrmTask[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [summaryRes, actionsRes] = await Promise.all([
          fetch('/api/crm/dashboard/summary'),
          fetch('/api/crm/dashboard/next-actions'),
        ]);

        if (!summaryRes.ok || !actionsRes.ok) {
          throw new Error('load failed');
        }

        const summaryJson = await summaryRes.json();
        const actionsJson = await actionsRes.json();

        if (cancelled) return;

        setSummary(summaryJson.summary);
        setOverdueCount(actionsJson.overdue?.length ?? 0);
        setOverduePreview(actionsJson.overdue?.slice(0, 3) ?? []);
      } catch {
        if (!cancelled) {
          setLoadError(labels['admin.crm.dashboard.error']);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [labels]);

  if (loadError) {
    return (
      <p className="text-body text-state-error mb-24" role="alert">
        {loadError}
      </p>
    );
  }

  if (!summary) {
    return (
      <p className="text-body text-text-secondary mb-24">
        {labels['admin.crm.dashboard.loading']}
      </p>
    );
  }

  return (
    <div className="mb-32">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-16 mb-24">
        <StatTile
          label={labels['admin.crm.dashboard.total_deals']}
          value={String(summary.totalDeals)}
          variant="neutral"
        />
        <StatTile
          label={labels['admin.crm.dashboard.pipeline_value']}
          value={formatThb(summary.totalValue)}
          variant="revenue"
        />
        <StatTile
          label={labels['admin.crm.dashboard.weighted_forecast']}
          value={formatThb(summary.weightedForecast)}
          variant="revenue"
        />
        <StatTile
          label={labels['admin.crm.dashboard.win_rate']}
          value={`${summary.winRate}%`}
          variant="occupancy"
        />
      </div>

      {overdueCount > 0 && (
        <div className="bg-state-error-soft border border-state-error rounded-md p-20">
          <h2 className="text-heading-3 font-semibold text-text-ink mb-8">
            {labels['admin.crm.dashboard.overdue_title']}
          </h2>
          <p className="text-body text-text-secondary mb-12">
            {labels['admin.crm.dashboard.overdue_count'].replace(
              '{count}',
              String(overdueCount)
            )}
          </p>
          <ul className="space-y-8">
            {overduePreview.map((task) => (
              <li key={task.id} className="text-body font-semibold text-state-error">
                {task.opportunity ? (
                  <Link
                    href={`/app/admin/crm/opportunities/${task.opportunity.id}`}
                    className="text-state-error font-semibold hover:underline"
                  >
                    {task.opportunity.title}
                  </Link>
                ) : (
                  task.subject
                )}
                {task.dueAt && (
                  <span className="text-text-secondary">
                    {' '}
                    · {new Date(task.dueAt).toLocaleDateString()}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
