'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';

interface LoginFormLabels {
  email: string;
  password: string;
  submit: string;
  errorGeneric: string;
  noAccount: string;
  registerLink: string;
  forgotPassword: string;
}

export function LoginForm({ labels }: { labels: LoginFormLabels }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
        setError(body?.error || labels.errorGeneric);
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
        error={error || undefined}
      />
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
