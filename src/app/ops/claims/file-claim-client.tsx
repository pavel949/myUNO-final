'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Textarea } from '@/components/Textarea';

interface Stay {
  bookingId: string;
  unitName: string;
  guestName: string;
  checkedOutAt: string;
  hoursLeft: number;
  preauthAmountThb: number | null;
  existingClaims: number;
}

/** Satang everywhere in the platform; baht only at the edge where a human reads it. */
const baht = (satang: number) =>
  `฿${(satang / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function FileClaimClient({
  stays,
  labels,
}: {
  stays: Stay[];
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const [forms, setForms] = useState<Record<string, { description: string; amount: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const file = useCallback(
    async (bookingId: string) => {
      const form = forms[bookingId];
      if (!form) return;

      setBusy(bookingId);
      setError(null);

      // Typed in baht, sent in satang — rounded once, so "1250.50" cannot
      // become a fraction of a satang.
      const claimedAmountThb = Math.round(Number(form.amount) * 100);

      const res = await fetch(`/api/bookings/${bookingId}/deposit-claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: form.description, claimedAmountThb }),
      }).catch(() => null);

      if (res?.ok) {
        setDone(new Set([...done, bookingId]));
        router.refresh();
      } else {
        const payload = await res?.json().catch(() => null);
        setError(payload?.error ?? labels['staff.claims.error']);
      }
      setBusy(null);
    },
    [forms, done, router, labels]
  );

  if (stays.length === 0) {
    return (
      <div className="p-24 bg-surface-paper border border-border-line rounded-lg shadow-card text-center">
        <p className="text-body text-text-secondary">{labels['staff.claims.empty']}</p>
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
        {stays.map((stay) => {
          const form = forms[stay.bookingId] ?? { description: '', amount: '' };
          const amount = Number(form.amount);
          const overHold =
            stay.preauthAmountThb !== null &&
            Number.isFinite(amount) &&
            Math.round(amount * 100) > stay.preauthAmountThb;
          const ready =
            form.description.trim().length > 0 &&
            Number.isFinite(amount) &&
            amount > 0 &&
            stay.preauthAmountThb !== null;

          return (
            <li
              key={stay.bookingId}
              className="p-16 bg-surface-paper border border-border-line rounded-lg shadow-card"
            >
              <div className="flex flex-wrap gap-16 mb-12 text-small text-text-stone">
                <span>{`${labels['staff.claims.guest']}: ${stay.guestName}`}</span>
                <span>{`${labels['staff.claims.unit']}: ${stay.unitName}`}</span>
                <span>
                  {`${labels['staff.claims.checked_out']}: ${new Date(
                    stay.checkedOutAt
                  ).toLocaleDateString()}`}
                </span>
                <span>{`${stay.hoursLeft} ${labels['staff.claims.hours_left']}`}</span>
              </div>

              <p className="text-small text-text-ink mb-12">
                {`${labels['staff.claims.held']}: ${
                  stay.preauthAmountThb === null ? '—' : baht(stay.preauthAmountThb)
                }`}
              </p>

              {stay.preauthAmountThb === null ? (
                <p className="text-small text-text-secondary">{labels['staff.claims.no_hold']}</p>
              ) : done.has(stay.bookingId) ? (
                <p className="text-small text-text-ink">{labels['staff.claims.filed']}</p>
              ) : (
                <>
                  {stay.existingClaims > 0 ? (
                    <p className="text-small text-text-secondary mb-12">
                      {labels['staff.claims.existing']}
                    </p>
                  ) : null}

                  <div className="mb-12">
                    <Textarea
                      label={labels['staff.claims.what']}
                      value={form.description}
                      onChange={(e) =>
                        setForms({
                          ...forms,
                          [stay.bookingId]: { ...form, description: e.target.value },
                        })
                      }
                      rows={2}
                    />
                  </div>

                  <div className="mb-12 max-w-xs">
                    <Input
                      label={labels['staff.claims.amount']}
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.amount}
                      onChange={(e) =>
                        setForms({
                          ...forms,
                          [stay.bookingId]: { ...form, amount: e.target.value },
                        })
                      }
                    />
                  </div>

                  {overHold ? (
                    <p className="text-small text-text-secondary mb-12">
                      {labels['staff.claims.over_hold']}
                    </p>
                  ) : null}

                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => file(stay.bookingId)}
                    disabled={!ready || busy !== null}
                    isLoading={busy === stay.bookingId}
                  >
                    {busy === stay.bookingId
                      ? labels['staff.claims.filing']
                      : labels['staff.claims.file']}
                  </Button>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
