'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { PasswordInput } from '@/components/PasswordInput';

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
  requestTitle: string;
  requestSubtitle: string;
  requestEmail: string;
  requestSubmit: string;
  requestSent: string;
  loginInstead: string;
}

interface ClaimIdentity {
  email: string;
  firstName: string;
  lastName: string;
}

/**
 * Account-claim landing (LY-7 / canvas board 18: "claim it instead").
 *
 * Two entry points share this one page:
 * - With a `?token=` (an emailed link, staff-generated or self-requested
 *   below): validates the token, lets the guest set a password, signs them
 *   in, and lands in their home space (or ?next=).
 * - With no token: a self-serve request form — register's "you already
 *   have one, claim it instead" line has to lead somewhere a guest with no
 *   link yet can actually use, not a dead end that only makes sense once
 *   staff has already emailed them one.
 */
export default function ClaimClient({ labels }: { labels: ClaimLabels }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get('token');
  const next = searchParams?.get('next') || '/trips';

  if (!token) {
    return <ClaimRequestForm labels={labels} />;
  }

  return <ClaimTokenForm labels={labels} token={token} next={next} router={router} />;
}

function ClaimRequestForm({ labels }: { labels: ClaimLabels }) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await fetch('/api/auth/claim/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } finally {
      // Enumeration-safe: this always succeeds from the caller's point of
      // view, whether or not the email matched an eligible account.
      setSubmitting(false);
      setSent(true);
    }
  };

  return (
    <div className="min-h-screen bg-surface-background flex items-center justify-center p-24">
      <div className="bg-surface-paper border border-border-line rounded-lg p-32 w-full max-w-md">
        <h1 className="text-heading-1 font-bold text-text-ink mb-8">{labels.requestTitle}</h1>
        <p className="text-body text-text-secondary mb-24">{labels.requestSubtitle}</p>

        {sent ? (
          <div className="bg-state-success-soft border border-state-success rounded-lg p-16">
            <p className="text-body text-state-success">{labels.requestSent}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-16">
            <Input
              label={labels.requestEmail}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit" fullWidth isLoading={submitting}>
              {labels.requestSubmit}
            </Button>
          </form>
        )}

        <p className="text-small text-text-secondary text-center mt-24">
          <Link href="/login" className="text-brand-andaman font-semibold hover:underline">
            {labels.loginInstead}
          </Link>
        </p>
      </div>
    </div>
  );
}

function ClaimTokenForm({
  labels,
  token,
  next,
  router,
}: {
  labels: ClaimLabels;
  token: string;
  next: string;
  router: ReturnType<typeof useRouter>;
}) {
  const [identity, setIdentity] = useState<ClaimIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
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
    if (!identity) return;
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

  return (
    <div className="min-h-screen bg-surface-background flex items-center justify-center p-24">
      <div className="bg-surface-paper border border-border-line rounded-lg p-32 w-full max-w-md">
        <h1 className="text-heading-1 font-bold text-text-ink mb-8">{labels.title}</h1>
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
            <PasswordInput
              label={labels.password}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <PasswordInput
              label={labels.passwordConfirm}
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            <Button type="submit" fullWidth isLoading={submitting}>
              {labels.submit}
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
