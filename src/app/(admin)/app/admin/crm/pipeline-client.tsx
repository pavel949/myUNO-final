'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';

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
const ALL_STAGES = [...STAGES, 'won', 'lost'] as const;

const STAGE_BAR: Record<string, string> = {
  new: 'bg-chart-seq-1 text-text-ink',
  qualified: 'bg-chart-seq-2 text-text-ink',
  discovery: 'bg-chart-seq-3 text-surface-ivory',
  proposal: 'bg-chart-seq-4 text-surface-ivory',
  negotiation: 'bg-chart-seq-5 text-surface-ivory',
  nurture: 'bg-chart-seq-1 text-text-ink',
  won: 'bg-state-success text-surface-ivory',
  lost: 'bg-text-stone-2 text-text-ink',
};

const chipStatusVariant = 'status' as const;
const chipNeutralVariant = 'neutral' as const;
const overdueChip = 'declined' as const;

function typeChipStatus(type: string): 'checked_in' | 'pending_payment' | 'default' {
  if (type === 'purchase' || type === 'sale') return 'pending_payment';
  if (type === 'developer_advisory' || type === 'capex') return 'default';
  return 'checked_in';
}

function isOverdue(nextActionAt: string | null): boolean {
  return Boolean(nextActionAt && new Date(nextActionAt).getTime() < Date.now());
}

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
  const maxCount = Math.max(1, ...STAGES.map((stage) => summary[stage]?.count ?? 0));

  const stageLabel = (stage: string) => labels[`admin.crm.stage.${stage}`] || stage;
  const typeLabel = (type: string) => labels[`admin.crm.type.${type}`] || type.replace('_', ' ');

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
    const lostReason = stage === 'lost' ? window.prompt(labels['admin.crm.lost_reason']) : null;
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
      <section className="bg-surface-paper border border-border-line rounded-lg shadow-card p-24 mb-24">
        <h2 className="font-display text-title font-semibold text-text-ink mb-16">
          {labels['admin.crm.pipeline_breakdown']}
        </h2>
        <div className="flex flex-col gap-12">
          {STAGES.map((stage) => {
            const count = summary[stage]?.count ?? 0;
            const widthPct = Math.round((count / maxCount) * 100);
            return (
              <div key={stage} className="flex items-center gap-16">
                <span className="w-[110px] shrink-0 text-small text-text-stone font-display font-semibold">
                  {stageLabel(stage)}
                </span>
                <div className="flex-1 h-24 rounded-sm bg-surface-ivory overflow-hidden">
                  <div
                    className={`h-full min-w-0 flex items-center justify-center font-display text-small font-semibold tabular-nums ${STAGE_BAR[stage]}`}
                    style={{ width: `${Math.max(count > 0 ? 12 : 0, widthPct)}%` }}
                  >
                    {count > 0 ? count : null}
                  </div>
                </div>
                <span className="w-24 shrink-0 text-right font-display text-small font-medium tabular-nums text-text-ink">
                  ฿{(summary[stage]?.valueThb ?? 0).toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="mb-16">
        <Button variant="sun" onClick={() => setShowForm((value) => !value)}>
          {labels['admin.crm.new']}
        </Button>
      </div>
      {error ? <p className="text-state-error mb-16">{error}</p> : null}

      {showForm ? (
        <form
          onSubmit={submit}
          className="grid md:grid-cols-2 gap-16 bg-surface-paper border border-border-line rounded-lg shadow-card p-20 mb-24"
        >
          <Select
            required
            name="identityId"
            label={labels['admin.crm.contact']}
            options={contacts.map((c) => ({
              value: c.id,
              label: `${c.firstName} ${c.lastName} · ${c.email ?? c.phone ?? '—'}`,
            }))}
          />
          <Select
            required
            name="type"
            label={labels['admin.crm.type']}
            options={TYPES.map((type) => ({
              value: type,
              label: typeLabel(type),
            }))}
          />
          <Input required name="title" maxLength={240} label={labels['admin.crm.opportunity_title']} />
          <Input required name="source" maxLength={120} label={labels['admin.crm.source']} />
          <Input name="valueThb" type="number" min="0" label={labels['admin.crm.value']} />
          <Input name="nextActionAt" type="datetime-local" label={labels['admin.crm.next_action']} />
          <Input name="externalPartner" maxLength={240} label={labels['admin.crm.partner']} />
          <div className="flex items-end">
            <Button type="submit" variant="sun" isLoading={busy}>
              {labels['admin.crm.create']}
            </Button>
          </div>
        </form>
      ) : null}

      <div className="grid xl:grid-cols-3 gap-16">
        {opportunities.length === 0 ? (
          <p className="text-body text-text-stone">{labels['admin.crm.empty']}</p>
        ) : (
          opportunities.map((item) => {
            const overdue = isOverdue(item.nextActionAt);
            return (
              <article
                key={item.id}
                className="bg-surface-paper border border-border-line rounded-lg shadow-card p-20"
              >
                <div className="flex flex-wrap items-center justify-between gap-8 mb-8">
                  <Chip
                    variant={
                      typeChipStatus(item.type) === 'default' ? chipNeutralVariant : chipStatusVariant
                    }
                    status={
                      typeChipStatus(item.type) === 'default' ? undefined : typeChipStatus(item.type)
                    }
                  >
                    {typeLabel(item.type)}
                  </Chip>
                  <span className="text-small text-text-stone font-display tabular-nums">
                    {item.probability}%
                  </span>
                </div>
                <h2 className="font-display text-title font-semibold text-text-ink">{item.title}</h2>
                <p className="text-body text-text-stone">
                  {item.identity.firstName} {item.identity.lastName}
                </p>
                <p className="font-display text-subtitle font-medium tabular-nums text-text-ink mt-8">
                  ฿{(item.valueThb ?? 0).toLocaleString()}
                </p>
                <p className="text-small text-text-stone mt-4">{item.source}</p>
                {item.externalPartner ? (
                  <p className="text-small text-text-stone mt-4">
                    {labels['admin.crm.partner']}: {item.externalPartner}
                  </p>
                ) : null}
                {overdue ? (
                  <div className="mt-8">
                    <Chip variant={chipStatusVariant} status={overdueChip}>
                      {labels['admin.crm.next_action_overdue']}
                    </Chip>
                  </div>
                ) : null}
                <Select
                  disabled={busy}
                  value={item.stage}
                  onChange={(event) => move(item.id, event.target.value)}
                  className="mt-16"
                  options={ALL_STAGES.map((stage) => ({
                    value: stage,
                    label: stageLabel(stage),
                  }))}
                />
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
