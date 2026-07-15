'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
}

export function RegisterForm({ labels }: { labels: RegisterFormLabels }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

      router.push('/');
      router.refresh();
    } catch {
      setError(labels.errorGeneric);
    } finally {
      setLoading(false);
    }
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
      <Button type="submit" fullWidth isLoading={loading}>
        {labels.submit}
      </Button>
      <p className="text-small text-text-secondary text-center">
        {labels.haveAccount}{' '}
        <Link href="/login" className="text-brand-andaman font-semibold hover:underline">
          {labels.loginLink}
        </Link>
      </p>
    </form>
  );
}
