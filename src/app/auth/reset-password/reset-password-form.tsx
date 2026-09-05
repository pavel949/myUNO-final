'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { PasswordInput } from '@/components/PasswordInput';

interface ResetPasswordLabels {
  title: string;
  requestSubtitle: string;
  confirmSubtitle: string;
  email: string;
  newPassword: string;
  newPasswordConfirm: string;
  passwordHelp: string;
  errorMismatch: string;
  requestSubmit: string;
  confirmSubmit: string;
  requestSent: string;
  success: string;
  errorGeneric: string;
  backToLogin: string;
}

export function ResetPasswordForm({ labels }: { labels: ResetPasswordLabels }) {
  const searchParams = useSearchParams();
  const token = searchParams?.get('token');

  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setMessage(labels.requestSent);
    } catch {
      setError(labels.errorGeneric);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError(labels.errorMismatch);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error || labels.errorGeneric);
        return;
      }
      setMessage(labels.success);
    } catch {
      setError(labels.errorGeneric);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-heading-2 font-bold text-text-ink mb-8">{labels.title}</h1>
      <p className="text-body text-text-secondary mb-32">
        {token ? labels.confirmSubtitle : labels.requestSubtitle}
      </p>

      {message ? (
        <p className="text-body text-text-ink mb-24">{message}</p>
      ) : token ? (
        <form onSubmit={handleConfirm} className="flex flex-col gap-24">
          <PasswordInput
            label={labels.newPassword}
            autoComplete="new-password"
            required
            helpText={labels.passwordHelp}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <PasswordInput
            label={labels.newPasswordConfirm}
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={error || undefined}
          />
          <Button type="submit" fullWidth isLoading={loading}>
            {labels.confirmSubmit}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleRequest} className="flex flex-col gap-24">
          <Input
            label={labels.email}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error || undefined}
          />
          <Button type="submit" fullWidth isLoading={loading}>
            {labels.requestSubmit}
          </Button>
        </form>
      )}

      <p className="text-small text-center mt-24">
        <Link href="/login" className="text-brand-andaman font-semibold hover:underline">
          {labels.backToLogin}
        </Link>
      </p>
    </div>
  );
}
