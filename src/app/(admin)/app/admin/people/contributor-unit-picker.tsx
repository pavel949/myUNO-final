'use client';

import { useEffect, useState, useId } from 'react';

interface UnitOption { id: string; name: string }

export default function ContributorUnitPicker({ projectId, unitId, onChange, disabled, labels }: {
  projectId: string;
  unitId: string;
  onChange: (unitId: string) => void;
  disabled: boolean;
  labels: Record<string, string>;
}) {
  const pickerId = useId();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<UnitOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setItems([]);
    setLoading(true);
    setFailed(false);
    setHasMore(false);
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/admin/roles/units?${new URLSearchParams({ projectId, q: query })}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Unit lookup failed');
        const body = await response.json();
        if (!controller.signal.aborted) {
          setItems(body.items);
          setHasMore(body.hasMore === true);
        }
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [projectId, query, attempt]);

  return <>
    <label htmlFor={`${pickerId}-search`} className="text-small text-text-secondary">
      {labels['admin.people.unit_search']}
    </label>
    <input
      id={`${pickerId}-search`}
      placeholder={labels['admin.people.unit_search']}
      value={query}
      maxLength={200}
      disabled={disabled || !projectId}
      onChange={event => {
        setQuery(event.target.value);
        setItems([]);
        setLoading(true);
        onChange('');
      }}
      className="h-48 rounded-sm border border-border-line bg-surface-ivory px-12 text-body text-text-ink"
    />
    <label htmlFor={`${pickerId}-unit`} className="text-small text-text-secondary">
      {labels['admin.people.unit']}
    </label>
    <select
      id={`${pickerId}-unit`}
      value={unitId}
      disabled={disabled || loading || failed || !projectId}
      onChange={event => onChange(event.target.value)}
      className="h-48 rounded-sm border border-border-line bg-surface-ivory px-12 text-body text-text-ink"
    >
      <option value="">{labels['admin.people.unit_choose']}</option>
      {items.map(unit => <option key={unit.id} value={unit.id}>{unit.name} · {unit.id}</option>)}
    </select>
    <p role="status" className="text-small text-text-secondary">
      {loading ? labels['admin.people.units_loading'] : failed ? labels['admin.people.units_error'] :
        items.length === 0 ? labels['admin.people.units_none'] : hasMore ? labels['admin.people.units_refine'] : null}
    </p>
    {failed && <button type="button" disabled={disabled} onClick={() => setAttempt(value => value + 1)}
      className="text-small text-brand-andaman underline">{labels['admin.people.units_retry']}</button>}
  </>;
}
