'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Task = {
  id: string;
  taskType: 'turnover_cleaning' | 'turnover_inspection' | 'maintenance_followup';
  status: 'planned' | 'assigned' | 'in_progress' | 'inspected' | 'ready' | 'cancelled';
  dueAt: string;
  notes: string | null;
  project: { id: string; name: string };
  unit: { id: string; name: string };
  assignee: { id: string; firstName: string; lastName: string } | null;
};

export default function OperationalTaskQueueClient({ tasks }: { tasks: Task[] }) {
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
      const response = await fetch('/api/ops/tasks/' + encodeURIComponent(task.id), {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status, assignToMe }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Task update failed');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Task update failed');
    } finally {
      setBusy(null);
    }
  };

  if (!tasks.length) {
    return <p className="rounded-lg border border-border-line bg-surface-paper p-20 text-body text-text-secondary">No open readiness tasks.</p>;
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
              {task.taskType.replace(/_/g, ' ')}
            </h2>
            <p className="mt-4 text-small text-text-secondary">
              Due {new Date(task.dueAt).toLocaleString()} · {task.status.replace(/_/g, ' ')}
              {task.assignee ? ' · ' + task.assignee.firstName + ' ' + task.assignee.lastName : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-8">
            {task.status === 'planned' && <button disabled={busy===task.id} onClick={()=>update(task,'assigned',true)}
              className="rounded-md border border-border-line px-12 py-8 text-small font-semibold text-brand-andaman">Assign to me</button>}
            {task.status === 'assigned' && <button disabled={busy===task.id} onClick={()=>update(task,'in_progress')}
              className="rounded-md bg-brand-deep px-12 py-8 text-small font-semibold text-white">Start</button>}
            {task.status === 'in_progress' && isInspection && <button disabled={busy===task.id} onClick={()=>update(task,'inspected')}
              className="rounded-md border border-border-line px-12 py-8 text-small font-semibold text-brand-andaman">Inspected</button>}
            {task.status === 'in_progress' && !isInspection && <button disabled={busy===task.id} onClick={()=>update(task,'ready')}
              className="rounded-md bg-brand-deep px-12 py-8 text-small font-semibold text-white">Ready</button>}
            {task.status === 'inspected' && <button disabled={busy===task.id} onClick={()=>update(task,'ready')}
              className="rounded-md bg-brand-deep px-12 py-8 text-small font-semibold text-white">Ready</button>}
          </div>
        </div>
      </article>;
    })}
  </div>;
}
