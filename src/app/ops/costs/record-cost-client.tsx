'use client';

import { useState } from 'react';

const COST_TYPES = [
  'cleaning_cost',
  'maintenance_cost',
  'consumables_cost',
  'utilities_cost',
  'adjustment',
] as const;

interface Unit { id: string; name: string; projectName: string }
interface Entry {
  id: string;
  entryType: string;
  amountThb: number;
  occurredOn: string;
  description: string;
  unitName: string;
}

/** Satang in, baht on screen — the ledger stores integers to avoid float drift. */
const baht = (satang: number) => (satang / 100).toLocaleString();

export default function RecordCostClient({
  units,
  recent,
  labels,
}: {
  units: Unit[];
  recent: Entry[];
  labels: Record<string, string>;
}) {
  const [unitId, setUnitId] = useState(units[0]?.id ?? '');
  const [entryType, setEntryType] = useState<string>(COST_TYPES[0]);
  const [amount, setAmount] = useState('');
  const [occurredOn, setOccurredOn] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>(recent);

  const submit = async () => {
    setState('saving');
    setMessage(null);

    // Entered in baht, stored in satang. Doing the conversion here and rounding
    // once keeps a typed "1250.50" from becoming a fraction of a satang.
    const amountThb = Math.round(parseFloat(amount) * 100);
    if (!Number.isFinite(amountThb) || amountThb <= 0) {
      setState('error');
      setMessage(labels['ops.costs.error']);
      return;
    }

    const res = await fetch('/api/ledger/record-cost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unitId, entryType, amountThb, occurredOn, description }),
    }).catch(() => null);

    if (!res?.ok) {
      const body = await res?.json().catch(() => null);
      setState('error');
      setMessage(body?.error ?? labels['ops.costs.error']);
      return;
    }

    setState('saved');
    setMessage(labels['ops.costs.saved']);
    setEntries((prev) => [
      {
        id: crypto.randomUUID(),
        entryType,
        amountThb,
        occurredOn,
        description,
        unitName: units.find((u) => u.id === unitId)?.name ?? '—',
      },
      ...prev,
    ]);
    setAmount('');
    setDescription('');
  };

  return (
    <div className="min-h-screen bg-surface-background p-24 md:p-32">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-heading-1 font-bold text-text-ink mb-8">{labels['ops.costs.title']}</h1>
        <p className="text-body text-text-secondary mb-24">{labels['ops.costs.intro']}</p>

        <section className="bg-surface-paper border border-border-line rounded-lg p-24 mb-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 mb-16">
            <label className="block">
              <span className="text-small text-text-secondary">{labels['ops.costs.unit']}</span>
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                className="mt-4 w-full h-48 rounded-sm border border-border-line bg-surface-background px-12 text-body text-text-ink"
              >
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.projectName} · {u.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-small text-text-secondary">{labels['ops.costs.type']}</span>
              <select
                value={entryType}
                onChange={(e) => setEntryType(e.target.value)}
                className="mt-4 w-full h-48 rounded-sm border border-border-line bg-surface-background px-12 text-body text-text-ink"
              >
                {COST_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {labels[`catalog.ledger_entry_types.${t}.label`] ?? t}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-small text-text-secondary">{labels['ops.costs.amount']}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-4 w-full h-48 rounded-sm border border-border-line bg-surface-background px-12 text-body text-text-ink"
              />
            </label>

            <label className="block">
              <span className="text-small text-text-secondary">{labels['ops.costs.date']}</span>
              <input
                type="date"
                value={occurredOn}
                onChange={(e) => setOccurredOn(e.target.value)}
                className="mt-4 w-full h-48 rounded-sm border border-border-line bg-surface-background px-12 text-body text-text-ink"
              />
            </label>
          </div>

          <label className="block mb-16">
            <span className="text-small text-text-secondary">{labels['ops.costs.description']}</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-4 w-full h-48 rounded-sm border border-border-line bg-surface-background px-12 text-body text-text-ink"
            />
          </label>

          <p className="text-small text-text-secondary mb-16 italic">{labels['ops.costs.immutable']}</p>

          <button
            type="button"
            onClick={submit}
            disabled={state === 'saving' || !unitId || !amount || !description}
            className="h-48 px-24 rounded-sm bg-brand-andaman text-surface-ivory font-semibold hover:opacity-90 transition disabled:opacity-50"
          >
            {state === 'saving' ? labels['ops.costs.saving'] : labels['ops.costs.submit']}
          </button>
          {message && (
            <span
              className={`ml-12 text-small ${state === 'error' ? 'text-state-error' : 'text-state-success'}`}
            >
              {message}
            </span>
          )}
        </section>

        <section className="bg-surface-paper border border-border-line rounded-lg p-24">
          <h2 className="text-heading-3 font-semibold text-text-ink mb-16">
            {labels['ops.costs.recent']}
          </h2>
          {entries.length === 0 ? (
            <p className="text-body text-text-secondary">{labels['ops.costs.none']}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-small">
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className="border-t border-border-line">
                      <td className="py-12 pr-16 text-text-secondary whitespace-nowrap">{e.occurredOn}</td>
                      <td className="py-12 pr-16 text-text-ink">{e.unitName}</td>
                      <td className="py-12 pr-16 text-text-secondary">
                        {labels[`catalog.ledger_entry_types.${e.entryType}.label`] ?? e.entryType}
                      </td>
                      <td className="py-12 pr-16 text-text-ink">{e.description}</td>
                      <td className="py-12 text-text-ink font-semibold whitespace-nowrap">
                        ฿{baht(e.amountThb)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
