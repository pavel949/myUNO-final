'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';

type Contact = { id: string; firstName: string; lastName: string; email: string | null; phone: string | null };
type Opportunity = {
  id: string;
  identityId: string;
  type: string;
  stage: string;
  title: string;
  source: string;
  valueThb: number | null;
  probability: number;
  nextActionAt: string | null;
  externalPartner: string | null;
  identity: Contact;
};

const STAGES = ['new', 'qualified', 'discovery', 'proposal', 'negotiation', 'nurture'] as const;
const TYPES = ['rental', 'purchase', 'sale', 'management', 'developer_advisory', 'capex', 'compliance'] as const;

export default function CrmPipelineClient({
  opportunities,
  counts,
  contacts,
  labels,
}: {
  opportunities: Opportunity[];
  counts: { stage: string; count: number; valueThb: number }[];
  contacts: Contact[];
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const summary = useMemo(() => Object.fromEntries(counts.map((c) => [c.stage, c])), [counts]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const data = new FormData(event.currentTarget);
    const response = await fetch('/api/admin/crm/opportunities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identityId: data.get('identityId'),
        type: data.get('type'),
        title: data.get('title'),
        source: data.get('source'),
        valueThb: data.get('valueThb') ? Number(data.get('valueThb')) : null,
        nextActionAt: data.get('nextActionAt') || null,
        externalPartner: data.get('externalPartner') || null,
      }),
    });
    setBusy(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error || labels['admin.crm.error']);
      return;
    }
    setShowForm(false);
    router.refresh();
  }

  async function move(id: string, stage: string) {
    setBusy(true);
    setError(null);
    const lostReason = stage === 'lost' ? window.prompt('Reason for loss') : null;
    if (stage === 'lost' && !lostReason?.trim()) {
      setBusy(false);
      return;
    }
    const response = await fetch(`/api/admin/crm/opportunities/${id}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage, lostReason }),
    });
    setBusy(false);
    if (!response.ok) setError(labels['admin.crm.error']);
    else router.refresh();
  }

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-12 mb-24">
        {STAGES.map((stage) => (
          <div key={stage} className="bg-surface-paper border border-border-line rounded-lg p-16">
            <p className="text-small text-text-secondary capitalize">{stage.replace('_', ' ')}</p>
            <p className="text-heading-3 font-bold text-text-ink">{summary[stage]?.count ?? 0}</p>
            <p className="text-small text-text-secondary">฿{(summary[stage]?.valueThb ?? 0).toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="mb-16">
        <Button variant="sun" onClick={() => setShowForm((value) => !value)}>{labels['admin.crm.new']}</Button>
      </div>
      {error ? <p className="text-state-error mb-16">{error}</p> : null}

      {showForm ? (
        <form onSubmit={submit} className="grid md:grid-cols-2 gap-12 bg-surface-paper border border-border-line rounded-lg p-20 mb-24">
          <label className="text-small">{labels['admin.crm.contact']}<select required name="identityId" className="block w-full h-40 mt-4 px-8 border border-border-line rounded-sm"><option value="" />{contacts.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName} · {c.email ?? c.phone ?? '—'}</option>)}</select></label>
          <label className="text-small">{labels['admin.crm.type']}<select required name="type" className="block w-full h-40 mt-4 px-8 border border-border-line rounded-sm">{TYPES.map((type) => <option key={type} value={type}>{type.replace('_', ' ')}</option>)}</select></label>
          <label className="text-small">{labels['admin.crm.opportunity_title']}<input required name="title" maxLength={240} className="block w-full h-40 mt-4 px-8 border border-border-line rounded-sm" /></label>
          <label className="text-small">{labels['admin.crm.source']}<input required name="source" maxLength={120} className="block w-full h-40 mt-4 px-8 border border-border-line rounded-sm" /></label>
          <label className="text-small">{labels['admin.crm.value']}<input name="valueThb" type="number" min="0" className="block w-full h-40 mt-4 px-8 border border-border-line rounded-sm" /></label>
          <label className="text-small">{labels['admin.crm.next_action']}<input name="nextActionAt" type="datetime-local" className="block w-full h-40 mt-4 px-8 border border-border-line rounded-sm" /></label>
          <label className="text-small">{labels['admin.crm.partner']}<input name="externalPartner" maxLength={240} className="block w-full h-40 mt-4 px-8 border border-border-line rounded-sm" /></label>
          <div className="flex items-end"><Button type="submit" variant="sun" isLoading={busy}>{labels['admin.crm.create']}</Button></div>
        </form>
      ) : null}

      <div className="grid xl:grid-cols-3 gap-16">
        {opportunities.length === 0 ? <p>{labels['admin.crm.empty']}</p> : opportunities.map((item) => (
          <article key={item.id} className="bg-surface-paper border border-border-line rounded-lg p-20">
            <div className="flex justify-between gap-8 mb-8"><span className="text-small uppercase tracking-wide text-text-secondary">{item.type.replace('_', ' ')}</span><span className="text-small font-semibold">{item.stage}</span></div>
            <h2 className="text-heading-3 font-semibold text-text-ink">{item.title}</h2>
            <p className="text-body text-text-secondary">{item.identity.firstName} {item.identity.lastName}</p>
            <p className="text-small text-text-secondary mt-8">{item.source} · {item.probability}% · ฿{(item.valueThb ?? 0).toLocaleString()}</p>
            {item.externalPartner ? <p className="text-small mt-4">Partner: {item.externalPartner}</p> : null}
            <select disabled={busy} value={item.stage} onChange={(event) => move(item.id, event.target.value)} className="w-full h-40 mt-16 px-8 border border-border-line rounded-sm">
              {STAGES.map((stage) => <option key={stage} value={stage}>{stage.replace('_', ' ')}</option>)}
              <option value="won">won</option><option value="lost">lost</option>
            </select>
          </article>
        ))}
      </div>
    </div>
  );
}
