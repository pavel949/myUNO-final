'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';

interface RegisterFormLabels {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  passwordHelp: string;
  submit: string;
  errorGeneric: string;
  haveAccount: string;
  loginLink: string;
  claimAccountLink?: string;
}

function calculatePasswordStrength(pass: string): number {
  if (!pass) return 0;
  let score = 0;
  if (pass.length >= 8) score += 1;
  if (/[0-9]/.test(pass) || /[^a-zA-Z0-9]/.test(pass)) score += 1;
  if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) score += 1;
  if (pass.length >= 12) score += 1;
  return score;
}

export function RegisterForm({ labels }: { labels: RegisterFormLabels }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams?.get('next') || '';
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const passwordStrength = calculatePasswordStrength(password);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email, password }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error || labels.errorGeneric);
        return;
      }

      router.push(next || '/');
      router.refresh();
    } catch {
      setError(labels.errorGeneric);
    } finally {
      setLoading(false);
    }
  };

  const getSegmentColor = (index: number) => {
    if (passwordStrength <= index) return 'bg-border-line';
    if (passwordStrength === 1) return 'bg-state-error';
    if (passwordStrength === 2) return 'bg-state-warning';
    if (passwordStrength === 3) return 'bg-brand-sun';
    return 'bg-state-success';
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-24">
      <div className="grid grid-cols-2 gap-16">
        <Input
          label={labels.firstName}
          autoComplete="given-name"
          required
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
        />
        <Input
          label={labels.lastName}
          autoComplete="family-name"
          required
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
        />
      </div>
      <Input
        label={labels.email}
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <div>
        <Input
          label={labels.password}
          type="password"
          autoComplete="new-password"
          required
          helpText={labels.passwordHelp}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error || undefined}
        />
        {/* 4-segment strength meter (Phase 3 requirement) */}
        {password.length > 0 && (
          <div className="mt-8 flex gap-4" aria-label="Password strength meter">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className={`h-4 flex-1 rounded-full transition-colors duration-micro ${getSegmentColor(idx)}`}
              />
            ))}
          </div>
        )}
      </div>
      <Button type="submit" fullWidth isLoading={loading}>
        {labels.submit}
      </Button>
      <div className="flex flex-col gap-8 text-center">
        <p className="text-small text-text-secondary">
          {labels.haveAccount}{' '}
          <Link href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'} className="text-brand-andaman font-semibold hover:underline">
            {labels.loginLink}
          </Link>
        </p>
        <p className="text-small text-text-secondary">
          <Link href="/auth/claim" className="text-brand-andaman hover:underline">
            {labels.claimAccountLink || 'Already made a booking? Claim your existing account'}
          </Link>
        </p>
      </div>
    </form>
  );
}
