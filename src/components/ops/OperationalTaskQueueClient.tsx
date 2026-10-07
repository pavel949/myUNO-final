'use client';

import { UI_LOCALE } from '@/lib/format';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { enumLabel } from '@/lib/enum-labels';
import { formatDate } from '@/lib/date';
import { useLocale } from '@/components/LocaleProvider';
import OpsStatusPill, { opsStateTone } from './OpsStatusPill';

type Task = {
  id: string;
  taskType:
    | 'turnover_cleaning'
    | 'turnover_inspection'
    | 'maintenance_followup'
    | 'preventive_maintenance'
    | 'deep_cleaning'
    | 'restocking'
    | 'guest_request'
    | 'prearrival'
    | 'owner_request'
    | 'utilities'
    | 'pool'
    | 'garden'
    | 'pest_control'
    | 'compliance'
    | 'custom';
  status: 'planned' | 'assigned' | 'in_progress' | 'inspected' | 'blocked' | 'ready' | 'cancelled';
  dueAt: string;
  notes: string | null;
  project: { id: string; name: string };
  unit: { id: string; name: string };
  assignee: { id: string; firstName: string; lastName: string } | null;
  assignedTeam?: { id: string; name: string; teamType: string } | null;
  title?: string | null;
  priority?: string;
  estimatedCostSatang?: number | null;
  actualCostSatang?: number | null;
  blocksInventory?: boolean;
};

export default function OperationalTaskQueueClient({
  tasks,
  labels,
}: { tasks: Task[]; labels: Record<string, string> }) {
  const locale = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const update = async (
    task: Task,
    status: Task['status'],
    assignToMe: boolean = false
  ) => {
    setBusy(task.id);
    setError(null);
    try {
      const response = await fetch(`/api/ops/tasks/${encodeURIComponent(task.id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status, assignToMe }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || labels['staff.tasks.update_failed']);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['staff.tasks.update_failed']);
    } finally {
      setBusy(null);
    }
  };

  if (!tasks.length) {
    return <p className="stitch-panel p-20 text-body text-text-secondary">{labels['staff.tasks.empty']}</p>;
  }

  return <div className="space-y-12">
    {error && <div role="alert" className="rounded-md border border-state-error/40 bg-state-error-soft p-12 text-small text-state-error">{error}</div>}
    {tasks.map((task) => {
      const isInspection = task.taskType === 'turnover_inspection';
      return <article key={task.id} id={`task-${task.id}`} className="stitch-panel scroll-mt-24 p-16">
        <div className="flex flex-wrap items-start justify-between gap-12">
          <div>
            <div className="flex flex-wrap items-center gap-8">
              <OpsStatusPill tone={opsStateTone(task.status)}>{task.status.replace(/_/g, ' ')}</OpsStatusPill>
              <p className="text-small font-semibold text-brand-andaman">{task.project.name} · {task.unit.name}</p>
            </div>
            <h2 className="mt-4 font-display text-heading-3 font-semibold text-text-ink">
              {task.title || enumLabel(labels, 'taskType', task.taskType)}
            </h2>
            <p className="mt-4 text-small text-text-secondary">
              <span className="font-tabular">{labels['staff.tasks.due']} {formatDate(task.dueAt, locale, 'dateTime')}</span> · {enumLabel(labels, 'taskStatus', task.status)}
              {task.assignee ? ' · ' + task.assignee.firstName + ' ' + task.assignee.lastName : ''}
              {task.assignedTeam ? ' · ' + task.assignedTeam.name : ''}
            </p>
            {(task.priority || task.blocksInventory || task.estimatedCostSatang != null || task.actualCostSatang != null) && <p className="mt-4 text-small text-text-secondary">
              {task.priority ? task.priority : ''}
              {task.blocksInventory ? ' · blocks inventory' : ''}
              {task.estimatedCostSatang != null ? ' · est ฿' + Math.round(task.estimatedCostSatang/100).toLocaleString(UI_LOCALE) : ''}
              {task.actualCostSatang != null ? ' · actual ฿' + Math.round(task.actualCostSatang/100).toLocaleString(UI_LOCALE) : ''}
            </p>}
          </div>
          <div className="flex flex-wrap gap-8">
            {task.status === 'planned' && <button disabled={busy===task.id} onClick={()=>update(task,'assigned',true)}
              className="rounded-lg border border-brand-andaman/30 bg-surface-mint px-12 py-8 text-small font-semibold text-brand-andaman transition hover:bg-brand-andaman hover:text-white disabled:opacity-50">{labels['staff.tasks.assign_me']}</button>}
            {task.status === 'blocked' && <button disabled={busy===task.id} onClick={()=>update(task,'in_progress')}
              className="rounded-lg border border-brand-andaman/30 bg-surface-mint px-12 py-8 text-small font-semibold text-brand-andaman transition hover:bg-brand-andaman hover:text-white disabled:opacity-50">{labels['staff.tasks.resume']}</button>}
            {task.status === 'assigned' && <button disabled={busy===task.id} onClick={()=>update(task,'in_progress')}
              className="rounded-lg bg-brand-deep px-12 py-8 text-small font-semibold text-white transition hover:bg-brand-andaman disabled:opacity-50">{labels['staff.tasks.start']}</button>}
            {task.status === 'in_progress' && isInspection && <button disabled={busy===task.id} onClick={()=>update(task,'inspected')}
              className="rounded-lg border border-brand-andaman/30 bg-surface-mint px-12 py-8 text-small font-semibold text-brand-andaman transition hover:bg-brand-andaman hover:text-white disabled:opacity-50">{labels['staff.tasks.inspected']}</button>}
            {task.status === 'in_progress' && !isInspection && <button disabled={busy===task.id} onClick={()=>update(task,'ready')}
              className="rounded-lg bg-brand-deep px-12 py-8 text-small font-semibold text-white transition hover:bg-brand-andaman disabled:opacity-50">{labels['staff.tasks.ready']}</button>}
            {task.status === 'inspected' && <button disabled={busy===task.id} onClick={()=>update(task,'ready')}
              className="rounded-lg bg-brand-deep px-12 py-8 text-small font-semibold text-white transition hover:bg-brand-andaman disabled:opacity-50">{labels['staff.tasks.ready']}</button>}
          </div>
        </div>
      </article>;
    })}
  </div>;
}
