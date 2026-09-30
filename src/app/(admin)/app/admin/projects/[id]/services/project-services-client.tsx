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
