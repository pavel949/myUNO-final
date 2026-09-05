'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/Button';

interface ContractRow {
  id: string;
  unitId: string;
  unitName: string;
  projectId: string;
  projectName: string;
  ownerIdentityId: string;
  ownerName: string;
  managementFeeBasis: string;
  managementFeeRate: number | null;
  managementFeeFixedAmount: number | null;
  performanceFeeEnabled: boolean;
  status: string;
  contractStartDate: string;
  contractEndDate: string | null;
}

interface FeeRow {
  id: string;
  feeType: string;
  periodStart: string;
  periodEnd: string;
  calculationBasis: string;
  amount: number;
  status: string;
}

type Labels = Record<string, string>;

const FEE_BASES = [
  'percentage_gop',
  'percentage_noi',
  'percentage_gross_booking',
  'fixed',
] as const;

export default function AdminContractsClient({
  labels,
  projects,
  units,
}: {
  labels: Labels;
  projects: Array<{ id: string; name: string }>;
  units: Array<{
    id: string;
    name: string;
    projectId: string;
    ownerIdentityId: string;
    ownerLabel: string;
  }>;
}) {
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fees, setFees] = useState<FeeRow[]>([]);
  const [feesLoading, setFeesLoading] = useState(false);
  const [calcDraft, setCalcDraft] = useState({
    periodStart: '',
    periodEnd: '',
    gop: '',
    noi: '',
    grossBooking: '',
  });

  const [draft, setDraft] = useState({
    projectId: projects[0]?.id ?? '',
    unitId: '',
    managementFeeBasis: 'percentage_noi' as (typeof FEE_BASES)[number],
    managementFeeRate: '0.15',
    managementFeeFixedAmount: '',
    performanceFeeEnabled: false,
    performanceFeeRate: '0.10',
    performanceFeeBaseline: '',
    contractStartDate: new Date().toISOString().slice(0, 10),
    contractEndDate: '',
  });

  const unitsForProject = useMemo(
    () => units.filter((u) => u.projectId === draft.projectId),
    [units, draft.projectId]
  );

  const selectedUnit = unitsForProject.find((u) => u.id === draft.unitId);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/contracts');
      if (!response.ok) throw new Error(labels['admin.contracts.error']);
      const data = await response.json();
      setContracts(Array.isArray(data.contracts) ? data.contracts : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['admin.contracts.error']);
      setContracts([]);
    } finally {
      setLoading(false);
    }
  }, [labels]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadFees = useCallback(
    async (contractId: string) => {
      setFeesLoading(true);
      try {
        const response = await fetch(`/api/admin/fees/${contractId}`);
        if (!response.ok) throw new Error(labels['admin.contracts.error']);
        const data = await response.json();
        setFees(Array.isArray(data.fees) ? data.fees : []);
      } catch {
        setFees([]);
      } finally {
        setFeesLoading(false);
      }
    },
    [labels]
  );

  const openFees = (contractId: string) => {
    setSelectedId(contractId);
    void loadFees(contractId);
  };

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedUnit) return;
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        projectId: draft.projectId,
        unitId: draft.unitId,
        ownerIdentityId: selectedUnit.ownerIdentityId,
        managementFeeBasis: draft.managementFeeBasis,
        contractStartDate: draft.contractStartDate,
        contractEndDate: draft.contractEndDate || undefined,
        performanceFeeEnabled: draft.performanceFeeEnabled,
      };
      if (draft.managementFeeBasis === 'fixed') {
        body.managementFeeFixedAmount = Number(draft.managementFeeFixedAmount);
      } else {
        body.managementFeeRate = Number(draft.managementFeeRate);
      }
      if (draft.performanceFeeEnabled) {
        body.performanceFeeRate = Number(draft.performanceFeeRate);
        body.performanceFeeBaseline = Number(draft.performanceFeeBaseline);
        body.performanceFeeBasis = 'noi_excess';
      }

      const response = await fetch('/api/admin/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || labels['admin.contracts.error']);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['admin.contracts.error']);
    } finally {
      setBusy(false);
    }
  };

  const calculate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/fees/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractId: selectedId,
          periodStart: calcDraft.periodStart,
          periodEnd: calcDraft.periodEnd,
          gop: calcDraft.gop ? Number(calcDraft.gop) : undefined,
          noi: calcDraft.noi ? Number(calcDraft.noi) : undefined,
          grossBooking: calcDraft.grossBooking ? Number(calcDraft.grossBooking) : undefined,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || labels['admin.contracts.error']);
      await loadFees(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['admin.contracts.error']);
    } finally {
      setBusy(false);
    }
  };

  const formatThb = (satang: number) => (satang / 100).toFixed(2);

  return (
    <div className="flex flex-col gap-24">
      <form
        onSubmit={create}
        className="bg-surface-paper border border-border-line rounded-lg p-24 flex flex-col gap-12"
      >
        <h2 className="text-heading-3 font-bold text-text-ink">
          {labels['admin.contracts.create_title']}
        </h2>
        <div className="grid md:grid-cols-2 gap-12">
          <label className="flex flex-col gap-4">
            <span className="text-small text-text-secondary">
              {labels['admin.contracts.field_project']}
            </span>
            <select
              className="h-40 px-12 rounded-sm border border-border-line text-body"
              value={draft.projectId}
              onChange={(e) =>
                setDraft((d) => ({ ...d, projectId: e.target.value, unitId: '' }))
              }
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-4">
            <span className="text-small text-text-secondary">
              {labels['admin.contracts.field_unit']}
            </span>
            <select
              className="h-40 px-12 rounded-sm border border-border-line text-body"
              value={draft.unitId}
              onChange={(e) => setDraft((d) => ({ ...d, unitId: e.target.value }))}
              required
            >
              <option value="">—</option>
              {unitsForProject.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          {selectedUnit ? (
            <p className="text-small text-text-secondary md:col-span-2">
              {labels['admin.contracts.field_owner']}: {selectedUnit.ownerLabel}
            </p>
          ) : null}
          <label className="flex flex-col gap-4">
            <span className="text-small text-text-secondary">
              {labels['admin.contracts.field_basis']}
            </span>
            <select
              className="h-40 px-12 rounded-sm border border-border-line text-body"
              value={draft.managementFeeBasis}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  managementFeeBasis: e.target.value as (typeof FEE_BASES)[number],
                }))
              }
            >
              {FEE_BASES.map((basis) => (
                <option key={basis} value={basis}>
                  {labels[`admin.contracts.basis.${basis}`] || basis}
                </option>
              ))}
            </select>
          </label>
          {draft.managementFeeBasis === 'fixed' ? (
            <label className="flex flex-col gap-4">
              <span className="text-small text-text-secondary">
                {labels['admin.contracts.field_fixed']}
              </span>
              <input
                type="number"
                className="h-40 px-12 rounded-sm border border-border-line text-body"
                value={draft.managementFeeFixedAmount}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, managementFeeFixedAmount: e.target.value }))
                }
                required
              />
            </label>
          ) : (
            <label className="flex flex-col gap-4">
              <span className="text-small text-text-secondary">
                {labels['admin.contracts.field_rate']}
              </span>
              <input
                type="number"
                step="0.0001"
                className="h-40 px-12 rounded-sm border border-border-line text-body"
                value={draft.managementFeeRate}
                onChange={(e) => setDraft((d) => ({ ...d, managementFeeRate: e.target.value }))}
                required
              />
            </label>
          )}
          <label className="flex flex-col gap-4">
            <span className="text-small text-text-secondary">
              {labels['admin.contracts.field_start']}
            </span>
            <input
              type="date"
              className="h-40 px-12 rounded-sm border border-border-line text-body"
              value={draft.contractStartDate}
              onChange={(e) => setDraft((d) => ({ ...d, contractStartDate: e.target.value }))}
              required
            />
          </label>
          <label className="flex flex-col gap-4">
            <span className="text-small text-text-secondary">
              {labels['admin.contracts.field_end']}
            </span>
            <input
              type="date"
              className="h-40 px-12 rounded-sm border border-border-line text-body"
              value={draft.contractEndDate}
              onChange={(e) => setDraft((d) => ({ ...d, contractEndDate: e.target.value }))}
            />
          </label>
        </div>
        <label className="flex items-center gap-8 text-small">
          <input
            type="checkbox"
            checked={draft.performanceFeeEnabled}
            onChange={(e) =>
              setDraft((d) => ({ ...d, performanceFeeEnabled: e.target.checked }))
            }
          />
          {labels['admin.contracts.performance_enable']}
        </label>
        {draft.performanceFeeEnabled ? (
          <div className="grid md:grid-cols-2 gap-12">
            <label className="flex flex-col gap-4">
              <span className="text-small text-text-secondary">
                {labels['admin.contracts.performance_rate']}
              </span>
              <input
                type="number"
                step="0.0001"
                className="h-40 px-12 rounded-sm border border-border-line text-body"
                value={draft.performanceFeeRate}
                onChange={(e) => setDraft((d) => ({ ...d, performanceFeeRate: e.target.value }))}
              />
            </label>
            <label className="flex flex-col gap-4">
              <span className="text-small text-text-secondary">
                {labels['admin.contracts.performance_baseline']}
              </span>
              <input
                type="number"
                className="h-40 px-12 rounded-sm border border-border-line text-body"
                value={draft.performanceFeeBaseline}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, performanceFeeBaseline: e.target.value }))
                }
              />
            </label>
          </div>
        ) : null}
        <div>
          <Button type="submit" isLoading={busy} disabled={!draft.unitId}>
            {labels['admin.contracts.create_submit']}
          </Button>
        </div>
      </form>

      {error ? (
        <p className="text-small text-state-error" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-body text-text-secondary">{labels['admin.contracts.loading']}</p>
      ) : contracts.length === 0 ? (
        <p className="text-body text-text-secondary">{labels['admin.contracts.empty']}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-small">
            <thead>
              <tr className="border-b border-border-line">
                <th className="px-12 py-12 text-left">{labels['admin.contracts.col_unit']}</th>
                <th className="px-12 py-12 text-left">{labels['admin.contracts.col_project']}</th>
                <th className="px-12 py-12 text-left">{labels['admin.contracts.col_owner']}</th>
                <th className="px-12 py-12 text-left">{labels['admin.contracts.col_basis']}</th>
                <th className="px-12 py-12 text-left">{labels['admin.contracts.col_period']}</th>
                <th className="px-12 py-12 text-left">{labels['admin.contracts.col_status']}</th>
                <th className="px-12 py-12 text-left">{labels['admin.contracts.col_action']}</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <tr key={c.id} className="border-b border-border-line">
                  <td className="px-12 py-8">{c.unitName}</td>
                  <td className="px-12 py-8">{c.projectName}</td>
                  <td className="px-12 py-8">{c.ownerName}</td>
                  <td className="px-12 py-8">
                    {labels[`admin.contracts.basis.${c.managementFeeBasis}`] ||
                      c.managementFeeBasis}
                  </td>
                  <td className="px-12 py-8">
                    {c.contractStartDate}
                    {c.contractEndDate ? ` – ${c.contractEndDate}` : ''}
                  </td>
                  <td className="px-12 py-8">
                    {labels[`admin.contracts.status.${c.status}`] || c.status}
                  </td>
                  <td className="px-12 py-8">
                    <Button size="sm" variant="secondary" onClick={() => openFees(c.id)}>
                      {labels['admin.contracts.view_fees']}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedId ? (
        <div className="bg-surface-paper border border-border-line rounded-lg p-24 flex flex-col gap-16">
          <div className="flex items-center justify-between">
            <h2 className="text-heading-3 font-bold text-text-ink">
              {labels['admin.contracts.fees_title']}
            </h2>
            <Button size="sm" variant="secondary" onClick={() => setSelectedId(null)}>
              {labels['admin.contracts.close']}
            </Button>
          </div>

          <form onSubmit={calculate} className="grid md:grid-cols-3 gap-12">
            <label className="flex flex-col gap-4">
              <span className="text-small text-text-secondary">
                {labels['admin.contracts.field_period_start']}
              </span>
              <input
                type="date"
                className="h-40 px-12 rounded-sm border border-border-line"
                value={calcDraft.periodStart}
                onChange={(e) => setCalcDraft((d) => ({ ...d, periodStart: e.target.value }))}
                required
              />
            </label>
            <label className="flex flex-col gap-4">
              <span className="text-small text-text-secondary">
                {labels['admin.contracts.field_period_end']}
              </span>
              <input
                type="date"
                className="h-40 px-12 rounded-sm border border-border-line"
                value={calcDraft.periodEnd}
                onChange={(e) => setCalcDraft((d) => ({ ...d, periodEnd: e.target.value }))}
                required
              />
            </label>
            <label className="flex flex-col gap-4">
              <span className="text-small text-text-secondary">
                {labels['admin.contracts.field_noi']}
              </span>
              <input
                type="number"
                className="h-40 px-12 rounded-sm border border-border-line"
                value={calcDraft.noi}
                onChange={(e) => setCalcDraft((d) => ({ ...d, noi: e.target.value }))}
              />
            </label>
            <label className="flex flex-col gap-4">
              <span className="text-small text-text-secondary">
                {labels['admin.contracts.field_gop']}
              </span>
              <input
                type="number"
                className="h-40 px-12 rounded-sm border border-border-line"
                value={calcDraft.gop}
                onChange={(e) => setCalcDraft((d) => ({ ...d, gop: e.target.value }))}
              />
            </label>
            <label className="flex flex-col gap-4">
              <span className="text-small text-text-secondary">
                {labels['admin.contracts.field_gross']}
              </span>
              <input
                type="number"
                className="h-40 px-12 rounded-sm border border-border-line"
                value={calcDraft.grossBooking}
                onChange={(e) => setCalcDraft((d) => ({ ...d, grossBooking: e.target.value }))}
              />
            </label>
            <div className="flex items-end">
              <Button type="submit" isLoading={busy}>
                {labels['admin.contracts.calculate_submit']}
              </Button>
            </div>
          </form>

          {feesLoading ? (
            <p className="text-small text-text-secondary">{labels['admin.contracts.loading']}</p>
          ) : fees.length === 0 ? (
            <p className="text-small text-text-secondary">{labels['admin.contracts.fees_empty']}</p>
          ) : (
            <table className="w-full text-small">
              <thead>
                <tr className="border-b border-border-line">
                  <th className="px-12 py-8 text-left">
                    {labels['admin.contracts.fees_col_type']}
                  </th>
                  <th className="px-12 py-8 text-left">
                    {labels['admin.contracts.fees_col_period']}
                  </th>
                  <th className="px-12 py-8 text-left">
                    {labels['admin.contracts.fees_col_basis']}
                  </th>
                  <th className="px-12 py-8 text-right">
                    {labels['admin.contracts.fees_col_amount']}
                  </th>
                  <th className="px-12 py-8 text-left">
                    {labels['admin.contracts.fees_col_status']}
                  </th>
                </tr>
              </thead>
              <tbody>
                {fees.map((fee) => (
                  <tr key={fee.id} className="border-b border-border-line">
                    <td className="px-12 py-8">{fee.feeType}</td>
                    <td className="px-12 py-8">
                      {fee.periodStart} – {fee.periodEnd}
                    </td>
                    <td className="px-12 py-8">{fee.calculationBasis}</td>
                    <td className="px-12 py-8 text-right font-mono">{formatThb(fee.amount)}</td>
                    <td className="px-12 py-8">{fee.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </div>
  );
}
