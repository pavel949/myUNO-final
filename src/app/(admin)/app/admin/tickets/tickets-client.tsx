'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';

interface AdminTicketRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  categoryKey: string;
  createdAt: string;
  slaDueAt: string | null;
  projectName: string;
  unitName: string | null;
  raisedByName: string;
  assigneeName: string | null;
}

type Labels = Record<string, string>;

const ticketStatusStyle: Record<string, string> = {
  open: 'bg-state-warning-soft text-state-warning',
  acknowledged: 'bg-state-info-soft text-state-info',
  in_progress: 'bg-state-info-soft text-state-info',
  waiting_reporter: 'bg-state-warning-soft text-state-warning',
  resolved: 'bg-state-success-soft text-state-success',
  closed: 'bg-surface-ivory text-text-stone',
  cancelled: 'bg-surface-ivory text-text-stone',
};

function ticketNextStatus(status: string): string | null {
  if (status === 'open') return 'acknowledged';
  if (status === 'acknowledged') return 'in_progress';
  if (status === 'waiting_reporter') return 'in_progress';
  return null;
}

function ticketStatusLabel(status: string, labels: Labels): string {
  return labels[`tickets.status.${status}`] || status;
}

function isSlaBreached(slaDueAt: string | null, status: string): boolean {
  if (!slaDueAt) return false;
  if (['resolved', 'closed', 'cancelled'].includes(status)) return false;
  return new Date(slaDueAt).getTime() < Date.now();
}

export default function AdminTicketsClient({
  tickets,
  projects,
  activeProjectId,
  activeFilter,
  labels,
}: {
  tickets: AdminTicketRow[];
  projects: Array<{ id: string; name: string }>;
  activeProjectId: string;
  activeFilter: string;
  labels: Labels;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const act = async (ticketId: string, newStatus: string, note?: string) => {
    setBusyId(ticketId);
    setError(null);
    try {
      const response = await fetch(`/api/tickets/${ticketId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newStatus, note }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || labels['admin.tickets.error']);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['admin.tickets.error']);
    } finally {
      setBusyId(null);
    }
  };

  const filterHref = (filter: string) => {
    const params = new URLSearchParams();
    if (activeProjectId) params.set('projectId', activeProjectId);
    if (filter !== 'active') params.set('filter', filter);
    const query = params.toString();
    return query ? `/app/admin/tickets?${query}` : '/app/admin/tickets';
  };

  const filters = [
    { key: 'active', label: labels['admin.tickets.filter_active'] },
    { key: 'all', label: labels['admin.tickets.filter_all'] },
    { key: 'resolved', label: labels['admin.tickets.filter_resolved'] },
    { key: 'closed', label: labels['admin.tickets.filter_closed'] },
  ];

  return (
    <div>
      {error && (
        <div className="bg-state-error-soft border border-state-error rounded-lg p-16 mb-24">
          <p className="text-body text-state-error">{error}</p>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-end gap-16 mb-24">
        {projects.length > 0 && (
          <form method="get" className="flex-1">
            {activeFilter !== 'active' && (
              <input type="hidden" name="filter" value={activeFilter} />
            )}
            <label className="text-small text-text-secondary block mb-4">
              {labels['admin.tickets.project_filter']}
            </label>
            <select
              name="projectId"
              defaultValue={activeProjectId}
              className="w-full md:w-auto px-12 py-8 border border-border-line rounded-lg bg-surface-paper text-text-ink"
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
            >
              <option value="">{labels['admin.tickets.all_projects']}</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </form>
        )}

        <div className="flex flex-wrap gap-8">
          {filters.map((filter) => (
            <Link
              key={filter.key}
              href={filterHref(filter.key)}
              className={`px-12 py-6 rounded-full text-small font-semibold border ${
                activeFilter === filter.key
                  ? 'bg-brand-andaman text-surface-ivory border-brand-andaman'
                  : 'bg-surface-paper text-text-secondary border-border-line hover:border-brand-andaman'
              }`}
            >
              {filter.label}
            </Link>
          ))}
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="bg-surface-paper border border-border-line rounded-lg p-32 text-center">
          <p className="text-body text-text-secondary">{labels['admin.tickets.empty']}</p>
        </div>
      ) : (
        <div className="bg-surface-paper border border-border-line rounded-lg">
          {tickets.map((ticket) => {
            const progression = ticketNextStatus(ticket.status);
            const slaBreached = isSlaBreached(ticket.slaDueAt, ticket.status);

            return (
              <div
                key={ticket.id}
                className="flex flex-col lg:flex-row lg:items-center gap-12 p-16 border-b border-border-line last:border-b-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-8 mb-4">
                    <Link
                      href={`/tickets/${ticket.id}`}
                      className="text-body font-semibold text-text-ink hover:underline"
                    >
                      {ticket.title}
                    </Link>
                    <span
                      className={`inline-flex items-center px-10 py-4 rounded-full text-small font-medium ${
                        ticketStatusStyle[ticket.status] || 'bg-surface-ivory text-text-stone'
                      }`}
                    >
                      {ticketStatusLabel(ticket.status, labels)}
                    </span>
                    {slaBreached && (
                      <span className="text-small font-semibold text-state-error">
                        {labels['admin.tickets.sla_breached']}
                      </span>
                    )}
                  </div>
                  <p className="text-small text-text-secondary">
                    {ticket.projectName}
                    {ticket.unitName ? ` · ${ticket.unitName}` : ''}
                    {' · '}
                    {labels['admin.tickets.raised_by']} {ticket.raisedByName}
                    {ticket.assigneeName
                      ? ` · ${labels['admin.tickets.assigned_to']} ${ticket.assigneeName}`
                      : ` · ${labels['admin.tickets.unassigned']}`}
                  </p>
                  <p className="text-caption text-text-secondary mt-4">
                    {ticket.categoryKey} · {ticket.priority}
                    {ticket.slaDueAt
                      ? ` · ${labels['admin.tickets.sla_due']} ${new Date(ticket.slaDueAt).toLocaleString()}`
                      : ''}
                  </p>
                </div>

                <div className="flex flex-wrap gap-8">
                  {progression && (
                    <Button
                      size="sm"
                      variant="secondary"
                      isLoading={busyId === ticket.id}
                      onClick={() => act(ticket.id, progression)}
                    >
                      {ticket.status === 'open'
                        ? labels['admin.tickets.acknowledge']
                        : ticket.status === 'acknowledged'
                          ? labels['admin.tickets.start']
                          : labels['admin.tickets.resume']}
                    </Button>
                  )}
                  {ticket.status === 'in_progress' && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        isLoading={busyId === ticket.id}
                        onClick={() => act(ticket.id, 'waiting_reporter')}
                      >
                        {labels['admin.tickets.need_reporter']}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        isLoading={busyId === ticket.id}
                        onClick={() => {
                          const note = window.prompt(labels['admin.tickets.resolve_note_prompt']);
                          if (note?.trim()) {
                            void act(ticket.id, 'resolved', note.trim());
                          }
                        }}
                      >
                        {labels['admin.tickets.resolve']}
                      </Button>
                    </>
                  )}
                  <Link
                    href={`/tickets/${ticket.id}`}
                    className="inline-flex items-center px-12 py-8 text-small font-semibold text-brand-andaman hover:underline"
                  >
                    {labels['admin.tickets.open']} →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
