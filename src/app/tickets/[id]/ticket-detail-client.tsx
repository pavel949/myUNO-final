'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';

export interface TicketDetailEvent {
  id: string;
  eventType: string;
  createdAt: string;
  actorName: string | null;
  data: Record<string, unknown> | null;
}

export interface TicketDetailView {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  createdAt: string;
  projectName: string | null;
  unitName: string | null;
  raisedByName: string;
  assigneeIdentityId: string | null;
  assigneeName: string | null;
  events: TicketDetailEvent[];
}

function fill(template: string, params: Record<string, string>): string {
  let output = template;
  for (const [key, value] of Object.entries(params)) {
    output = output.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return output;
}

const statusStyle: Record<string, string> = {
  open: 'bg-state-warning-soft text-state-warning',
  acknowledged: 'bg-state-info-soft text-state-info',
  in_progress: 'bg-state-info-soft text-state-info',
  waiting_reporter: 'bg-state-warning-soft text-state-warning',
  resolved: 'bg-state-success-soft text-state-success',
  closed: 'bg-surface-ivory text-text-stone',
  cancelled: 'bg-surface-ivory text-text-stone',
};

function statusActionsFor(
  status: string,
  labels: Record<string, string>
): Array<{ newStatus: string; label: string }> {
  if (status === 'open') {
    return [{ newStatus: 'acknowledged', label: labels['tickets.detail.acknowledge'] }];
  }
  if (status === 'acknowledged') {
    return [{ newStatus: 'in_progress', label: labels['tickets.detail.start'] }];
  }
  if (status === 'in_progress') {
    return [
      { newStatus: 'waiting_reporter', label: labels['tickets.detail.need_reporter'] },
      { newStatus: 'resolved', label: labels['tickets.detail.resolve'] },
    ];
  }
  if (status === 'waiting_reporter') {
    return [{ newStatus: 'in_progress', label: labels['tickets.detail.resume'] }];
  }
  return [];
}

function statusLabel(status: string, labels: Record<string, string>): string {
  return labels[`tickets.status.${status}`] || status;
}

function eventText(
  event: TicketDetailEvent,
  labels: Record<string, string>,
  currentStatus: string
): string {
  if (event.eventType === 'status_change') {
    const oldStatus =
      typeof event.data?.oldStatus === 'string' ? event.data.oldStatus : null;
    const newStatus =
      typeof event.data?.newStatus === 'string' ? event.data.newStatus : currentStatus;

    if (!oldStatus) {
      return fill(labels['tickets.detail.event_opened'], {
        status: statusLabel(newStatus, labels),
      });
    }
    return fill(labels['tickets.detail.event_status_changed'], {
      from: statusLabel(oldStatus, labels),
      to: statusLabel(newStatus, labels),
    });
  }
  if (event.eventType === 'assignment') return labels['tickets.detail.event_assignment'];
  if (event.eventType === 'comment_added') return labels['tickets.detail.event_comment'];
  if (event.eventType === 'sla_escalation') return labels['tickets.detail.event_sla'];
  return event.eventType;
}

export default function TicketDetailClient({
  ticket,
  labels,
  canManage,
  isReporter,
  viewerIdentityId,
}: {
  ticket: TicketDetailView;
  labels: Record<string, string>;
  canManage: boolean;
  isReporter: boolean;
  viewerIdentityId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAction = async (path: string, body: Record<string, unknown> = {}) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/tickets/${ticket.id}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || labels['tickets.detail.error_generic']);
      }
      router.refresh();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : labels['tickets.detail.error_generic']
      );
    } finally {
      setBusy(false);
    }
  };

  const runStatusAction = (newStatus: string) => {
    if (newStatus !== 'resolved') {
      void runAction('status', { newStatus });
      return;
    }

    const noteRaw = window.prompt(labels['tickets.detail.resolve_note_prompt']) || '';
    const note = noteRaw.trim();
    if (!note) {
      setError(labels['tickets.detail.resolve_note_required']);
      return;
    }
    void runAction('status', { newStatus, note });
  };

  const runReporterAction = (newStatus: 'cancelled' | 'in_progress') => {
    if (newStatus === 'cancelled') {
      if (!window.confirm(labels['tickets.detail.cancel_confirm'])) return;
      void runAction('status', { newStatus });
      return;
    }

    const note = (window.prompt(labels['tickets.detail.reopen_prompt']) || '').trim();
    void runAction('status', { newStatus, ...(note ? { note } : {}) });
  };

  return (
    <section className="bg-surface-paper border border-border-line rounded-lg p-20">
      <div className="flex flex-wrap items-start justify-between gap-12">
        <div>
          <h2 className="text-heading-2 font-bold text-text-ink">{ticket.title}</h2>
          {ticket.description ? (
            <p className="mt-8 text-body text-text-secondary">{ticket.description}</p>
          ) : null}
        </div>
        <span
          className={`px-12 py-4 rounded-full text-small font-semibold ${
            statusStyle[ticket.status] || 'bg-surface-ivory text-text-ink'
          }`}
        >
          {statusLabel(ticket.status, labels)}
        </span>
      </div>

      <dl className="mt-20 grid grid-cols-1 md:grid-cols-2 gap-12">
        <div>
          <dt className="text-small text-text-secondary">{labels['tickets.detail.project']}</dt>
          <dd className="text-body text-text-ink">{ticket.projectName || '—'}</dd>
        </div>
        <div>
          <dt className="text-small text-text-secondary">{labels['tickets.detail.unit']}</dt>
          <dd className="text-body text-text-ink">{ticket.unitName || '—'}</dd>
        </div>
        <div>
          <dt className="text-small text-text-secondary">{labels['tickets.detail.reported_by']}</dt>
          <dd className="text-body text-text-ink">{ticket.raisedByName}</dd>
        </div>
        <div>
          <dt className="text-small text-text-secondary">{labels['tickets.detail.assigned_to']}</dt>
          <dd className="text-body text-text-ink">
            {ticket.assigneeName || labels['tickets.detail.unassigned']}
          </dd>
        </div>
        <div>
          <dt className="text-small text-text-secondary">{labels['tickets.detail.created_at']}</dt>
          <dd className="text-body text-text-ink">
            {new Date(ticket.createdAt).toLocaleString()}
          </dd>
        </div>
      </dl>

      {canManage ? (
        <div className="mt-16 flex flex-wrap items-center gap-8">
          {ticket.assigneeIdentityId !== viewerIdentityId ? (
            <Button
              size="sm"
              variant="secondary"
              isLoading={busy}
              onClick={() => void runAction('assign')}
            >
              {labels['tickets.detail.assign_me']}
            </Button>
          ) : null}
          {statusActionsFor(ticket.status, labels).map((action) => (
            <Button
              key={`${ticket.id}-${action.newStatus}`}
              size="sm"
              isLoading={busy}
              onClick={() => runStatusAction(action.newStatus)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}

      {!canManage && isReporter ? (
        <div className="mt-16 flex flex-wrap items-center gap-8">
          {['open', 'acknowledged', 'in_progress', 'waiting_reporter'].includes(ticket.status) ? (
            <Button
              size="sm"
              variant="secondary"
              isLoading={busy}
              onClick={() => runReporterAction('cancelled')}
            >
              {labels['tickets.detail.cancel']}
            </Button>
          ) : null}
          {ticket.status === 'resolved' ? (
            <Button size="sm" isLoading={busy} onClick={() => runReporterAction('in_progress')}>
              {labels['tickets.detail.reopen']}
            </Button>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="mt-12 bg-state-error-soft border border-state-error rounded-lg p-12">
          <p className="text-small text-state-error">{error}</p>
        </div>
      ) : null}

      <div className="mt-24">
        <h3 className="text-heading-3 font-semibold text-text-ink mb-12">
          {labels['tickets.detail.history_title']}
        </h3>
        {ticket.events.length === 0 ? (
          <p className="text-small text-text-secondary">{labels['tickets.detail.empty_history']}</p>
        ) : (
          <ul className="space-y-10">
            {ticket.events.map((event) => (
              <li key={event.id} className="border-l-2 border-border-line pl-12">
                <p className="text-body text-text-ink">
                  {eventText(event, labels, ticket.status)}
                </p>
                <p className="text-small text-text-secondary">
                  {new Date(event.createdAt).toLocaleString()}
                  {event.actorName ? ` · ${event.actorName}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
