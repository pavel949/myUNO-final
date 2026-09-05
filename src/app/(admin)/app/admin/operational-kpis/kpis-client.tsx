'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/Button';

interface KpiRow {
  id: string;
  unitName: string;
  metricName: string;
  periodStart: string;
  periodEnd: string;
  targetValue: number | null;
  actualValue: number | null;
  status: string;
}

type Labels = Record<string, string>;

const STATUS_FILTERS = [
  { key: 'all', status: '', labelKey: 'admin.kpis.filter_all' },
  { key: 'on_track', status: 'on_track', labelKey: 'admin.kpis.filter_on_track' },
  { key: 'at_risk', status: 'at_risk', labelKey: 'admin.kpis.filter_at_risk' },
  { key: 'below_target', status: 'below_target', labelKey: 'admin.kpis.filter_below' },
] as const;

const statusStyle: Record<string, string> = {
  on_track: 'bg-state-success-soft text-state-success',
  at_risk: 'bg-state-warning-soft text-state-warning',
  below_target: 'bg-state-error-soft text-state-error',
};

export default function AdminOperationalKpisClient({
  labels,
  units,
}: {
  labels: Labels;
  units: Array<{ id: string; name: string }>;
}) {
  const [activeFilter, setActiveFilter] =
    useState<(typeof STATUS_FILTERS)[number]['key']>('all');
  const [kpis, setKpis] = useState<KpiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({
    unitId: '',
    metricName: '',
    periodStart: '',
    periodEnd: '',
    targetValue: '',
    actualValue: '',
  });

  const load = useCallback(
    async (filter: (typeof STATUS_FILTERS)[number]['key']) => {
      setLoading(true);
      setError(null);
      const status = STATUS_FILTERS.find((item) => item.key === filter)?.status ?? '';
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      try {
        const response = await fetch(`/api/admin/operational-kpis?${params.toString()}`);
        if (!response.ok) throw new Error(labels['admin.kpis.error']);
        const data = await response.json();
        const rows = Array.isArray(data.kpis) ? data.kpis : [];
        setKpis(
          rows.map((raw: Record<string, unknown>) => ({
            id: String(raw.id),
            unitName: String(raw.unitName || '—'),
            metricName: String(raw.metricName),
            periodStart: String(raw.periodStart),
            periodEnd: String(raw.periodEnd),
            targetValue: raw.targetValue != null ? Number(raw.targetValue) : null,
            actualValue: raw.actualValue != null ? Number(raw.actualValue) : null,
            status: String(raw.status),
          }))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : labels['admin.kpis.error']);
        setKpis([]);
      } finally {
        setLoading(false);
      }
    },
    [labels]
  );

  useEffect(() => {
    void load(activeFilter);
  }, [activeFilter, load]);

  const createKpi = async () => {
    if (!draft.unitId || !draft.metricName || !draft.periodStart || !draft.periodEnd) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/operational-kpis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId: draft.unitId,
          metricName: draft.metricName,
          periodStart: draft.periodStart,
          periodEnd: draft.periodEnd,
          targetValue: draft.targetValue ? Number(draft.targetValue) : undefined,
          actualValue: draft.actualValue ? Number(draft.actualValue) : undefined,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || labels['admin.kpis.error']);
      }
      setDraft({
        unitId: '',
        metricName: '',
        periodStart: '',
        periodEnd: '',
        targetValue: '',
        actualValue: '',
      });
      await load(activeFilter);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['admin.kpis.error']);
    } finally {
      setBusy(false);
    }
  };

  const fieldClass =
    'h-40 px-12 rounded-sm bg-surface-paper border border-border-line text-small text-text-ink w-full';

  const statusLabel = (status: string) => labels[`admin.kpis.status.${status}`] || status;

  return (
    <div>
      {error && (
        <div className="bg-state-error-soft border border-state-error rounded-lg p-16 mb-24">
          <p className="text-body text-state-error">{error}</p>
        </div>
      )}

      <section className="bg-surface-paper border border-border-line rounded-lg p-24 mb-24">
        <h2 className="text-heading-3 font-semibold text-text-ink mb-16">
          {labels['admin.kpis.create_title']}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 mb-16">
          <label className="block">
            <span className="text-small text-text-secondary">{labels['admin.kpis.col_unit']}</span>
            <select
              value={draft.unitId}
              onChange={(e) => setDraft((prev) => ({ ...prev, unitId: e.target.value }))}
              className={fieldClass}
            >
              <option value="">{labels['admin.kpis.select_unit']}</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-small text-text-secondary">{labels['admin.kpis.col_metric']}</span>
            <input
              type="text"
              value={draft.metricName}
              onChange={(e) => setDraft((prev) => ({ ...prev, metricName: e.target.value }))}
              className={fieldClass}
            />
          </label>
          <label className="block">
            <span className="text-small text-text-secondary">{labels['admin.kpis.col_period_start']}</span>
            <input
              type="date"
              value={draft.periodStart}
              onChange={(e) => setDraft((prev) => ({ ...prev, periodStart: e.target.value }))}
              className={fieldClass}
            />
          </label>
          <label className="block">
            <span className="text-small text-text-secondary">{labels['admin.kpis.col_period_end']}</span>
            <input
              type="date"
              value={draft.periodEnd}
              onChange={(e) => setDraft((prev) => ({ ...prev, periodEnd: e.target.value }))}
              className={fieldClass}
            />
          </label>
          <label className="block">
            <span className="text-small text-text-secondary">{labels['admin.kpis.col_target']}</span>
            <input
              type="number"
              value={draft.targetValue}
              onChange={(e) => setDraft((prev) => ({ ...prev, targetValue: e.target.value }))}
              className={fieldClass}
            />
          </label>
          <label className="block">
            <span className="text-small text-text-secondary">{labels['admin.kpis.col_actual']}</span>
            <input
              type="number"
              value={draft.actualValue}
              onChange={(e) => setDraft((prev) => ({ ...prev, actualValue: e.target.value }))}
              className={fieldClass}
            />
          </label>
        </div>
        <Button size="sm" onClick={createKpi} isLoading={busy}>
          {labels['admin.kpis.create_submit']}
        </Button>
      </section>

      <div className="flex flex-wrap gap-8 mb-24">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.key}
            type="button"
            onClick={() => setActiveFilter(filter.key)}
            className={
              activeFilter === filter.key
                ? 'px-12 py-8 rounded-full text-small bg-brand-andaman text-on-dark-text'
                : 'px-12 py-8 rounded-full text-small bg-surface-paper border border-border-line text-text-ink hover:border-brand-andaman'
            }
          >
            {labels[filter.labelKey]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-body text-text-secondary">{labels['admin.kpis.loading']}</p>
      ) : kpis.length === 0 ? (
        <p className="text-body text-text-secondary">{labels['admin.kpis.empty']}</p>
      ) : (
        <div className="overflow-x-auto border border-border-line rounded-lg">
          <table className="w-full text-left text-small">
            <thead className="bg-surface-ivory border-b border-border-line">
              <tr>
                <th className="p-12 font-semibold">{labels['admin.kpis.col_unit']}</th>
                <th className="p-12 font-semibold">{labels['admin.kpis.col_metric']}</th>
                <th className="p-12 font-semibold">{labels['admin.kpis.col_period']}</th>
                <th className="p-12 font-semibold">{labels['admin.kpis.col_target']}</th>
                <th className="p-12 font-semibold">{labels['admin.kpis.col_actual']}</th>
                <th className="p-12 font-semibold">{labels['admin.kpis.col_status']}</th>
              </tr>
            </thead>
            <tbody>
              {kpis.map((kpi) => (
                <tr key={kpi.id} className="border-b border-border-line last:border-0">
                  <td className="p-12 text-text-ink">{kpi.unitName}</td>
                  <td className="p-12 text-text-secondary">{kpi.metricName}</td>
                  <td className="p-12 text-text-secondary">
                    {new Date(kpi.periodStart).toLocaleDateString()} –{' '}
                    {new Date(kpi.periodEnd).toLocaleDateString()}
                  </td>
                  <td className="p-12 text-text-secondary">
                    {kpi.targetValue != null ? kpi.targetValue.toLocaleString() : '—'}
                  </td>
                  <td className="p-12 text-text-secondary">
                    {kpi.actualValue != null ? kpi.actualValue.toLocaleString() : '—'}
                  </td>
                  <td className="p-12">
                    <span
                      className={`inline-block px-8 py-4 rounded-full text-small ${statusStyle[kpi.status] || ''}`}
                    >
                      {statusLabel(kpi.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
