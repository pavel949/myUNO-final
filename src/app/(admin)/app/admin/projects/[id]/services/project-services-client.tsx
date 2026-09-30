'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';

type Row = {
  id: string;
  title: string;
  providerName: string;
  categoryKey: string;
  scope: 'global' | 'restricted_here' | 'restricted_elsewhere';
  projectCount: number;
  basePriceThb: number | null;
  baseLeadTimeHours: number;
  priceOverrideThb: number | null;
  leadTimeHours: number | null;
  takeRatePct: string | null;
  termsVersion: number | null;
  enabledHere: boolean | null;
  publicHere: boolean | null;
};

export default function ProjectServicesClient({
  projectId,
  services,
  labels,
}: {
  projectId: string;
  services: Row[];
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [terms, setTerms] = useState<Record<string, { price: string; lead: string; take: string }>>(
    Object.fromEntries(services.map(service => [service.id, {
      price: service.priceOverrideThb === null ? '' : String(service.priceOverrideThb / 100),
      lead: service.leadTimeHours === null ? '' : String(service.leadTimeHours),
      take: service.takeRatePct ?? '',
    }]))
  );

  const act = async (serviceId: string, action: string, extra: Record<string, unknown> = {}) => {
    setBusy(serviceId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/projects/${projectId}/services`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId, action, ...extra }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || labels['admin.project_services.error']);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['admin.project_services.error']);
    } finally {
      setBusy(null);
    }
  };

  return <div className="space-y-12">
    {error && <div className="rounded-lg border border-state-error bg-state-error-soft p-16 text-small text-state-error">{error}</div>}
    {services.map(service => (
      <article key={service.id} className="rounded-xl border border-border-line bg-surface-paper p-16">
        <div className="flex flex-col gap-12 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-semibold text-text-ink">{service.title}</h2>
            <p className="mt-4 text-small text-text-secondary">
              {service.providerName} · {service.categoryKey.replace(/_/g, ' ')}
            </p>
            <p className="mt-4 text-small text-text-secondary">
              {service.scope === 'global'
                ? labels['admin.project_services.global']
                : service.scope === 'restricted_here'
                  ? labels['admin.project_services.restricted_here'].replace('{count}', String(service.projectCount))
                  : labels['admin.project_services.restricted_elsewhere'].replace('{count}', String(service.projectCount))}
            </p>
          </div>
          <div className="flex flex-wrap gap-8">
            {service.scope === 'restricted_elsewhere' && (
              <Button size="sm" onClick={() => act(service.id, 'add')} isLoading={busy === service.id}>
                {labels['admin.project_services.add']}
              </Button>
            )}
            {service.scope === 'restricted_here' && (
              <>
                <div className="w-full rounded-lg bg-surface-ivory p-12">
                  <p className="text-small text-text-secondary">
                    {labels['admin.project_services.base_price']}: {service.basePriceThb === null ? '—' : `฿${(service.basePriceThb / 100).toLocaleString()}`}
                    {' · '}
                    {labels['admin.project_services.lead_time']}: {service.baseLeadTimeHours}h
                    {service.termsVersion !== null ? ` · v${service.termsVersion}` : ''}
                  </p>
                  <div className="mt-8 grid gap-8 sm:grid-cols-3">
                    <label className="text-small text-text-secondary">
                      {labels['admin.project_services.price_override']}
                      <input type="number" min="0.01" step="0.01"
                        value={terms[service.id]?.price ?? ''}
                        placeholder={labels['admin.project_services.inherit']}
                        onChange={e => setTerms(prev => ({ ...prev, [service.id]: { ...prev[service.id], price: e.target.value } }))}
                        className="mt-4 h-40 w-full rounded-sm border border-border-line bg-surface-paper px-8 text-text-ink" />
                    </label>
                    <label className="text-small text-text-secondary">
                      {labels['admin.project_services.lead_time']}
                      <input type="number" min="0" max="720" step="1"
                        value={terms[service.id]?.lead ?? ''}
                        placeholder={labels['admin.project_services.inherit']}
                        onChange={e => setTerms(prev => ({ ...prev, [service.id]: { ...prev[service.id], lead: e.target.value } }))}
                        className="mt-4 h-40 w-full rounded-sm border border-border-line bg-surface-paper px-8 text-text-ink" />
                    </label>
                    <label className="text-small text-text-secondary">
                      {labels['admin.project_services.take_rate']}
                      <input type="number" min="0" max="100" step="0.01"
                        value={terms[service.id]?.take ?? ''}
                        placeholder={labels['admin.project_services.inherit']}
                        onChange={e => setTerms(prev => ({ ...prev, [service.id]: { ...prev[service.id], take: e.target.value } }))}
                        className="mt-4 h-40 w-full rounded-sm border border-border-line bg-surface-paper px-8 text-text-ink" />
                    </label>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => act(service.id, 'update_terms', {
                    priceOverrideBaht: terms[service.id]?.price ?? '',
                    leadTimeHours: terms[service.id]?.lead ?? '',
                    takeRatePct: terms[service.id]?.take ?? '',
                  })} isLoading={busy === service.id}>
                    {labels['admin.project_services.save_terms']}
                  </Button>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => act(service.id, 'set_visibility', {
                    enabled: !service.enabledHere,
                    public: service.publicHere ?? true,
                  })}
                  isLoading={busy === service.id}
                >
                  {service.enabledHere ? labels['admin.project_services.disable'] : labels['admin.project_services.enable']}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => act(service.id, 'set_visibility', {
                    enabled: service.enabledHere ?? true,
                    public: !service.publicHere,
                  })}
                  isLoading={busy === service.id}
                >
                  {service.publicHere ? labels['admin.project_services.hide'] : labels['admin.project_services.show']}
                </Button>
                {service.projectCount > 1 && (
                  <Button size="sm" variant="ghost" onClick={() => act(service.id, 'remove')} isLoading={busy === service.id}>
                    {labels['admin.project_services.remove']}
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => {
                  if (window.confirm(labels['admin.project_services.global_confirm'])) {
                    act(service.id, 'make_global');
                  }
                }} isLoading={busy === service.id}>
                  {labels['admin.project_services.make_global']}
                </Button>
              </>
            )}
          </div>
        </div>
      </article>
    ))}
  </div>;
}
