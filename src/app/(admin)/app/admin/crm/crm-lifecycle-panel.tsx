'use client';

import { useCallback, useEffect, useState } from 'react';

interface PipelineProfile {
  id: string;
  email: string | null;
  stage: string;
  leadScore: number | null;
  totalValue: number;
}

interface PipelineStage {
  stage: string;
  count: number;
  totalValue: number;
  profiles: PipelineProfile[];
}

interface CrmLifecyclePanelProps {
  labels: Record<string, string>;
}

export default function CrmLifecyclePanel({ labels }: CrmLifecyclePanelProps) {
  const [pipeline, setPipeline] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedStage, setExpandedStage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/crm/pipeline?limit=100');
      if (!response.ok) throw new Error(labels['admin.crm.lifecycle.error']);
      const data = await response.json();
      setPipeline(Array.isArray(data.pipeline) ? data.pipeline : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['admin.crm.lifecycle.error']);
      setPipeline([]);
    } finally {
      setLoading(false);
    }
  }, [labels]);

  useEffect(() => {
    void load();
  }, [load]);

  const transition = async (profileId: string, toStage: string) => {
    const reason = window.prompt(labels['admin.crm.lifecycle.reason_prompt']);
    if (!reason?.trim()) return;

    setBusyId(profileId);
    setError(null);
    try {
      const response = await fetch(`/api/admin/crm/profiles/${profileId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_stage: toStage, reason: reason.trim() }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || labels['admin.crm.lifecycle.error']);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['admin.crm.lifecycle.error']);
    } finally {
      setBusyId(null);
    }
  };

  const stageLabel = (stage: string) => labels[`admin.crm.lifecycle.stage.${stage}`] || stage;

  if (loading) {
    return (
      <p className="text-body text-text-secondary mb-24">{labels['admin.crm.lifecycle.loading']}</p>
    );
  }

  return (
    <section className="mb-32">
      <h2 className="text-heading-2 font-bold text-text-ink mb-8">
        {labels['admin.crm.lifecycle.title']}
      </h2>
      <p className="text-body text-text-secondary mb-16">{labels['admin.crm.lifecycle.subtitle']}</p>

      {error && (
        <div className="bg-state-error-soft border border-state-error rounded-lg p-16 mb-16">
          <p className="text-body text-state-error">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-12">
        {pipeline
          .filter((stage) => stage.count > 0)
          .map((stage) => (
            <button
              key={stage.stage}
              type="button"
              onClick={() =>
                setExpandedStage(expandedStage === stage.stage ? null : stage.stage)
              }
              className={
                expandedStage === stage.stage
                  ? 'bg-brand-andaman text-on-dark-text rounded-lg p-16 text-left'
                  : 'bg-surface-paper border border-border-line rounded-lg p-16 text-left hover:border-brand-andaman'
              }
            >
              <p className="text-caption opacity-80">{stageLabel(stage.stage)}</p>
              <p className="text-heading-3 font-bold">{stage.count}</p>
              <p className="text-small opacity-80">
                ฿{stage.totalValue.toLocaleString()}
              </p>
            </button>
          ))}
      </div>

      {expandedStage && (
        <div className="mt-16 border border-border-line rounded-lg overflow-hidden">
          <table className="w-full text-left text-small">
            <thead className="bg-surface-ivory">
              <tr>
                <th className="p-12">{labels['admin.crm.lifecycle.col_email']}</th>
                <th className="p-12">{labels['admin.crm.lifecycle.col_value']}</th>
                <th className="p-12">{labels['admin.crm.lifecycle.col_score']}</th>
                <th className="p-12">{labels['admin.crm.lifecycle.col_action']}</th>
              </tr>
            </thead>
            <tbody>
              {pipeline
                .find((s) => s.stage === expandedStage)
                ?.profiles.map((profile) => (
                  <tr key={profile.id} className="border-t border-border-line">
                    <td className="p-12">{profile.email || '—'}</td>
                    <td className="p-12">฿{profile.totalValue.toLocaleString()}</td>
                    <td className="p-12">{profile.leadScore ?? '—'}</td>
                    <td className="p-12">
                      <select
                        className="h-36 px-8 rounded-sm border border-border-line text-small"
                        defaultValue=""
                        disabled={busyId === profile.id}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value) void transition(profile.id, value);
                          e.target.value = '';
                        }}
                      >
                        <option value="">{labels['admin.crm.lifecycle.move_to']}</option>
                        {[
                          'contact',
                          'guest',
                          'repeat',
                          'prospect',
                          'investor',
                          'buyer',
                          'owner',
                          'managed',
                          'seller',
                          'former_client',
                        ]
                          .filter((s) => s !== expandedStage)
                          .map((s) => (
                            <option key={s} value={s}>
                              {stageLabel(s)}
                            </option>
                          ))}
                      </select>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
