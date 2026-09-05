'use client';

import { useState, useCallback, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';

interface Statement {
  id: string;
  periodStart: string;
  periodEnd: string;
  ownerName: string;
  unitName: string;
  noiTh: number;
  status: string;
  signedOffByOperatorAt: string | null;
}

interface LineItemRow {
  id: string;
  category: string;
  description: string;
  amountThb: number;
}

type Labels = Record<string, string>;

const statusStyle: Record<string, string> = {
  draft: 'bg-state-warning-soft text-state-warning',
  pending_owner_review: 'bg-state-warning-soft text-state-warning',
  published: 'bg-state-info-soft text-state-info',
  signed_off: 'bg-state-success-soft text-state-success',
  distributed: 'bg-state-success-soft text-state-success',
  superseded: 'bg-surface-ivory text-text-stone',
};

// Mirrors SIGNABLE_STATEMENT_STATUSES (src/modules/finance/statement-signoff.service.ts) —
// a closed statement (signed_off, distributed, superseded) can never be re-signed.
const SIGNABLE_STATUSES = new Set(['draft', 'published', 'pending_owner_review']);

const todayIso = () => new Date().toISOString().slice(0, 10);
const firstOfMonthIso = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 10);
};

export default function StatementActions({
  units,
  statements,
  labels,
}: {
  units: { id: string; label: string }[];
  statements: Statement[];
  labels: Labels;
}) {
  const router = useRouter();

  const [unitId, setUnitId] = useState(units[0]?.id || '');
  const [periodStart, setPeriodStart] = useState(firstOfMonthIso());
  const [periodEnd, setPeriodEnd] = useState(todayIso());
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateSuccess, setGenerateSuccess] = useState(false);

  const [signingId, setSigningId] = useState<string | null>(null);
  const [signError, setSignError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lineItems, setLineItems] = useState<LineItemRow[]>([]);
  const [linesLoading, setLinesLoading] = useState(false);
  const [linesError, setLinesError] = useState<string | null>(null);

  const generate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setGenerating(true);
      setGenerateError(null);
      setGenerateSuccess(false);
      try {
        const res = await fetch('/api/admin/statements/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ unitId, periodStart, periodEnd }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || labels['admin.statements.error']);
        setGenerateSuccess(true);
        router.refresh();
      } catch (err) {
        setGenerateError(err instanceof Error ? err.message : labels['admin.statements.error']);
      } finally {
        setGenerating(false);
      }
    },
    [unitId, periodStart, periodEnd, labels, router]
  );

  const signOff = useCallback(
    async (statementId: string) => {
      setSigningId(statementId);
      setSignError(null);
      try {
        const res = await fetch(`/api/admin/statements/${statementId}/sign-off`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ actor: 'operator' }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || labels['admin.statements.error']);
        router.refresh();
      } catch (err) {
        setSignError(err instanceof Error ? err.message : labels['admin.statements.error']);
      } finally {
        setSigningId(null);
      }
    },
    [labels, router]
  );

  const toggleLineItems = useCallback(
    async (statementId: string) => {
      if (expandedId === statementId) {
        setExpandedId(null);
        setLineItems([]);
        return;
      }
      setExpandedId(statementId);
      setLinesLoading(true);
      setLinesError(null);
      try {
        const res = await fetch(`/api/admin/statements/${statementId}/line-items`);
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || labels['admin.statements.error']);
        setLineItems(Array.isArray(data.lineItems) ? data.lineItems : []);
      } catch (err) {
        setLinesError(err instanceof Error ? err.message : labels['admin.statements.error']);
        setLineItems([]);
      } finally {
        setLinesLoading(false);
      }
    },
    [expandedId, labels]
  );

  return (
    <div className="flex flex-col gap-24">
      <form
        onSubmit={generate}
        className="bg-surface-paper border border-border-line rounded-lg p-24 flex flex-col gap-12"
      >
        <div>
          <h2 className="text-heading-3 font-bold text-text-ink mb-4">
            {labels['admin.statements.generate_title']}
          </h2>
          <p className="text-small text-text-secondary">
            {labels['admin.statements.generate_subtitle']}
          </p>
        </div>

        {units.length === 0 ? (
          <p className="text-body text-text-secondary">{labels['admin.statements.unit_empty']}</p>
        ) : (
          <>
            <div className="grid md:grid-cols-3 gap-12">
              <label className="flex flex-col gap-4">
                <span className="text-small text-text-secondary">
                  {labels['admin.statements.field_unit']}
                </span>
                <select
                  className="h-40 px-12 rounded-sm border border-border-line text-body text-text-ink"
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-4">
                <span className="text-small text-text-secondary">
                  {labels['admin.statements.field_period_start']}
                </span>
                <input
                  type="date"
                  className="h-40 px-12 rounded-sm border border-border-line text-body text-text-ink"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-4">
                <span className="text-small text-text-secondary">
                  {labels['admin.statements.field_period_end']}
                </span>
                <input
                  type="date"
                  className="h-40 px-12 rounded-sm border border-border-line text-body text-text-ink"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                />
              </label>
            </div>

            {generateError && (
              <p className="text-small text-state-error" role="alert">
                {generateError}
              </p>
            )}
            {generateSuccess && (
              <p className="text-small text-state-success">
                {labels['admin.statements.generate_success']}
              </p>
            )}

            <div>
              <Button type="submit" isLoading={generating}>
                {generating
                  ? labels['admin.statements.generate_working']
                  : labels['admin.statements.generate_submit']}
              </Button>
            </div>
          </>
        )}
      </form>

      {signError && (
        <p className="text-small text-state-error" role="alert">
          {signError}
        </p>
      )}

      {statements.length === 0 ? (
        <p className="text-body text-text-secondary">{labels['admin.statements.empty']}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-small">
            <thead>
              <tr className="border-b border-border-line">
                <th className="px-12 py-12 text-left">{labels['admin.statements.period']}</th>
                <th className="px-12 py-12 text-left">{labels['admin.statements.owner']}</th>
                <th className="px-12 py-12 text-left">{labels['admin.statements.unit']}</th>
                <th className="px-12 py-12 text-right">{labels['admin.statements.net']}</th>
                <th className="px-12 py-12 text-left">{labels['admin.statements.status']}</th>
                <th className="px-12 py-12 text-left">{labels['admin.statements.action']}</th>
              </tr>
            </thead>
            <tbody>
              {statements.map((s) => (
                <Fragment key={s.id}>
                  <tr className="border-b border-border-line">
                    <td className="px-12 py-8">
                      {`${new Date(s.periodStart).toLocaleDateString()} – ${new Date(s.periodEnd).toLocaleDateString()}`}
                    </td>
                    <td className="px-12 py-8">{s.ownerName}</td>
                    <td className="px-12 py-8">{s.unitName}</td>
                    <td className="px-12 py-8 text-right font-mono">{(s.noiTh / 100).toFixed(2)}</td>
                    <td className="px-12 py-8">
                      <span
                        className={`px-8 py-2 rounded-full text-xsmall font-medium ${
                          statusStyle[s.status] || 'bg-surface-ivory text-text-ink'
                        }`}
                      >
                        {labels[`admin.statements.status.${s.status}`] || s.status}
                      </span>
                    </td>
                    <td className="px-12 py-8 flex flex-wrap gap-8">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleLineItems(s.id)}
                        isLoading={linesLoading && expandedId === s.id}
                      >
                        {expandedId === s.id
                          ? labels['admin.statements.hide_lines']
                          : labels['admin.statements.view_lines']}
                      </Button>
                      {s.signedOffByOperatorAt ? (
                        <span className="text-text-secondary">
                          {labels['admin.statements.signed_off_note']}
                        </span>
                      ) : SIGNABLE_STATUSES.has(s.status) ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => signOff(s.id)}
                          isLoading={signingId === s.id}
                        >
                          {signingId === s.id
                            ? labels['admin.statements.working']
                            : labels['admin.statements.sign_off']}
                        </Button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                  {expandedId === s.id ? (
                    <tr key={`${s.id}-lines`} className="border-b border-border-line bg-surface-ivory">
                      <td colSpan={6} className="px-24 py-12">
                        {linesError ? (
                          <p className="text-small text-state-error">{linesError}</p>
                        ) : linesLoading ? (
                          <p className="text-small text-text-secondary">
                            {labels['admin.statements.lines_loading']}
                          </p>
                        ) : lineItems.length === 0 ? (
                          <p className="text-small text-text-secondary">
                            {labels['admin.statements.lines_empty']}
                          </p>
                        ) : (
                          <table className="w-full text-small">
                            <thead>
                              <tr>
                                <th className="text-left py-4">{labels['admin.statements.lines_category']}</th>
                                <th className="text-left py-4">{labels['admin.statements.lines_description']}</th>
                                <th className="text-right py-4">{labels['admin.statements.lines_amount']}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {lineItems.map((item) => (
                                <tr key={item.id}>
                                  <td className="py-4">{item.category}</td>
                                  <td className="py-4">{item.description}</td>
                                  <td className="py-4 text-right font-mono">
                                    {(item.amountThb / 100).toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
