'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';

type Labels = Record<string, string>;

export default function ProviderApplyClient({
  categories,
  labels,
}: {
  categories: { key: string; label: string }[];
  labels: Labels;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/providers/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          contactEmail,
          contactPhone,
          categoryKeys: Array.from(selected),
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || labels['provider.apply.error_generic']);
      }
      setDone(true);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : labels['provider.apply.error_generic']
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="bg-surface-paper border border-border-line rounded-lg p-24">
        <p className="text-body text-state-success">{labels['provider.apply.success']}</p>
      </div>
    );
  }

  const inputClass =
    'w-full h-48 px-12 rounded-sm bg-surface-paper border border-border-line text-body text-text-ink focus:border-brand-andaman focus:outline-none';

  return (
    <form
      onSubmit={submit}
      className="bg-surface-paper border border-border-line rounded-lg p-24 flex flex-col gap-16"
    >
      <div>
        <h2 className="text-heading-3 font-bold text-text-ink mb-4">
          {labels['provider.apply.title']}
        </h2>
        <p className="text-body text-text-secondary">{labels['provider.apply.subtitle']}</p>
      </div>

      {error && (
        <div className="bg-state-error-soft border border-state-error rounded-lg p-16">
          <p className="text-body text-state-error">{error}</p>
        </div>
      )}

      <label className="flex flex-col gap-4">
        <span className="text-small text-text-secondary">{labels['provider.apply.name']}</span>
        <input
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </label>

      <label className="flex flex-col gap-4">
        <span className="text-small text-text-secondary">
          {labels['provider.apply.description']}
        </span>
        <textarea
          className="w-full px-12 py-8 rounded-sm bg-surface-paper border border-border-line text-body text-text-ink focus:border-brand-andaman focus:outline-none"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
      </label>

      <div className="grid md:grid-cols-2 gap-16">
        <label className="flex flex-col gap-4">
          <span className="text-small text-text-secondary">
            {labels['provider.apply.contact_email']}
          </span>
          <input
            type="email"
            className={inputClass}
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-4">
          <span className="text-small text-text-secondary">
            {labels['provider.apply.contact_phone']}
          </span>
          <input
            type="tel"
            className={inputClass}
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            required
          />
        </label>
      </div>

      <div>
        <p className="text-small text-text-secondary mb-8">
          {labels['provider.apply.categories']}
        </p>
        <div className="flex flex-wrap gap-8">
          {categories.map((category) => (
            <button
              key={category.key}
              type="button"
              onClick={() => toggle(category.key)}
              className={
                selected.has(category.key)
                  ? 'px-12 py-8 rounded-full text-small bg-brand-andaman text-on-dark-text'
                  : 'px-12 py-8 rounded-full text-small bg-surface-background border border-border-line text-text-ink hover:border-brand-andaman'
              }
            >
              {category.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Button type="submit" isLoading={submitting} disabled={selected.size === 0}>
          {labels['provider.apply.submit']}
        </Button>
      </div>
    </form>
  );
}
