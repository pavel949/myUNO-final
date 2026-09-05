'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import Tm30FilingDetailDrawer from '@/components/ops/Tm30FilingDetailDrawer';

interface QueueFiling {
  id: string;
  status: string;
  dueAt: string;
  guestName: string;
  nationality: string;
  unitName: string;
  projectName: string;
  arrival: string | null;
}

type Labels = Record<string, string>;

function fill(template: string, params: Record<string, string | number>): string {
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return result;
}

function countdown(dueAt: string, overdueLabel: string): { text: string; overdue: boolean } {
  const ms = new Date(dueAt).getTime() - Date.now();
  if (ms <= 0) return { text: overdueLabel, overdue: true };
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  return { text: `${hours}h ${minutes}m`, overdue: false };
}

function filingChipStatus(status: string): 'requested' | 'declined' | 'default' {
  if (status === 'pending') return 'requested';
  if (status === 'escalated' || status === 'failed') return 'declined';
  return 'default';
}

const chipStatusVariant = 'status' as const;

export default function Tm30QueueClient({
  filings: initialFilings,
  labels,
  queueProjectId,
}: {
  filings: QueueFiling[];
  labels: Labels;
  /** When set, refresh the list from GET /api/tm30/queue after actions. */
  queueProjectId?: string | null;
}) {
  const router = useRouter();
  const [filings, setFilings] = useState(initialFilings);
  const [activeFiling, setActiveFiling] = useState<QueueFiling | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reloadFromApi = async () => {
    if (!queueProjectId) return;
    const response = await fetch(`/api/tm30/queue?projectId=${encodeURIComponent(queueProjectId)}`);
    if (!response.ok) return;
    const data = await response.json();
    if (Array.isArray(data.queue)) {
      setFilings(
        data.queue.map((row: QueueFiling) => ({
          id: row.id,
          status: row.status,
          dueAt: row.dueAt,
          guestName: row.guestName,
          nationality: row.nationality,
          unitName: row.unitName,
          projectName: row.projectName,
          arrival: row.arrival,
        }))
      );
    }
  };

  useEffect(() => {
    if (queueProjectId) {
      void reloadFromApi();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only refetch when project changes
  }, [queueProjectId]);

  const markFiled = async (filing: QueueFiling) => {
    if (!window.confirm(fill(labels['staff.tm30.file_confirm'], { guest: filing.guestName }))) {
      return;
    }
    setBusyId(filing.id);
    setError(null);
    try {
      const response = await fetch(`/api/tm30/${filing.id}/file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || labels['staff.tm30.error_generic']);
      }
      if (queueProjectId) {
        await reloadFromApi();
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['staff.tm30.error_generic']);
    } finally {
      setBusyId(null);
    }
  };

  if (filings.length === 0) {
    return (
      <div className="bg-surface-paper border border-border-line rounded-lg shadow-card p-32 text-center">
        <p className="text-body text-text-secondary">{labels['staff.tm30.empty']}</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-surface-paper border border-border-line rounded-lg shadow-card p-24">
        {error && (
          <div className="bg-state-error-soft border border-state-error rounded-lg p-16 mb-16">
            <p className="text-body text-state-error">{error}</p>
          </div>
        )}
        {filings.map((filing) => {
          const due = countdown(filing.dueAt, labels['staff.tm30.overdue']);
          return (
            <div
              key={filing.id}
              className="flex flex-col md:flex-row md:items-center gap-12 py-16 border-b border-border-line last:border-b-0"
            >
              <div className="flex-1 min-w-0">
                <p className="text-body font-semibold text-text-ink">
                  {filing.guestName}
                  <span className="text-text-secondary font-normal">
                    {' '}
                    · {filing.nationality} · {filing.unitName} ({filing.projectName})
                  </span>
                </p>
                <p className="text-small text-text-secondary">
                  <span className="inline-block mr-8">
                    <Chip variant={chipStatusVariant} status={filingChipStatus(filing.status)}>
                      {labels[`staff.tm30.status.${filing.status}`] || filing.status}
                    </Chip>
                  </span>
                  {labels['staff.tm30.due']}:{' '}
                  <span className={due.overdue ? 'text-state-error font-bold' : 'text-text-ink'}>
                    {due.text}
                  </span>
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-8 shrink-0">
                <Button size="sm" variant="secondary" onClick={() => setActiveFiling(filing)}>
                  {labels['staff.tm30.detail_action']}
                </Button>
                <Button
                  size="sm"
                  onClick={() => markFiled(filing)}
                  isLoading={busyId === filing.id}
                >
                  {labels['staff.tm30.file_action']}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <Tm30FilingDetailDrawer
        filing={activeFiling}
        labels={labels}
        onClose={() => setActiveFiling(null)}
        onComplete={() => router.refresh()}
      />
    </>
  );
}
