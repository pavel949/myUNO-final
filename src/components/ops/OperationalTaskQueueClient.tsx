'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
    return <p className="rounded-lg border border-border-line bg-surface-paper p-20 text-body text-text-secondary">{labels['staff.tasks.empty']}</p>;
  }

  return <div className="space-y-12">
    {error && <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-12 text-small text-red-900">{error}</div>}
    {tasks.map((task) => {
      const isInspection = task.taskType === 'turnover_inspection';
      return <article key={task.id} className="rounded-lg border border-border-line bg-surface-paper p-16">
        <div className="flex flex-wrap items-start justify-between gap-12">
          <div>
            <p className="text-small font-semibold text-brand-andaman">{task.project.name} · {task.unit.name}</p>
            <h2 className="mt-4 font-display text-heading-3 font-semibold text-text-ink">
              {task.title || task.taskType.replace(/_/g, ' ')}
            </h2>
            <p className="mt-4 text-small text-text-secondary">
              {labels['staff.tasks.due']} {new Date(task.dueAt).toLocaleString()} · {task.status.replace(/_/g, ' ')}
              {task.assignee ? ' · ' + task.assignee.firstName + ' ' + task.assignee.lastName : ''}
              {task.assignedTeam ? ' · ' + task.assignedTeam.name : ''}
            </p>
            {(task.priority || task.blocksInventory || task.estimatedCostSatang != null || task.actualCostSatang != null) && <p className="mt-4 text-small text-text-secondary">
              {task.priority ? task.priority : ''}
              {task.blocksInventory ? ' · blocks inventory' : ''}
              {task.estimatedCostSatang != null ? ' · est ฿' + Math.round(task.estimatedCostSatang/100).toLocaleString() : ''}
              {task.actualCostSatang != null ? ' · actual ฿' + Math.round(task.actualCostSatang/100).toLocaleString() : ''}
            </p>}
          </div>
          <div className="flex flex-wrap gap-8">
            {task.status === 'planned' && <button disabled={busy===task.id} onClick={()=>update(task,'assigned',true)}
              className="rounded-md border border-border-line px-12 py-8 text-small font-semibold text-brand-andaman">{labels['staff.tasks.assign_me']}</button>}
            {task.status === 'blocked' && <button disabled={busy===task.id} onClick={()=>update(task,'in_progress')}
              className="rounded-md border border-border-line px-12 py-8 text-small font-semibold text-brand-andaman">{labels['staff.tasks.resume']}</button>}
            {task.status === 'assigned' && <button disabled={busy===task.id} onClick={()=>update(task,'in_progress')}
              className="rounded-md bg-brand-deep px-12 py-8 text-small font-semibold text-white">{labels['staff.tasks.start']}</button>}
            {task.status === 'in_progress' && isInspection && <button disabled={busy===task.id} onClick={()=>update(task,'inspected')}
              className="rounded-md border border-border-line px-12 py-8 text-small font-semibold text-brand-andaman">{labels['staff.tasks.inspected']}</button>}
            {task.status === 'in_progress' && !isInspection && <button disabled={busy===task.id} onClick={()=>update(task,'ready')}
              className="rounded-md bg-brand-deep px-12 py-8 text-small font-semibold text-white">{labels['staff.tasks.ready']}</button>}
            {task.status === 'inspected' && <button disabled={busy===task.id} onClick={()=>update(task,'ready')}
              className="rounded-md bg-brand-deep px-12 py-8 text-small font-semibold text-white">{labels['staff.tasks.ready']}</button>}
          </div>
        </div>
      </article>;
    })}
  </div>;
}
