'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';

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

const statusStyle: Record<string, string> = {
  pending: 'bg-state-warning-soft text-state-warning',
  escalated: 'bg-state-error-soft text-state-error',
  failed: 'bg-state-error-soft text-state-error',
};

export default function Tm30QueueClient({
  filings,
  labels,
}: {
  filings: QueueFiling[];
  labels: Labels;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['staff.tm30.error_generic']);
    } finally {
      setBusyId(null);
    }
  };

  if (filings.length === 0) {
    return (
      <div className="bg-surface-paper border border-border-line rounded-lg p-32 text-center">
        <p className="text-body text-text-secondary">{labels['staff.tm30.empty']}</p>
      </div>
    );
  }

  return (
    <div className="bg-surface-paper border border-border-line rounded-lg p-24">
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
                <span
                  className={`inline-block px-8 py-2 rounded-full mr-8 ${
                    statusStyle[filing.status] || 'bg-surface-ivory text-text-ink'
                  }`}
                >
                  {labels[`staff.tm30.status.${filing.status}`] || filing.status}
                </span>
                {labels['staff.tm30.due']}:{' '}
                <span className={due.overdue ? 'text-state-error font-bold' : 'text-text-ink'}>
                  {due.text}
                </span>
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => markFiled(filing)}
              isLoading={busyId === filing.id}
            >
              {labels['staff.tm30.file_action']}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
