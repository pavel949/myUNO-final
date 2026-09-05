'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/Button';

interface ChecklistRow {
  id: string;
  unitName: string;
  templateName: string;
  templateFrequency: string;
  dueDate: string;
  completedDate: string | null;
  passed: boolean | null;
  notes: string | null;
}

interface TemplateRow {
  id: string;
  name: string;
  frequency: string;
  instanceCount: number;
}

type Labels = Record<string, string>;

export default function ComplianceChecklistsClient({
  labels,
  units,
}: {
  labels: Labels;
  units: Array<{ id: string; name: string }>;
}) {
  const [instances, setInstances] = useState<ChecklistRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    unitId: '',
    templateId: '',
    dueDate: '',
    templateName: '',
    templateFrequency: 'monthly',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [instancesRes, templatesRes] = await Promise.all([
        fetch('/api/admin/compliance-checklists'),
        fetch('/api/admin/compliance-checklists?showTemplates=true'),
      ]);
      if (!instancesRes.ok || !templatesRes.ok) {
        throw new Error(labels['admin.checklists.error']);
      }
      const instancesData = await instancesRes.json();
      const templatesData = await templatesRes.json();
      setInstances(
        (instancesData.instances || []).map((raw: Record<string, unknown>) => ({
          id: String(raw.id),
          unitName: String(raw.unitName),
          templateName: String(raw.templateName),
          templateFrequency: String(raw.templateFrequency),
          dueDate: String(raw.dueDate),
          completedDate: raw.completedDate ? String(raw.completedDate) : null,
          passed: raw.passed === null || raw.passed === undefined ? null : Boolean(raw.passed),
          notes: raw.notes ? String(raw.notes) : null,
        }))
      );
      setTemplates(
        (templatesData.templates || []).map((raw: Record<string, unknown>) => ({
          id: String(raw.id),
          name: String(raw.name),
          frequency: String(raw.frequency),
          instanceCount: Number(raw.instanceCount ?? 0),
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['admin.checklists.error']);
    } finally {
      setLoading(false);
    }
  }, [labels]);

  useEffect(() => {
    void load();
  }, [load]);

  const createTemplate = async () => {
    if (!draft.templateName.trim()) return;
    setBusyId('template');
    setError(null);
    try {
      const response = await fetch('/api/admin/compliance-checklists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.templateName.trim(),
          frequency: draft.templateFrequency,
          items: [{ label: labels['admin.checklists.default_item'], required: true }],
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || labels['admin.checklists.error']);
      }
      setDraft((prev) => ({ ...prev, templateName: '' }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['admin.checklists.error']);
    } finally {
      setBusyId(null);
    }
  };

  const scheduleInstance = async () => {
    if (!draft.unitId || !draft.templateId || !draft.dueDate) return;
    setBusyId('schedule');
    setError(null);
    try {
      const response = await fetch('/api/admin/compliance-checklists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId: draft.unitId,
          templateId: draft.templateId,
          dueDate: draft.dueDate,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || labels['admin.checklists.error']);
      }
      setDraft((prev) => ({ ...prev, unitId: '', templateId: '', dueDate: '' }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['admin.checklists.error']);
    } finally {
      setBusyId(null);
    }
  };

  const markResult = async (instanceId: string, passed: boolean) => {
    setBusyId(instanceId);
    setError(null);
    try {
      const response = await fetch(`/api/admin/compliance-checklists/${instanceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passed }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || labels['admin.checklists.error']);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['admin.checklists.error']);
    } finally {
      setBusyId(null);
    }
  };

  const fieldClass =
    'h-40 px-12 rounded-sm bg-surface-paper border border-border-line text-small text-text-ink w-full';

  return (
    <div>
      {error && (
        <div className="bg-state-error-soft border border-state-error rounded-lg p-16 mb-24">
          <p className="text-body text-state-error">{error}</p>
        </div>
      )}

      <section className="bg-surface-paper border border-border-line rounded-lg p-24 mb-24">
        <h2 className="text-heading-3 font-semibold text-text-ink mb-16">
          {labels['admin.checklists.create_template']}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-16">
          <input
            type="text"
            value={draft.templateName}
            onChange={(e) => setDraft((prev) => ({ ...prev, templateName: e.target.value }))}
            placeholder={labels['admin.checklists.template_name']}
            className={fieldClass}
          />
          <select
            value={draft.templateFrequency}
            onChange={(e) => setDraft((prev) => ({ ...prev, templateFrequency: e.target.value }))}
            className={fieldClass}
          >
            <option value="weekly">{labels['admin.checklists.freq.weekly']}</option>
            <option value="monthly">{labels['admin.checklists.freq.monthly']}</option>
            <option value="quarterly">{labels['admin.checklists.freq.quarterly']}</option>
            <option value="annual">{labels['admin.checklists.freq.annual']}</option>
          </select>
          <Button size="sm" onClick={createTemplate} isLoading={busyId === 'template'}>
            {labels['admin.checklists.create_submit']}
          </Button>
        </div>
      </section>

      <section className="bg-surface-paper border border-border-line rounded-lg p-24 mb-24">
        <h2 className="text-heading-3 font-semibold text-text-ink mb-16">
          {labels['admin.checklists.schedule_title']}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-16">
          <select
            value={draft.unitId}
            onChange={(e) => setDraft((prev) => ({ ...prev, unitId: e.target.value }))}
            className={fieldClass}
          >
            <option value="">{labels['admin.checklists.select_unit']}</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
          <select
            value={draft.templateId}
            onChange={(e) => setDraft((prev) => ({ ...prev, templateId: e.target.value }))}
            className={fieldClass}
          >
            <option value="">{labels['admin.checklists.select_template']}</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} ({template.frequency})
              </option>
            ))}
          </select>
          <input
            type="date"
            value={draft.dueDate}
            onChange={(e) => setDraft((prev) => ({ ...prev, dueDate: e.target.value }))}
            className={fieldClass}
          />
        </div>
        <Button size="sm" onClick={scheduleInstance} isLoading={busyId === 'schedule'}>
          {labels['admin.checklists.schedule_submit']}
        </Button>
      </section>

      {loading ? (
        <p className="text-body text-text-secondary">{labels['admin.checklists.loading']}</p>
      ) : instances.length === 0 ? (
        <p className="text-body text-text-secondary">{labels['admin.checklists.empty']}</p>
      ) : (
        <div className="overflow-x-auto border border-border-line rounded-lg">
          <table className="w-full text-left text-small">
            <thead className="bg-surface-ivory border-b border-border-line">
              <tr>
                <th className="p-12 font-semibold">{labels['admin.checklists.col_unit']}</th>
                <th className="p-12 font-semibold">{labels['admin.checklists.col_template']}</th>
                <th className="p-12 font-semibold">{labels['admin.checklists.col_due']}</th>
                <th className="p-12 font-semibold">{labels['admin.checklists.col_result']}</th>
                <th className="p-12 font-semibold">{labels['admin.checklists.col_action']}</th>
              </tr>
            </thead>
            <tbody>
              {instances.map((row) => (
                <tr key={row.id} className="border-b border-border-line last:border-0">
                  <td className="p-12 text-text-ink">{row.unitName}</td>
                  <td className="p-12 text-text-secondary">
                    {row.templateName} · {row.templateFrequency}
                  </td>
                  <td className="p-12 text-text-secondary">
                    {new Date(row.dueDate).toLocaleDateString()}
                  </td>
                  <td className="p-12 text-text-secondary">
                    {row.passed === null
                      ? labels['admin.checklists.pending']
                      : row.passed
                        ? labels['admin.checklists.passed']
                        : labels['admin.checklists.failed']}
                  </td>
                  <td className="p-12">
                    {row.passed === null ? (
                      <div className="flex gap-8">
                        <Button
                          size="sm"
                          variant="secondary"
                          isLoading={busyId === row.id}
                          onClick={() => markResult(row.id, true)}
                        >
                          {labels['admin.checklists.mark_pass']}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          isLoading={busyId === row.id}
                          onClick={() => markResult(row.id, false)}
                        >
                          {labels['admin.checklists.mark_fail']}
                        </Button>
                      </div>
                    ) : (
                      '—'
                    )}
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
