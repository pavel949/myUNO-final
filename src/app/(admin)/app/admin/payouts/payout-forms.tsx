'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface EligibleStatement {
  id: string;
  unitName: string;
  periodStart: string;
  periodEnd: string;
  /** Satang — the exact amount the owner-payout route requires. */
  ownerShareTh: number;
}

interface Provider {
  id: string;
  name: string;
}

interface Remittance {
  fulfilledOrdersTotal: number;
  takeRateThb: number;
  refundsClawedBack: number;
  netThb: number;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function PayoutForms({
  eligibleStatements,
  providers,
  labels,
}: {
  eligibleStatements: EligibleStatement[];
  providers: Provider[];
  labels: Record<string, string>;
}) {
  const router = useRouter();

  // Owner payout form state
  const [ownerStatementId, setOwnerStatementId] = useState('');
  const [ownerReference, setOwnerReference] = useState('');
  const [ownerExecutedOn, setOwnerExecutedOn] = useState(todayIso());
  const [ownerBusy, setOwnerBusy] = useState(false);
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [ownerSuccess, setOwnerSuccess] = useState(false);

  // Provider payout form state
  const [providerId, setProviderId] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [remittance, setRemittance] = useState<Remittance | null>(null);
  const [providerReference, setProviderReference] = useState('');
  const [providerExecutedOn, setProviderExecutedOn] = useState(todayIso());
  const [computing, setComputing] = useState(false);
  const [providerBusy, setProviderBusy] = useState(false);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [providerSuccess, setProviderSuccess] = useState(false);

  const selectedStatement = eligibleStatements.find((s) => s.id === ownerStatementId) ?? null;

  const submitOwnerPayout = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!selectedStatement || !ownerReference.trim()) return;
      setOwnerBusy(true);
      setOwnerError(null);
      try {
        const res = await fetch('/api/admin/payouts/owner', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            statementId: selectedStatement.id,
            amountThb: selectedStatement.ownerShareTh,
            reference: ownerReference.trim(),
            executedOn: ownerExecutedOn,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || labels['admin.payouts.error']);
        setOwnerSuccess(true);
        setOwnerStatementId('');
        setOwnerReference('');
        router.refresh();
      } catch (err) {
        setOwnerError(err instanceof Error ? err.message : labels['admin.payouts.error']);
      } finally {
        setOwnerBusy(false);
      }
    },
    [selectedStatement, ownerReference, ownerExecutedOn, labels, router]
  );

  const computeRemittance = useCallback(async () => {
    if (!providerId || !periodStart || !periodEnd) return;
    setComputing(true);
    setProviderError(null);
    setRemittance(null);
    try {
      const params = new URLSearchParams({ providerId, periodStart, periodEnd });
      const res = await fetch(`/api/admin/payouts/provider/preview?${params.toString()}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || labels['admin.payouts.error']);
      setRemittance(data.remittance);
    } catch (err) {
      setProviderError(err instanceof Error ? err.message : labels['admin.payouts.error']);
    } finally {
      setComputing(false);
    }
  }, [providerId, periodStart, periodEnd, labels]);

  const submitProviderPayout = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!remittance || !providerReference.trim()) return;
      setProviderBusy(true);
      setProviderError(null);
      try {
        const res = await fetch('/api/admin/payouts/provider', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            providerId,
            periodStart,
            periodEnd,
            amountThb: remittance.netThb,
            reference: providerReference.trim(),
            executedOn: providerExecutedOn,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || labels['admin.payouts.error']);
        setProviderSuccess(true);
        setProviderId('');
        setPeriodStart('');
        setPeriodEnd('');
        setRemittance(null);
        setProviderReference('');
        router.refresh();
      } catch (err) {
        setProviderError(err instanceof Error ? err.message : labels['admin.payouts.error']);
      } finally {
        setProviderBusy(false);
      }
    },
    [remittance, providerId, periodStart, periodEnd, providerReference, providerExecutedOn, labels, router]
  );

  return (
    <div className="bg-surface-paper border border-border-line rounded-lg p-24 mb-24">
      <h2 className="text-heading-3 font-bold text-text-ink mb-16">
        {labels['admin.payouts.record_title']}
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-24">
        {/* Owner payout */}
        <form onSubmit={submitOwnerPayout} className="flex flex-col gap-12">
          <h3 className="text-body font-semibold text-text-ink">{labels['admin.payouts.owner_tab']}</h3>

          {eligibleStatements.length === 0 ? (
            <p className="text-small text-text-secondary">
              {labels['admin.payouts.owner_statement_empty']}
            </p>
          ) : (
            <>
              <label className="text-small text-text-secondary">
                {labels['admin.payouts.owner_statement']}
                <select
                  value={ownerStatementId}
                  onChange={(e) => setOwnerStatementId(e.target.value)}
                  className="block w-full h-40 mt-4 px-12 rounded-sm border border-border-line text-body text-text-ink"
                >
                  <option value="" />
                  {eligibleStatements.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.unitName} — {new Date(s.periodStart).toLocaleDateString()}{' '}
                      {labels['admin.payouts.period_to']} {new Date(s.periodEnd).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </label>

              {selectedStatement && (
                <p className="text-small text-text-secondary">
                  {labels['admin.payouts.owner_share']}:{' '}
                  <span className="font-mono text-text-ink">
                    ฿{(selectedStatement.ownerShareTh / 100).toLocaleString()}
                  </span>
                </p>
              )}

              <label className="text-small text-text-secondary">
                {labels['admin.payouts.reference_field']}
                <input
                  type="text"
                  value={ownerReference}
                  onChange={(e) => setOwnerReference(e.target.value)}
                  className="block w-full h-40 mt-4 px-12 rounded-sm border border-border-line text-body text-text-ink"
                />
              </label>

              <label className="text-small text-text-secondary">
                {labels['admin.payouts.executed_on']}
                <input
                  type="date"
                  value={ownerExecutedOn}
                  onChange={(e) => setOwnerExecutedOn(e.target.value)}
                  className="block w-full h-40 mt-4 px-12 rounded-sm border border-border-line text-body text-text-ink"
                />
              </label>

              {ownerError && (
                <p className="text-small text-state-error" role="alert">
                  {ownerError}
                </p>
              )}
              {ownerSuccess && (
                <p className="text-small text-state-success">{labels['admin.payouts.success']}</p>
              )}

              <button
                type="submit"
                disabled={!selectedStatement || !ownerReference.trim() || ownerBusy}
                className="h-40 px-20 rounded-md bg-brand-andaman text-surface-ivory font-medium hover:bg-brand-deep disabled:opacity-50 transition-colors duration-micro"
              >
                {ownerBusy ? labels['admin.payouts.working'] : labels['admin.payouts.submit']}
              </button>
            </>
          )}
        </form>

        {/* Provider payout */}
        <form onSubmit={submitProviderPayout} className="flex flex-col gap-12">
          <h3 className="text-body font-semibold text-text-ink">{labels['admin.payouts.provider_tab']}</h3>

          {providers.length === 0 ? (
            <p className="text-small text-text-secondary">{labels['admin.payouts.provider_empty']}</p>
          ) : (
            <>
              <label className="text-small text-text-secondary">
                {labels['admin.payouts.provider_field']}
                <select
                  value={providerId}
                  onChange={(e) => {
                    setProviderId(e.target.value);
                    setRemittance(null);
                  }}
                  className="block w-full h-40 mt-4 px-12 rounded-sm border border-border-line text-body text-text-ink"
                >
                  <option value="" />
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-12">
                <label className="text-small text-text-secondary">
                  {labels['admin.payouts.period_start']}
                  <input
                    type="date"
                    value={periodStart}
                    onChange={(e) => {
                      setPeriodStart(e.target.value);
                      setRemittance(null);
                    }}
                    className="block w-full h-40 mt-4 px-12 rounded-sm border border-border-line text-body text-text-ink"
                  />
                </label>
                <label className="text-small text-text-secondary">
                  {labels['admin.payouts.period_end']}
                  <input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => {
                      setPeriodEnd(e.target.value);
                      setRemittance(null);
                    }}
                    className="block w-full h-40 mt-4 px-12 rounded-sm border border-border-line text-body text-text-ink"
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={computeRemittance}
                disabled={!providerId || !periodStart || !periodEnd || computing}
                className="h-40 px-20 rounded-md bg-surface-ivory border border-border-line text-text-ink font-medium hover:bg-brand-andaman hover:text-surface-ivory disabled:opacity-50 transition-colors duration-micro self-start"
              >
                {computing ? labels['admin.payouts.computing'] : labels['admin.payouts.compute']}
              </button>

              {remittance && (
                <div className="text-small text-text-secondary flex flex-col gap-4 bg-surface-ivory rounded-sm p-12">
                  <span>
                    {labels['admin.payouts.fulfilled_total']}: ฿
                    {(remittance.fulfilledOrdersTotal / 100).toLocaleString()}
                  </span>
                  <span>
                    {labels['admin.payouts.take_rate']}: ฿{(remittance.takeRateThb / 100).toLocaleString()}
                  </span>
                  <span>
                    {labels['admin.payouts.refunds_clawed_back']}: ฿
                    {(remittance.refundsClawedBack / 100).toLocaleString()}
                  </span>
                  <span className="font-semibold text-text-ink">
                    {labels['admin.payouts.net_amount']}: ฿{(remittance.netThb / 100).toLocaleString()}
                  </span>
                </div>
              )}

              <label className="text-small text-text-secondary">
                {labels['admin.payouts.reference_field']}
                <input
                  type="text"
                  value={providerReference}
                  onChange={(e) => setProviderReference(e.target.value)}
                  className="block w-full h-40 mt-4 px-12 rounded-sm border border-border-line text-body text-text-ink"
                />
              </label>

              <label className="text-small text-text-secondary">
                {labels['admin.payouts.executed_on']}
                <input
                  type="date"
                  value={providerExecutedOn}
                  onChange={(e) => setProviderExecutedOn(e.target.value)}
                  className="block w-full h-40 mt-4 px-12 rounded-sm border border-border-line text-body text-text-ink"
                />
              </label>

              {providerError && (
                <p className="text-small text-state-error" role="alert">
                  {providerError}
                </p>
              )}
              {providerSuccess && (
                <p className="text-small text-state-success">{labels['admin.payouts.success']}</p>
              )}
              {!remittance && !providerError && (
                <p className="text-xsmall text-text-secondary">{labels['admin.payouts.compute_first']}</p>
              )}

              <button
                type="submit"
                disabled={!remittance || !providerReference.trim() || providerBusy}
                className="h-40 px-20 rounded-md bg-brand-andaman text-surface-ivory font-medium hover:bg-brand-deep disabled:opacity-50 transition-colors duration-micro"
              >
                {providerBusy ? labels['admin.payouts.working'] : labels['admin.payouts.submit']}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
