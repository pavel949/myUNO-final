'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/Button';

export interface ClaimLabels {
  title: string;
  subtitle: string;
  claimingFor: string;
  password: string;
  passwordConfirm: string;
  submit: string;
  submitting: string;
  errorMismatch: string;
  errorGeneric: string;
  errorInvalid: string;
  loading: string;
}

interface ClaimIdentity {
  email: string;
  firstName: string;
  lastName: string;
}

/**
 * Account-claim landing (LY-7): the page the emailed claim link opens.
 * Validates the token, lets the guest set a password, then signs them in
 * and lands in their home space (or ?next=).
 */
export default function ClaimClient({ labels }: { labels: ClaimLabels }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get('token');
  const next = searchParams?.get('next') || '/trips';

  const [identity, setIdentity] = useState<ClaimIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError(labels.errorInvalid);
      setLoading(false);
      return;
    }
    fetch(`/api/auth/claim/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error || labels.errorInvalid);
        setIdentity(body.identity);
      })
      .catch((err) => setError(err instanceof Error ? err.message : labels.errorInvalid))
      .finally(() => setLoading(false));
  }, [token, labels.errorInvalid]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !identity) return;
    if (password !== confirm) {
      setError(labels.errorMismatch);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const claimRes = await fetch('/api/auth/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const claimBody = await claimRes.json().catch(() => null);
      if (!claimRes.ok) throw new Error(claimBody?.error || labels.errorGeneric);

      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: identity.email, password }),
      });
      if (!loginRes.ok) {
        // Claimed but auto-login failed — the login page finishes the job
        router.push(`/login?next=${encodeURIComponent(next)}`);
        return;
      }
      router.push(next);
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

        {loading ? (
          <p className="text-body text-text-secondary">{labels.loading}</p>
        ) : null}

        {error ? (
          <div className="bg-state-error/10 border border-state-error rounded-lg p-16 mb-24">
            <p className="text-body text-state-error">{error}</p>
          </div>
        ) : null}

        {!loading && identity ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-16">
            <p className="text-small text-text-secondary">
              {labels.claimingFor} <span className="font-semibold text-text-ink">{identity.email}</span>
            </p>
            <div>
              <label htmlFor="claim-password" className="text-small text-text-secondary block mb-4">
                {labels.password}
              </label>
              <input
                id="claim-password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="claim-confirm" className="text-small text-text-secondary block mb-4">
                {labels.passwordConfirm}
              </label>
              <input
                id="claim-confirm"
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={fieldClass}
              />
            </div>
            <Button type="submit" fullWidth disabled={submitting}>
              {submitting ? labels.submitting : labels.submit}
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
