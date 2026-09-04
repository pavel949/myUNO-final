'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { GoogleLoginButton } from './google-login-button';

interface LoginFormLabels {
  email: string;
  password: string;
  submit: string;
  errorGeneric: string;
  errorInvalidCredentials: string;
  errorRateLimited: string;
  noAccount: string;
  registerLink: string;
  forgotPassword: string;
  googleButton: string;
  divider: string;
}

export function LoginForm({ labels }: { labels: LoginFormLabels }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const errorMessageFromResponse = (body: unknown) => {
    if (!body || typeof body !== 'object') return labels.errorGeneric;

    const code = 'code' in body ? (body as { code?: unknown }).code : undefined;
    if (code === 'invalid_credentials') return labels.errorInvalidCredentials;
    if (code === 'rate_limited') return labels.errorRateLimited;

    const message = 'error' in body ? (body as { error?: unknown }).error : undefined;
    return typeof message === 'string' && message.length > 0
      ? message
      : labels.errorGeneric;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(errorMessageFromResponse(body));
        return;
      }

      const next = searchParams.get('next');
      router.push(next && next.startsWith('/') ? next : '/');
      router.refresh();
    } catch {
      setError(labels.errorGeneric);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-24">
      <GoogleLoginButton label={labels.googleButton} />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border-line"></div>
        </div>
        <div className="relative flex justify-center text-small">
          <span className="px-8 bg-surface-paper text-text-secondary">{labels.divider}</span>
        </div>
      </div>

      <Input
        label={labels.email}
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Input
        label={labels.password}
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={undefined}
      />
      {error && (
        <p className="text-small text-state-error" role="alert" aria-live="polite">
          {error}
        </p>
      )}
      <Button type="submit" fullWidth isLoading={loading}>
        {labels.submit}
      </Button>
      <div className="flex flex-col gap-8 text-center">
        <p className="text-small text-text-secondary">
          {labels.noAccount}{' '}
          <Link href="/register" className="text-brand-andaman font-semibold hover:underline">
            {labels.registerLink}
          </Link>
        </p>
        <Link
          href="/auth/reset-password"
          className="text-small text-brand-andaman hover:underline"
        >
          {labels.forgotPassword}
        </Link>
      </div>
    </form>
  );
}
