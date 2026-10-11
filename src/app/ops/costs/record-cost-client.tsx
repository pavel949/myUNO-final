'use client';

import { UI_LOCALE } from '@/lib/format';
import { calendarDayIn } from '@/lib/date';
import { useRef, useState } from 'react';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
// Deliberate bypass of the finance barrel: that barrel carries server-only code
// (database client, encryption). These two files are pure — see CLAUDE.md,
// module rule 2 exception.
import {
  costErrorMessage,
  receiptErrorMessage,
  reportImpactMessage,
} from '@/modules/finance/expense-receipt-labels';
import type { ReportImpact } from '@/modules/finance/manual-cost.service';

// `adjustment` is not a cost: a mistake is reversed by an administrator.
const COST_TYPES = [
  'cleaning_cost',
  'maintenance_cost',
  'consumables_cost',
  'utilities_cost',
] as const;

const MAX_RECEIPT_BYTES = 4 * 1024 * 1024;
const RECEIPT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const RECEIPT_ACCEPT = RECEIPT_TYPES.join(',');

interface Unit { id: string; name: string; projectName: string }
interface Entry {
  id: string;
  entryType: string;
  /** Positive satang. */
  amountThb: number;
  occurredOn: string;
  description: string;
  unitName: string;
  /** The current private receipt, if one is attached. */
  receiptId?: string | null;
}

/** Satang in, baht on screen — the ledger stores integers to avoid float drift. */
const baht = (satang: number) =>
  (satang / 100).toLocaleString(UI_LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * "1250.50" → 125050 satang, by string arithmetic. Float multiplication is not
 * safe here (0.07 × 100 is 7.000000000000001), and a silent rounding would
 * record an amount nobody typed.
 */
export function parseBahtToSatang(input: string): number | null {
  const match = /^(\d{1,8})(?:[.,](\d{1,2}))?$/.exec(input.trim());
  if (!match) return null;
  const satang = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0') || 0);
  return satang > 0 ? satang : null;
}

type Phase = 'idle' | 'saving' | 'saved' | 'error';

interface PendingReceipt {
  entryId: string;
  file: File;
  key: string;
  busy: boolean;
  error: string | null;
}

async function uploadReceipt(
  entryId: string,
  file: File,
  key: string
): Promise<{ ok: true; receiptId: string } | { ok: false; code?: string; network?: boolean }> {
  const form = new FormData();
  form.append('ledgerEntryId', entryId);
  form.append('file', file);
  const res = await fetch('/api/ledger/receipts', {
    method: 'POST',
    headers: { 'Idempotency-Key': key },
    body: form,
  }).catch(() => null);
  if (!res) return { ok: false, network: true };
  const body = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, code: body?.code };
  return { ok: true, receiptId: body.receipt.id };
}

function receiptFileProblem(file: File, labels: Record<string, string>): string | null {
  if (!RECEIPT_TYPES.includes(file.type)) return receiptErrorMessage(labels, 'unsupported_type');
  if (file.size === 0) return receiptErrorMessage(labels, 'empty');
  if (file.size > MAX_RECEIPT_BYTES) return receiptErrorMessage(labels, 'too_large');
  return null;
}

export default function RecordCostClient({
  units,
  recent,
  labels,
  embedded = false,
}: {
  units: Unit[];
  recent: Entry[];
  labels: Record<string, string>;
  /** When true, parent page supplies title/intro/back link. */
  embedded?: boolean;
}) {
  const [unitId, setUnitId] = useState(units[0]?.id ?? '');
  const [entryType, setEntryType] = useState<string>(COST_TYPES[0]);
  const [amount, setAmount] = useState('');
  // Units do not carry a timezone here; default once to the operating day.
  const [occurredOn, setOccurredOn] = useState(() => calendarDayIn(new Date()));
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>(recent);
  // One key per attempt. It survives every failed or lost response — so a
  // retry is recognised by the server as the same cost — and is replaced only
  // once the server has answered for it.
  const [attemptKey, setAttemptKey] = useState(() => crypto.randomUUID());
  const [receiptKey, setReceiptKey] = useState(() => crypto.randomUUID());
  const [pending, setPending] = useState<PendingReceipt | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [rowMessage, setRowMessage] = useState<{ id: string; text: string; error: boolean } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const rowFileInput = useRef<HTMLInputElement>(null);
  const rowTarget = useRef<string | null>(null);

  const fail = (text: string) => {
    setPhase('error');
    setMessage(text);
  };

  const markReceipt = (entryId: string, receiptId: string) =>
    setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, receiptId } : e)));

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (phase === 'saving') return;
    setMessage(null);

    // Entered in baht, stored in satang — converted once, here.
    const amountThb = parseBahtToSatang(amount);
    if (amountThb === null) return fail(costErrorMessage(labels, 'invalid_amount'));
    if (file) {
      const problem = receiptFileProblem(file, labels);
      if (problem) return fail(problem);
    }

    setPhase('saving');
    const res = await fetch('/api/ledger/record-cost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': attemptKey },
      body: JSON.stringify({ unitId, entryType, amountThb, occurredOn, description }),
    }).catch(() => null);

    // No answer at all: the cost may or may not have been written. Keep the key
    // and the fields — resending the same attempt is exactly what is safe.
    if (!res) return fail(labels['ops.costs.error.network'] ?? labels['ops.costs.error']);

    const body = await res.json().catch(() => null);
    if (!res.ok) {
      if (body?.code === 'idempotency_conflict') setAttemptKey(crypto.randomUUID());
      return fail(costErrorMessage(labels, body?.code));
    }

    // Success is the server's word, and so is what we say about the report.
    const saved: Entry = {
      id: body.id,
      entryType: body.entryType,
      amountThb: body.amountThb,
      occurredOn: body.occurredOn,
      description: body.description,
      unitName: units.find((u) => u.id === unitId)?.name ?? '—',
      receiptId: null,
    };
    setEntries((prev) => (prev.some((e) => e.id === saved.id) ? prev : [saved, ...prev]));
    setPhase('saved');
    setMessage(reportImpactMessage(labels, body.reportImpact as ReportImpact, body.replayed === true));

    const chosen = file;
    const key = receiptKey;
    setAmount('');
    setDescription('');
    setFile(null);
    if (fileInput.current) fileInput.current.value = '';
    setAttemptKey(crypto.randomUUID());
    setReceiptKey(crypto.randomUUID());

    if (chosen) {
      setPending({ entryId: saved.id, file: chosen, key, busy: true, error: null });
      const uploaded = await uploadReceipt(saved.id, chosen, key);
      if (uploaded.ok) {
        markReceipt(saved.id, uploaded.receiptId);
        setPending(null);
      } else {
        setPending({
          entryId: saved.id,
          file: chosen,
          key,
          busy: false,
          error: uploaded.network
            ? (labels['ops.costs.error.network'] ?? labels['ops.costs.receipt_error.generic'])
            : receiptErrorMessage(labels, uploaded.code),
        });
      }
    }
  };

  const retryPending = async () => {
    if (!pending || pending.busy) return;
    setPending({ ...pending, busy: true, error: null });
    const uploaded = await uploadReceipt(pending.entryId, pending.file, pending.key);
    if (uploaded.ok) {
      markReceipt(pending.entryId, uploaded.receiptId);
      setPending(null);
    } else {
      setPending({
        ...pending,
        busy: false,
        error: uploaded.network
          ? (labels['ops.costs.error.network'] ?? labels['ops.costs.receipt_error.generic'])
          : receiptErrorMessage(labels, uploaded.code),
      });
    }
  };

  const attachToRow = async (entryId: string, chosen: File) => {
    const problem = receiptFileProblem(chosen, labels);
    if (problem) return setRowMessage({ id: entryId, text: problem, error: true });
    setRowBusy(entryId);
    setRowMessage(null);
    const uploaded = await uploadReceipt(entryId, chosen, crypto.randomUUID());
    setRowBusy(null);
    if (uploaded.ok) {
      markReceipt(entryId, uploaded.receiptId);
      setRowMessage({ id: entryId, text: labels['ops.costs.receipt_saved'] ?? '', error: false });
    } else {
      setRowMessage({
        id: entryId,
        text: uploaded.network
          ? (labels['ops.costs.error.network'] ?? '')
          : receiptErrorMessage(labels, uploaded.code),
        error: true,
      });
    }
  };

  const saving = phase === 'saving';

  return (
    <div className={embedded ? undefined : 'stitch-workspace p-24 md:p-32'}>
      <div className={embedded ? undefined : 'max-w-3xl mx-auto'}>
        {!embedded ? (
          <>
            <h1 className="font-display text-display-xl font-semibold text-text-ink mb-8">
              {labels['ops.costs.title']}
            </h1>
            <p className="text-body text-text-stone mb-24">{labels['ops.costs.intro_v2']}</p>
          </>
        ) : null}

        <section className="stitch-panel p-24 mb-24">
          {units.length === 0 ? (
            <p className="text-body text-text-secondary">{labels['ops.costs.no_units']}</p>
          ) : (
            <form onSubmit={submit} noValidate>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-16 mb-16">
                <Select
                  label={labels['ops.costs.unit']}
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                  options={units.map((u) => ({
                    value: u.id,
                    label: `${u.projectName} · ${u.name}`,
                  }))}
                />

                <Select
                  label={labels['ops.costs.type']}
                  value={entryType}
                  onChange={(e) => setEntryType(e.target.value)}
                  options={COST_TYPES.map((t) => ({
                    value: t,
                    label: labels[`catalog.ledger_entry_types.${t}.label`] ?? t,
                  }))}
                />

                <Input
                  label={labels['ops.costs.amount']}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />

                <Input
                  label={labels['ops.costs.date']}
                  type="date"
                  value={occurredOn}
                  onChange={(e) => setOccurredOn(e.target.value)}
                />
              </div>

              <div className="mb-16">
                <Input
                  label={labels['ops.costs.description']}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="mb-16">
                <label htmlFor="cost-receipt" className="block text-small font-semibold text-text-ink mb-4">
                  {labels['ops.costs.receipt']}
                </label>
                <input
                  id="cost-receipt"
                  ref={fileInput}
                  type="file"
                  accept={RECEIPT_ACCEPT}
                  aria-describedby="cost-receipt-hint"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-small text-text-ink"
                />
                <p id="cost-receipt-hint" className="text-small text-text-stone mt-4">
                  {labels['ops.costs.receipt_hint']}
                </p>
              </div>

              <p className="text-small text-text-stone mb-16">{labels['ops.costs.correction_note']}</p>

              <div className="flex flex-wrap items-center gap-12">
                <Button
                  type="submit"
                  isLoading={saving}
                  disabled={saving || !unitId || !amount || !description}
                  // While loading the button shows only a spinner, which has no name.
                  aria-label={saving ? labels['ops.costs.saving'] : undefined}
                  aria-busy={saving}
                >
                  {saving ? labels['ops.costs.saving'] : labels['ops.costs.submit']}
                </Button>
                {message && (
                  <span
                    role={phase === 'error' ? 'alert' : 'status'}
                    className={`text-small ${phase === 'error' ? 'text-state-error' : 'text-state-success'}`}
                  >
                    {message}
                  </span>
                )}
              </div>
            </form>
          )}

          {pending && (
            <div className="mt-16 border-t border-border-line pt-16" role="status">
              <p className="text-small text-text-ink mb-8">
                {pending.busy ? labels['ops.costs.receipt_uploading'] : labels['ops.costs.receipt_pending']}
              </p>
              {pending.error && <p className="text-small text-state-error mb-8" role="alert">{pending.error}</p>}
              {!pending.busy && (
                <Button type="button" onClick={retryPending}>
                  {labels['ops.costs.receipt_retry']}
                </Button>
              )}
            </div>
          )}
        </section>

        <section className="stitch-panel p-24">
          <h2 className="font-display text-title font-semibold text-text-ink mb-16">
            {labels['ops.costs.recent']}
          </h2>
          {entries.length === 0 ? (
            <p className="text-body text-text-secondary">{labels['ops.costs.none']}</p>
          ) : (
            <div className="overflow-x-auto">
              <input
                ref={rowFileInput}
                type="file"
                hidden
                accept={RECEIPT_ACCEPT}
                data-testid="row-receipt-input"
                onChange={(e) => {
                  const chosen = e.target.files?.[0];
                  const target = rowTarget.current;
                  e.target.value = '';
                  if (chosen && target) void attachToRow(target, chosen);
                }}
              />
              <table className="w-full text-small block md:table">
                <tbody className="block md:table-row-group">
                  {entries.map((e) => (
                    <tr key={e.id} className="border-t border-border-line align-top flex flex-wrap gap-x-16 md:table-row">
                      <td className="py-12 pr-16 text-text-secondary whitespace-nowrap">{e.occurredOn}</td>
                      <td className="py-12 pr-16 text-text-ink">{e.unitName}</td>
                      <td className="py-12 pr-16 text-text-secondary">
                        {labels[`catalog.ledger_entry_types.${e.entryType}.label`] ?? e.entryType}
                      </td>
                      <td className="py-12 pr-16 text-text-ink basis-full order-last md:basis-auto md:order-none">{e.description}</td>
                      <td className="py-12 pr-16 text-text-ink font-semibold whitespace-nowrap">
                        ฿{baht(Math.abs(e.amountThb))}
                      </td>
                      <td className="py-12 whitespace-nowrap">
                        {e.receiptId ? (
                          <a
                            href={`/api/ledger/receipts/${e.receiptId}`}
                            className="text-brand-andaman font-semibold hover:underline"
                            rel="noopener noreferrer"
                          >
                            {labels['ops.costs.receipt_view']}
                          </a>
                        ) : labels['ops.costs.receipt_attach'] ? (
                          <button
                            type="button"
                            className="text-brand-andaman font-semibold hover:underline disabled:opacity-50"
                            disabled={rowBusy === e.id}
                            onClick={() => {
                              rowTarget.current = e.id;
                              rowFileInput.current?.click();
                            }}
                          >
                            {rowBusy === e.id ? labels['ops.costs.receipt_uploading'] : labels['ops.costs.receipt_attach']}
                          </button>
                        ) : null}
                        {rowMessage?.id === e.id && (
                          <span
                            role={rowMessage.error ? 'alert' : 'status'}
                            className={`block mt-4 ${rowMessage.error ? 'text-state-error' : 'text-state-success'}`}
                          >
                            {rowMessage.text}
                          </span>
                        )}
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
