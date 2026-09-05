'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Claim {
  id: string;
  description: string;
  claimedAmountThb: number;
  filedAt: string;
  status: string;
  guestName: string;
  unitName: string;
  claimantName: string;
  preauthAmountThb: number | null;
  preauthStatus: string | null;
}

/**
 * Amounts are satang integers everywhere in the platform (CLAUDE.md money
 * rules). Converting explicitly at the point of display, rather than handing a
 * satang figure to a baht formatter, is what keeps a ฿1,250.50 claim from being
 * shown as ฿125,050.
 */
const baht = (satang: number) =>
  `฿${(satang / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ClaimsAdminClient({
  claims,
  approvalWindowHours,
  labels,
}: {
  claims: Claim[];
  approvalWindowHours: number;
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const decide = useCallback(
    async (id: string, decision: 'approve' | 'reject') => {
      setBusy(id);
      setError(null);
      const res = await fetch(`/api/admin/deposit-claims/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, resolutionNote: notes[id] ?? '' }),
      }).catch(() => null);

      if (res?.ok) {
        router.refresh();
      } else {
        const payload = await res?.json().catch(() => null);
        setError(payload?.error ?? labels['admin.claims.error']);
      }
      setBusy(null);
    },
    [notes, router, labels]
  );

  if (claims.length === 0) {
    return (
      <div className="p-24 bg-surface-paper border border-border-line rounded-lg text-center">
        <p className="text-body text-text-secondary">{labels['admin.claims.empty']}</p>
      </div>
    );
  }

  return (
    <div>
      {error ? (
        <p className="mb-16 text-small text-state-error" role="alert">
          {error}
        </p>
      ) : null}

      <ul className="flex flex-col gap-16">
        {claims.map((claim) => {
          const hoursSinceFiled = (Date.now() - new Date(claim.filedAt).getTime()) / 3_600_000;
          const hoursLeft = approvalWindowHours - hoursSinceFiled;
          const windowClosed = hoursLeft <= 0;
          const note = notes[claim.id] ?? '';
          const overHold =
            claim.preauthAmountThb !== null && claim.claimedAmountThb > claim.preauthAmountThb;

          return (
            <li key={claim.id} className="p-16 bg-surface-paper border border-border-line rounded-lg">
              <div className="flex flex-wrap gap-16 mb-12 text-small text-text-secondary">
                <span>{`${labels['admin.claims.guest']}: ${claim.guestName}`}</span>
                <span>{`${labels['admin.claims.unit']}: ${claim.unitName}`}</span>
                <span>{`${labels['admin.claims.filed_by']}: ${claim.claimantName}`}</span>
                <span>
                  {`${labels['admin.claims.filed_at']}: ${new Date(claim.filedAt).toLocaleString('sv-SE')}`}
                </span>
              </div>

              <p className="text-body text-text-ink mb-12 whitespace-pre-wrap">{claim.description}</p>

              <div className="flex flex-wrap gap-24 mb-12">
                <div>
                  <p className="text-xsmall text-text-secondary">{labels['admin.claims.claimed']}</p>
                  <p className="text-heading-3 font-semibold text-text-ink">
                    {baht(claim.claimedAmountThb)}
                  </p>
                </div>
                <div>
                  <p className="text-xsmall text-text-secondary">{labels['admin.claims.held']}</p>
                  <p className="text-heading-3 font-semibold text-text-ink">
                    {claim.preauthAmountThb === null ? '—' : baht(claim.preauthAmountThb)}
                  </p>
                </div>
              </div>

              {claim.preauthAmountThb === null ? (
                <p className="text-small text-text-secondary mb-12">
                  {labels['admin.claims.no_hold']}
                </p>
              ) : null}
              {overHold ? (
                <p className="text-small text-text-secondary mb-12">
                  {labels['admin.claims.over_hold']}
                </p>
              ) : null}

              <label className="block mb-12">
                <span className="text-small text-text-secondary block mb-4">
                  {labels['admin.claims.note']}
                </span>
                <textarea
                  value={note}
                  onChange={(e) => setNotes({ ...notes, [claim.id]: e.target.value })}
                  rows={2}
                  className="w-full px-12 py-8 border border-border-line rounded-lg bg-surface-ivory text-text-ink text-small"
                />
              </label>

              <div className="flex flex-wrap items-center gap-12">
                <button
                  type="button"
                  onClick={() => decide(claim.id, 'approve')}
                  disabled={busy !== null || windowClosed || !note.trim() || claim.preauthAmountThb === null}
                  className="px-16 py-8 rounded-lg bg-brand-deep text-on-dark-text text-small font-semibold disabled:opacity-50"
                >
                  {busy === claim.id ? labels['admin.claims.working'] : labels['admin.claims.approve']}
                </button>

                <button
                  type="button"
                  onClick={() => decide(claim.id, 'reject')}
                  disabled={busy !== null}
                  className="px-16 py-8 rounded-lg border border-border-line text-text-ink text-small font-semibold disabled:opacity-50"
                >
                  {labels['admin.claims.reject']}
                </button>

                <span className="text-xsmall text-text-secondary">
                  {windowClosed
                    ? labels['admin.claims.window_closed']
                    : `${Math.floor(hoursLeft)}h ${labels['admin.claims.window_left']}`}
                </span>
              </div>

              {!note.trim() && !windowClosed ? (
                <p className="mt-8 text-xsmall text-text-secondary">
                  {labels['admin.claims.note_required']}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      <p className="mt-24 text-xsmall text-text-secondary max-w-3xl">
        {labels['admin.claims.window_note']}
      </p>
    </div>
  );
}
