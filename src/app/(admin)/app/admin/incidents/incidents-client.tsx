'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/Button';

interface AdminIncidentRow {
  id: string;
  unitName: string;
  incidentType: string;
  severity: string;
  description: string;
  status: string;
  reportedByName: string;
  assignedToName: string | null;
  createdAt: string;
}

type Labels = Record<string, string>;

const STATUS_GROUPS = [
  {
    key: 'active',
    statuses: 'open,acknowledged,in_progress',
    labelKey: 'admin.incidents.filter_active',
  },
  { key: 'open', statuses: 'open', labelKey: 'admin.incidents.filter_open' },
  {
    key: 'in_progress',
    statuses: 'acknowledged,in_progress',
    labelKey: 'admin.incidents.filter_in_progress',
  },
  {
    key: 'resolved',
    statuses: 'resolved,closed',
    labelKey: 'admin.incidents.filter_resolved',
  },
] as const;

const severityStyle: Record<string, string> = {
  low: 'bg-surface-ivory text-text-stone',
  medium: 'bg-state-warning-soft text-state-warning',
  high: 'bg-state-error-soft text-state-error',
  critical: 'bg-state-error text-on-dark-text',
};

const statusStyle: Record<string, string> = {
  open: 'bg-state-warning-soft text-state-warning',
  acknowledged: 'bg-state-info-soft text-state-info',
  in_progress: 'bg-state-info-soft text-state-info',
  resolved: 'bg-state-success-soft text-state-success',
  closed: 'bg-surface-ivory text-text-stone',
};

function nextStatus(status: string): IncidentStatus | null {
  if (status === 'open') return 'acknowledged';
  if (status === 'acknowledged') return 'in_progress';
  if (status === 'in_progress') return 'resolved';
  if (status === 'resolved') return 'closed';
  return null;
}

type IncidentStatus = 'open' | 'acknowledged' | 'in_progress' | 'resolved' | 'closed';

function mapIncident(raw: Record<string, unknown>): AdminIncidentRow {
  const reportedBy = raw.reportedBy as { name?: string } | null;
  const assignedTo = raw.assignedTo as { name?: string } | null;

  return {
    id: String(raw.id),
    unitName: String(raw.unitName || '—'),
    incidentType: String(raw.incidentType),
    severity: String(raw.severity),
    description: String(raw.description),
    status: String(raw.status),
    reportedByName: reportedBy?.name || '—',
    assignedToName: assignedTo?.name || null,
    createdAt: String(raw.createdAt),
  };
}

export default function AdminIncidentsClient({ labels }: { labels: Labels }) {
  const [activeGroup, setActiveGroup] =
    useState<(typeof STATUS_GROUPS)[number]['key']>('active');
  const [incidents, setIncidents] = useState<AdminIncidentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(
    async (group: (typeof STATUS_GROUPS)[number]['key']) => {
      setLoading(true);
      setError(null);
      const statuses =
        STATUS_GROUPS.find((item) => item.key === group)?.statuses ??
        'open,acknowledged,in_progress';
      try {
        const response = await fetch(
          `/api/admin/incidents?statuses=${encodeURIComponent(statuses)}`
        );
        if (!response.ok) {
          throw new Error(labels['admin.incidents.error']);
        }
        const data = await response.json();
        const rows = Array.isArray(data.incidents) ? data.incidents : [];
        setIncidents(rows.map((row: Record<string, unknown>) => mapIncident(row)));
      } catch (err) {
        setError(err instanceof Error ? err.message : labels['admin.incidents.error']);
        setIncidents([]);
      } finally {
        setLoading(false);
      }
    },
    [labels]
  );

  useEffect(() => {
    void load(activeGroup);
  }, [activeGroup, load]);

  const updateStatus = async (incidentId: string, status: IncidentStatus) => {
    setBusyId(incidentId);
    setError(null);
    try {
      const response = await fetch(`/api/admin/incidents/${incidentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || labels['admin.incidents.error']);
      }
      await load(activeGroup);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['admin.incidents.error']);
    } finally {
      setBusyId(null);
    }
  };

  const typeLabel = (type: string) => labels[`admin.incidents.type.${type}`] || type;
  const severityLabel = (severity: string) =>
    labels[`admin.incidents.severity.${severity}`] || severity;
  const statusLabel = (status: string) =>
    labels[`admin.incidents.status.${status}`] || status;

  return (
    <div>
      {error && (
        <div className="bg-state-error-soft border border-state-error rounded-lg p-16 mb-24">
          <p className="text-body text-state-error">{error}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-8 mb-24">
        {STATUS_GROUPS.map((group) => (
          <button
            key={group.key}
            type="button"
            onClick={() => setActiveGroup(group.key)}
            className={
              activeGroup === group.key
                ? 'px-12 py-8 rounded-full text-small bg-brand-andaman text-on-dark-text'
                : 'px-12 py-8 rounded-full text-small bg-surface-paper border border-border-line text-text-ink hover:border-brand-andaman'
            }
          >
            {labels[group.labelKey]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-body text-text-secondary">{labels['admin.incidents.loading']}</p>
      ) : incidents.length === 0 ? (
        <p className="text-body text-text-secondary">{labels['admin.incidents.empty']}</p>
      ) : (
        <div className="overflow-x-auto border border-border-line rounded-lg">
          <table className="w-full text-left text-small">
            <thead className="bg-surface-ivory border-b border-border-line">
              <tr>
                <th className="p-12 font-semibold">{labels['admin.incidents.col_unit']}</th>
                <th className="p-12 font-semibold">{labels['admin.incidents.col_type']}</th>
                <th className="p-12 font-semibold">{labels['admin.incidents.col_severity']}</th>
                <th className="p-12 font-semibold">{labels['admin.incidents.col_description']}</th>
                <th className="p-12 font-semibold">{labels['admin.incidents.col_status']}</th>
                <th className="p-12 font-semibold">{labels['admin.incidents.col_reported']}</th>
                <th className="p-12 font-semibold">{labels['admin.incidents.col_action']}</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((incident) => {
                const advance = nextStatus(incident.status);
                return (
                  <tr key={incident.id} className="border-b border-border-line last:border-0">
                    <td className="p-12 text-text-ink">{incident.unitName}</td>
                    <td className="p-12 text-text-secondary">{typeLabel(incident.incidentType)}</td>
                    <td className="p-12">
                      <span
                        className={`inline-block px-8 py-4 rounded-full text-caption ${severityStyle[incident.severity] || ''}`}
                      >
                        {severityLabel(incident.severity)}
                      </span>
                    </td>
                    <td className="p-12 text-text-secondary max-w-xs truncate">
                      {incident.description}
                    </td>
                    <td className="p-12">
                      <span
                        className={`inline-block px-8 py-4 rounded-full text-caption ${statusStyle[incident.status] || ''}`}
                      >
                        {statusLabel(incident.status)}
                      </span>
                    </td>
                    <td className="p-12 text-text-secondary">{incident.reportedByName}</td>
                    <td className="p-12">
                      {advance ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          isLoading={busyId === incident.id}
                          onClick={() => updateStatus(incident.id, advance)}
                        >
                          {labels[`admin.incidents.action.${advance}`]}
                        </Button>
                      ) : (
                        <span className="text-text-stone">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
