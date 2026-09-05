'use client';

import { useState } from 'react';
import { Button } from '@/components/Button';

export interface GuestAccessLabels {
  title: string;
  subtitle: string;
  bookingRef: string;
  bookingRefHint: string;
  email: string;
  submit: string;
  submitting: string;
  sent: string;
  errorGeneric: string;
}

/**
 * Guest access request (LY-7): booking reference + email → the way in
 * arrives by email (claim link or login link). The form never reveals
 * whether the pair matched — the confirmation text is always the same.
 */
export default function GuestAccessClient({ labels }: { labels: GuestAccessLabels }) {
  const [bookingRef, setBookingRef] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/guest-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingRef, email }),
      });
      if (!res.ok) throw new Error(labels.errorGeneric);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.errorGeneric);
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass =
    'h-48 px-12 rounded-sm bg-surface-paper border border-border-line text-text-ink ' +
    'focus:border-brand-andaman focus:ring-2 focus:ring-brand-andaman focus:outline-none w-full';

  return (
    <div className="min-h-screen bg-surface-ivory flex items-center justify-center p-24">
      <div className="bg-surface-paper border border-border-line rounded-lg p-32 w-full max-w-md">
        <h1 className="font-display text-display-xl font-semibold text-text-ink mb-8">{labels.title}</h1>
        <p className="text-body text-text-secondary mb-24">{labels.subtitle}</p>

        {sent ? (
          <div className="bg-state-success/10 border border-state-success rounded-lg p-16">
            <p className="text-body text-text-ink">{labels.sent}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-16">
            {error ? (
              <div className="bg-state-error/10 border border-state-error rounded-lg p-16">
                <p className="text-body text-state-error">{error}</p>
              </div>
            ) : null}
            <div>
              <label htmlFor="access-ref" className="text-small text-text-secondary block mb-4">
                {labels.bookingRef}
              </label>
              <input
                id="access-ref"
                type="text"
                required
                value={bookingRef}
                onChange={(e) => setBookingRef(e.target.value)}
                className={fieldClass}
              />
              <p className="text-small text-text-secondary mt-4">{labels.bookingRefHint}</p>
            </div>
            <div>
              <label htmlFor="access-email" className="text-small text-text-secondary block mb-4">
                {labels.email}
              </label>
              <input
                id="access-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={fieldClass}
              />
            </div>
            <Button type="submit" fullWidth disabled={submitting}>
              {submitting ? labels.submitting : labels.submit}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
