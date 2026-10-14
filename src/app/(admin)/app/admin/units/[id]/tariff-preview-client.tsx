'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';

type Preview = {
  pricingScope?: 'canonical_quote' | 'tariff_subtotal' | 'lease_illustration';
  subtotalSatang?: number; totalSatang?: number; monthlySatang?: number;
  illustrativeTwelveMonthSatang?: number; cleaningFeeSatang?: number;
  serviceFeeSatang?: number; taxSatang?: number; discountSatang?: number;
  bookingTerms?: { cancellationSummary: string; confirmationPaymentValue: number;
    securityDepositThbSatang: number; balanceTiming: string; minimumNights: number };
  error?: string;
};

type Labels = {
  title: string; mode: string; daily: string; monthly: string; yearly: string;
  arrival: string; departure: string; preview: string; draft: string; total: string;
  minimum: string; failure: string; terms: string; deposit: string; confirmation: string;
  guests: string; subtotal: string; partial: string; saved: string; availability: string;
  cleaning: string; service: string; tax: string; discount: string; annual: string;
};

export default function TariffPreviewClient({ unitId, labels }: { unitId: string; labels: Labels }) {
  const [mode, setMode] = useState('stay');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState(1);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Preview | null>(null);
  const request = useRef<AbortController | null>(null);
  const money = (value: number) =>
    new Intl.NumberFormat('en-TH', { style: 'currency', currency: 'THB' }).format(value / 100);

  const invalidate = useCallback(() => { request.current?.abort(); request.current = null; setResult(null); setBusy(false); }, []);
  useEffect(() => {
    invalidate();
    const saved = (event: Event) => {
      if ((event as CustomEvent<{ unitId: string }>).detail?.unitId === unitId) invalidate();
    };
    window.addEventListener('tariff-saved', saved);
    return () => { request.current?.abort(); window.removeEventListener('tariff-saved', saved); };
  }, [unitId, invalidate]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setResult(null);
    try {
      const response = await fetch(`/api/admin/units/${unitId}/tariff-preview`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ mode, checkIn, checkOut, guests }),
      });
      const data = await response.json();
      if (controller.signal.aborted || request.current !== controller) return;
      const amount = data?.pricingScope === 'canonical_quote' ? data.totalSatang :
        data?.pricingScope === 'lease_illustration' ? data.illustrativeTwelveMonthSatang : data?.subtotalSatang;
      setResult(response.ok && Number.isSafeInteger(amount) && amount >= 0 ? data : { error: data?.error || labels.failure });
    } catch { if (!controller.signal.aborted) setResult({ error: labels.failure }); }
    finally { if (request.current === controller) { request.current = null; setBusy(false); } }
  }
  const amount = result?.pricingScope === 'canonical_quote' ? result.totalSatang :
    result?.pricingScope === 'lease_illustration' ? result.illustrativeTwelveMonthSatang : result?.subtotalSatang;
  const totalLabel = result?.pricingScope === 'canonical_quote' ? labels.total :
    result?.pricingScope === 'lease_illustration' ? labels.annual : labels.subtotal;
  return <section className="bg-surface-paper border border-border-line rounded-lg shadow-card p-24 mt-24">
    <h2 className="text-heading-3 font-semibold text-text-ink">{labels.title}</h2>
    <p className="text-small text-text-secondary mt-8">{labels.saved}</p>
    <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-3 gap-12 mt-16">
      <label className="text-small">{labels.mode}<select value={mode} onChange={e => { invalidate(); setMode(e.target.value); }}
        className="block w-full border border-border-line rounded-md p-8 mt-4">
        <option value="stay">{labels.daily}</option><option value="yearly">{labels.yearly}</option>
      </select></label>
      {mode !== 'yearly' && <>
        <label className="text-small">{labels.arrival}<input required type="date" value={checkIn}
          onChange={e => { invalidate(); setCheckIn(e.target.value); }} className="block w-full border border-border-line rounded-md p-8 mt-4" /></label>
        <label className="text-small">{labels.departure}<input required type="date" value={checkOut} min={checkIn || undefined}
          onChange={e => { invalidate(); setCheckOut(e.target.value); }} className="block w-full border border-border-line rounded-md p-8 mt-4" /></label>
        <label className="text-small">{labels.guests}<input required type="number" min={1} step={1} value={guests}
          onChange={e => { invalidate(); setGuests(Number(e.target.value)); }} className="block w-full border border-border-line rounded-md p-8 mt-4" /></label>
      </>}
      <button type="submit" disabled={busy} className="self-end rounded-md bg-brand-deep text-white px-16 py-12 disabled:opacity-50">{labels.preview}</button>
    </form>
    {result?.error && <p role="alert" className="mt-12 text-state-error">{result.error}</p>}
    {result && !result.error && amount !== undefined && <div role="status" className="mt-16 space-y-8 text-small">
      <p>{totalLabel}: <strong>{money(amount)}</strong></p>
      {result.pricingScope === 'tariff_subtotal' && <p>{labels.partial}</p>}
      {result.pricingScope === 'lease_illustration' && <p>{labels.draft}</p>}
      {result.pricingScope === 'canonical_quote' && <ul>
        {([['cleaningFeeSatang', 'cleaning'], ['serviceFeeSatang', 'service'], ['taxSatang', 'tax'], ['discountSatang', 'discount']] as const).map(([key, label]) =>
          result[key] !== undefined && <li key={key}>{labels[label]}: {money(result[key]!)}</li>)}
      </ul>}
      {result.monthlySatang !== undefined && <p>{labels.monthly}: {money(result.monthlySatang)}</p>}
      <p>{labels.availability}</p>
      {result.bookingTerms && <div className="border-t border-border-line pt-8">
        <p>{labels.minimum}: {result.bookingTerms.minimumNights}</p>
        <p><strong>{labels.terms}</strong>: {result.bookingTerms.cancellationSummary}</p>
        <p>{labels.confirmation}: {result.bookingTerms.confirmationPaymentValue}%</p>
        <p>{labels.deposit}: {money(result.bookingTerms.securityDepositThbSatang)}</p>
        <p>{result.bookingTerms.balanceTiming}</p>
      </div>}
    </div>}
  </section>;
}
