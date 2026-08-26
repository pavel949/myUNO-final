'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { LoadingState, ErrorState } from '@/components/StateComponents';

/**
 * Manual availability & pricing overrides for one unit (doc 07 F-OPS-4, Q53).
 *
 * Shared by the staff ops calendar (`/ops/calendar/[unitId]`) and the admin
 * unit workspace (`/app/admin/units/[id]`) — same component, same content
 * keys, because it is the same capability (doc 03: "Manage availability
 * blocks & pricing rules") reached from two surfaces doc 08 §5/§6 both name.
 * It manages its own data: fetches the unit's blocks and pricing rules on
 * mount and after every mutation, so either host page only needs to render
 * `<AvailabilityPricingPanel unitId={...} labels={...} />`.
 */

const MANUAL_REASONS = ['maintenance', 'owner_hold', 'other'] as const;
type ManualReason = (typeof MANUAL_REASONS)[number];

interface BlockRow {
  id: string;
  startDate: string;
  endDate: string;
  reason: string;
  note: string | null;
  externalRef?: string | null;
}

interface RuleRow {
  id: string;
  startDate: string;
  endDate: string;
  nightlyThb: number;
  label: string | null;
  minNightsOverride: number | null;
}

type Labels = Record<string, string>;

export default function AvailabilityPricingPanel({
  unitId,
  labels,
}: {
  unitId: string;
  labels: Labels;
}) {
  const [blocks, setBlocks] = useState<BlockRow[] | null>(null);
  const [rules, setRules] = useState<RuleRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [blocksRes, rulesRes] = await Promise.all([
        fetch(`/api/units/${unitId}/availability-blocks`),
        fetch(`/api/units/${unitId}/pricing-rules`),
      ]);
      if (!blocksRes.ok || !rulesRes.ok) {
        throw new Error(labels['staff.calendar.error_generic']);
      }
      const blocksData = await blocksRes.json();
      const rulesData = await rulesRes.json();
      setBlocks(blocksData.blocks);
      setRules(rulesData.rules);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : labels['staff.calendar.error_generic']);
    }
  }, [unitId, labels]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (key: string, fn: () => Promise<Response>) => {
    setBusy(key);
    setActionError(null);
    try {
      const response = await fn();
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || labels['staff.calendar.error_generic']);
      }
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : labels['staff.calendar.error_generic']);
    } finally {
      setBusy(null);
    }
  };

  const post = (url: string, body: unknown) =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  if (blocks === null || rules === null) {
    if (loadError) {
      return <ErrorState title={loadError} onRetry={load} />;
    }
    return <LoadingState message={labels['staff.calendar.loading']} />;
  }

  return (
    <div className="space-y-32">
      <h2 className="text-heading-3 font-bold text-text-ink">
        {labels['staff.calendar.title']}
      </h2>
      <p className="text-small text-text-secondary -mt-16">
        {labels['staff.calendar.intro']}
      </p>

      {actionError && (
        <div className="bg-state-error/10 border border-state-error rounded-lg p-16">
          <p className="text-body text-state-error">{actionError}</p>
        </div>
      )}

      {/* Availability blocks */}
      <section className="bg-surface-paper border border-border-line rounded-lg p-24">
        <h3 className="text-subtitle font-semibold text-text-ink mb-16">
          {labels['staff.calendar.blocks_title']}
        </h3>

        {blocks.length === 0 ? (
          <p className="text-body text-text-secondary mb-16">
            {labels['staff.calendar.blocks_none']}
          </p>
        ) : (
          <ul className="mb-16 space-y-8">
            {blocks.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center gap-12 border-b border-border-line pb-8 last:border-0"
              >
                <span className="flex-1 min-w-32 text-body text-text-ink">
                  {b.startDate} → {b.endDate} ·{' '}
                  {labels[`staff.calendar.reason.${b.reason}`] || b.reason}
                  {b.note && ` · ${b.note}`}
                </span>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy === b.id}
                  onClick={() =>
                    act(b.id, () =>
                      fetch(`/api/units/${unitId}/availability-blocks/${b.id}`, {
                        method: 'DELETE',
                      })
                    )
                  }
                >
                  {busy === b.id
                    ? labels['staff.calendar.saving']
                    : labels['staff.calendar.remove']}
                </Button>
              </li>
            ))}
          </ul>
        )}

        <form
          className="flex flex-wrap gap-12 items-end"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget as HTMLFormElement);
            const startDate = String(form.get('startDate') || '');
            const endDate = String(form.get('endDate') || '');
            const reason = String(form.get('reason') || '') as ManualReason;
            const note = String(form.get('note') || '').trim();
            if (!startDate || !endDate) return;
            act('block', () =>
              post(`/api/units/${unitId}/availability-blocks`, {
                startDate,
                endDate,
                reason,
                note: note || undefined,
              })
            ).then(() => {
              (event.currentTarget as HTMLFormElement).reset();
            });
          }}
        >
          <label className="text-small text-text-secondary">
            {labels['staff.calendar.start_date']}
            <input
              name="startDate"
              type="date"
              required
              className="block h-40 mt-4 rounded-sm border border-border-line px-12 text-body text-text-ink"
            />
          </label>
          <label className="text-small text-text-secondary">
            {labels['staff.calendar.end_date']}
            <input
              name="endDate"
              type="date"
              required
              className="block h-40 mt-4 rounded-sm border border-border-line px-12 text-body text-text-ink"
            />
          </label>
          <label className="text-small text-text-secondary">
            {labels['staff.calendar.reason_field']}
            <select
              name="reason"
              required
              className="block h-40 mt-4 rounded-sm border border-border-line px-12 text-body text-text-ink"
            >
              {MANUAL_REASONS.map((r) => (
                <option key={r} value={r}>
                  {labels[`staff.calendar.reason.${r}`] || r}
                </option>
              ))}
            </select>
          </label>
          <label className="text-small text-text-secondary">
            {labels['staff.calendar.note']}
            <input
              name="note"
              className="block h-40 w-64 mt-4 rounded-sm border border-border-line px-12 text-body text-text-ink"
            />
          </label>
          <Button type="submit" disabled={busy === 'block'}>
            {busy === 'block' ? labels['staff.calendar.saving'] : labels['staff.calendar.add_block']}
          </Button>
        </form>
      </section>

      {/* Pricing overrides */}
      <section className="bg-surface-paper border border-border-line rounded-lg p-24">
        <h3 className="text-subtitle font-semibold text-text-ink mb-16">
          {labels['staff.calendar.pricing_title']}
        </h3>

        {rules.length === 0 ? (
          <p className="text-body text-text-secondary mb-16">
            {labels['staff.calendar.pricing_none']}
          </p>
        ) : (
          <ul className="mb-16 space-y-8">
            {rules.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-12 border-b border-border-line pb-8 last:border-0"
              >
                <span className="flex-1 min-w-32 text-body text-text-ink">
                  {r.startDate} → {r.endDate} · ฿{(r.nightlyThb / 100).toLocaleString()}
                  {labels['staff.calendar.per_night']}
                  {r.label && ` · ${r.label}`}
                </span>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy === r.id}
                  onClick={() =>
                    act(r.id, () =>
                      fetch(`/api/units/${unitId}/pricing-rules/${r.id}`, { method: 'DELETE' })
                    )
                  }
                >
                  {busy === r.id
                    ? labels['staff.calendar.saving']
                    : labels['staff.calendar.remove']}
                </Button>
              </li>
            ))}
          </ul>
        )}

        <form
          className="flex flex-wrap gap-12 items-end"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget as HTMLFormElement);
            const startDate = String(form.get('startDate') || '');
            const endDate = String(form.get('endDate') || '');
            const nightlyBaht = String(form.get('nightlyBaht') || '').trim();
            const label = String(form.get('label') || '').trim();
            if (!startDate || !endDate || !nightlyBaht) return;
            act('rule', () =>
              post(`/api/units/${unitId}/pricing-rules`, {
                startDate,
                endDate,
                // Display boundary: the form takes baht; every stored amount
                // is satang (THB × 100), like every other money field
                // (CLAUDE.md money rules) — convert once, here.
                nightlyThb: Math.round(Number(nightlyBaht) * 100),
                label: label || undefined,
              })
            ).then(() => {
              (event.currentTarget as HTMLFormElement).reset();
            });
          }}
        >
          <label className="text-small text-text-secondary">
            {labels['staff.calendar.start_date']}
            <input
              name="startDate"
              type="date"
              required
              className="block h-40 mt-4 rounded-sm border border-border-line px-12 text-body text-text-ink"
            />
          </label>
          <label className="text-small text-text-secondary">
            {labels['staff.calendar.end_date']}
            <input
              name="endDate"
              type="date"
              required
              className="block h-40 mt-4 rounded-sm border border-border-line px-12 text-body text-text-ink"
            />
          </label>
          <label className="text-small text-text-secondary">
            {labels['staff.calendar.nightly_rate']}
            <input
              name="nightlyBaht"
              type="number"
              min="1"
              step="any"
              required
              className="block h-40 w-48 mt-4 rounded-sm border border-border-line px-12 text-body text-text-ink"
            />
          </label>
          <label className="text-small text-text-secondary">
            {labels['staff.calendar.label']}
            <input
              name="label"
              className="block h-40 w-64 mt-4 rounded-sm border border-border-line px-12 text-body text-text-ink"
            />
          </label>
          <Button type="submit" disabled={busy === 'rule'}>
            {busy === 'rule' ? labels['staff.calendar.saving'] : labels['staff.calendar.add_rule']}
          </Button>
        </form>
      </section>
    </div>
  );
}
