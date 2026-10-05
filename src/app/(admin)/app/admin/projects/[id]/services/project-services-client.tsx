/* eslint-disable local-rules/no-literal-ui-text */
'use client';


import { UI_LOCALE } from '@/lib/format';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';

type Row = {
  id: string;
  title: string;
  providerName: string;
  categoryKey: string;
  basePriceThb: number | null;
  baseLeadTimeHours: number;
  priceOverrideThb: number | null;
  leadTimeHours: number | null;
  takeRatePct: string | null;
  termsVersion: number | null;
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
  const [message, setMessage] = useState<string | null>(null);
  const [terms, setTerms] = useState<Record<string, { price: string; lead: string; take: string }>>(
    Object.fromEntries(services.map(service => [service.id, {
      price: service.priceOverrideThb === null ? '' : String(service.priceOverrideThb / 100),
      lead: service.leadTimeHours === null ? '' : String(service.leadTimeHours),
      take: service.takeRatePct ?? '',
    }]))
  );

  const act = async (serviceId: string, action: 'update_terms' | 'clear_override') => {
    setBusy(serviceId); setMessage(null);
    const current = terms[serviceId] || { price: '', lead: '', take: '' };
    const res = await fetch(`/api/admin/projects/${projectId}/services`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceId,
        action,
        ...(action === 'update_terms' ? {
          priceOverrideBaht: current.price,
          leadTimeHours: current.lead,
          takeRatePct: current.take,
        } : {}),
      }),
    });
    const data = await res.json().catch(() => null);
    setMessage(res.ok ? labels['admin.project_services.saved'] : data?.error || labels['admin.project_services.error']);
    if (res.ok) router.refresh();
    setBusy(null);
  };

  return <div className="space-y-12">
    {message ? <div className="rounded-lg bg-surface-muted p-12 text-small">{message}</div> : null}
    {services.map(service => {
      const hasOverride = service.priceOverrideThb !== null || service.leadTimeHours !== null || service.takeRatePct !== null;
      return <article key={service.id} className="rounded-md border border-border-line bg-surface-paper p-16">
        <div className="flex flex-col gap-12 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 xl:w-[288px]">
            <h2 className="font-semibold text-text-ink">{service.title}</h2>
            <p className="mt-4 text-small text-text-secondary">{service.providerName} · {service.categoryKey.replace(/_/g, ' ')}</p>
            <p className="mt-8 text-small text-text-secondary">
              {labels['admin.project_services.base_price']}: {service.basePriceThb === null ? 'quote' : `฿${(service.basePriceThb / 100).toLocaleString(UI_LOCALE)}`} · {service.baseLeadTimeHours}h
            </p>
            {hasOverride ? <span className="mt-8 inline-flex rounded-full bg-brand-sand px-8 py-4 text-small">Project preference{service.termsVersion ? ` · v${service.termsVersion}` : ''}</span> : null}
          </div>
          <div className="grid flex-1 gap-8 sm:grid-cols-3">
            <label className="text-small text-text-secondary">{labels['admin.project_services.price_override']}
              <input type="number" min="0.01" step="0.01" value={terms[service.id]?.price ?? ''} placeholder={labels['admin.project_services.inherit']} onChange={e => setTerms(prev => ({...prev,[service.id]:{...prev[service.id],price:e.target.value}}))} className="mt-4 h-40 w-full rounded-md border border-border-line px-8"/>
            </label>
            <label className="text-small text-text-secondary">{labels['admin.project_services.lead_time']}
              <input type="number" min="0" max="720" step="1" value={terms[service.id]?.lead ?? ''} placeholder={labels['admin.project_services.inherit']} onChange={e => setTerms(prev => ({...prev,[service.id]:{...prev[service.id],lead:e.target.value}}))} className="mt-4 h-40 w-full rounded-md border border-border-line px-8"/>
            </label>
            <label className="text-small text-text-secondary">{labels['admin.project_services.take_rate']}
              <input type="number" min="0" max="100" step="0.01" value={terms[service.id]?.take ?? ''} placeholder={labels['admin.project_services.inherit']} onChange={e => setTerms(prev => ({...prev,[service.id]:{...prev[service.id],take:e.target.value}}))} className="mt-4 h-40 w-full rounded-md border border-border-line px-8"/>
            </label>
          </div>
          <div className="flex shrink-0 gap-8">
            <Button size="sm" onClick={() => act(service.id,'update_terms')} isLoading={busy===service.id}>{labels['admin.project_services.save_terms']}</Button>
            {hasOverride ? <Button size="sm" variant="secondary" onClick={() => act(service.id,'clear_override')} isLoading={busy===service.id}>{labels['admin.project_services.clear']}</Button> : null}
          </div>
        </div>
      </article>;
    })}
  </div>;
}
