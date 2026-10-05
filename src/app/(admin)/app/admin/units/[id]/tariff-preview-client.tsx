'use client';
import { useState, type FormEvent } from 'react';

type Preview = {
  mode?: string; status?: string; bookable?: boolean; subtotalSatang?: number;
  monthlySatang?: number; illustrativeTwelveMonthSatang?: number;
  lines?: Array<{ date: string; nightlySatang: number }>;
  bookingTerms?: { cancellationSummary: string; confirmationPaymentValue: number;
    securityDepositThbSatang: number; balanceTiming: string };
  error?: string;
};

export default function TariffPreviewClient({
  unitId, labels,
}: {
  unitId: string;
  labels: { title: string; mode: string; daily: string; monthly: string;
    yearly: string; arrival: string; departure: string; preview: string;
    draft: string; total: string; minimum: string; failure: string;
    terms: string; deposit: string; confirmation: string };
}) {
  const [mode, setMode] = useState('daily');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Preview | null>(null);
  const money = (value: number) =>
    new Intl.NumberFormat('en-TH', { style: 'currency', currency: 'THB' }).format(value / 100);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setResult(null);
    try {
      const response = await fetch(`/api/admin/units/${unitId}/tariff-preview`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, checkIn, checkOut }),
      });
      const data = await response.json();
      setResult(response.ok ? data : { error: data.error || labels.failure });
    } catch { setResult({ error: labels.failure }); }
    finally { setBusy(false); }
  }
  return <section className="bg-surface-paper border border-border-line rounded-lg shadow-card p-24 mt-24">
    <h2 className="text-heading-3 font-semibold text-text-ink">{labels.title}</h2>
    <p className="text-small text-text-secondary mt-8">{labels.draft}</p>
    <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-4 gap-12 mt-16">
      <label className="text-small">{labels.mode}<select value={mode} onChange={e=>setMode(e.target.value)}
        className="block w-full border border-border-line rounded-md p-8 mt-4">
        <option value="daily">{labels.daily}</option>
        <option value="monthly">{labels.monthly}</option>
        <option value="yearly">{labels.yearly}</option>
      </select></label>
      <label className="text-small">{labels.arrival}<input required type="date" value={checkIn}
        onChange={e=>setCheckIn(e.target.value)} className="block w-full border border-border-line rounded-md p-8 mt-4" /></label>
      <label className="text-small">{labels.departure}<input required type="date" value={checkOut}
        onChange={e=>setCheckOut(e.target.value)} className="block w-full border border-border-line rounded-md p-8 mt-4" /></label>
      <button type="submit" disabled={busy}
        className="self-end rounded-md bg-brand-deep text-white px-16 py-12 disabled:opacity-50">{labels.preview}</button>
    </form>
    {result?.error && <p role="alert" className="mt-12 text-state-danger">{result.error}</p>}
    {result && !result.error && <div role="status" className="mt-16 space-y-8 text-small">
      <p>{labels.total}: <strong>{money(result.subtotalSatang ??
        result.illustrativeTwelveMonthSatang ?? 0)}</strong></p>
      {result.monthlySatang !== undefined && <p>{labels.monthly}: {money(result.monthlySatang)}</p>}
      <p>{result.bookable ? labels.preview : labels.draft}</p>
      {result.bookingTerms && <div className="border-t border-border-line pt-8">
        <p><strong>{labels.terms}</strong>: {result.bookingTerms.cancellationSummary}</p>
        <p>{labels.confirmation}: {result.bookingTerms.confirmationPaymentValue}%</p>
        <p>{labels.deposit}: {money(result.bookingTerms.securityDepositThbSatang)}</p>
        <p>{result.bookingTerms.balanceTiming}</p>
      </div>}
    </div>}
  </section>;
}
