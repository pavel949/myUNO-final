'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';

type Labels = Record<string, string>;

const PRIORITIES = ['normal', 'high', 'urgent'];

export default function NewTicketClient({
  labels,
  categories,
}: {
  labels: Labels;
  categories: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams?.get('projectId');
  const unitId = searchParams?.get('unitId');
  const bookingId = searchParams?.get('bookingId');

  const [categoryKey, setCategoryKey] = useState('maintenance');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          unitId: unitId || undefined,
          bookingId: bookingId || undefined,
          categoryKey,
          title,
          description: description || undefined,
          priority,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || labels['tickets.new.error_generic']);
      }
      router.push('/tickets');
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['tickets.new.error_generic']);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-surface-ivory p-24 md:p-32">
      <div className="max-w-xl mx-auto">
        <p className="mb-8">
          <Link href="/tickets" className="text-brand-andaman font-semibold hover:underline">
            {labels['tickets.new.back']}
          </Link>
        </p>
        <h1 className="font-display text-display-xl font-semibold text-text-ink mb-24">
          {labels['tickets.new.title']}
        </h1>

        {!projectId ? (
          <div className="bg-surface-paper border border-border-line rounded-lg p-24">
            <p className="text-body text-text-secondary">
              {labels['tickets.new.missing_context']}
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-surface-paper border border-border-line rounded-lg p-24 flex flex-col gap-16"
          >
            <div className="flex flex-col gap-8">
              <p className="text-small text-text-stone">{labels['tickets.new.category']}</p>
              <div className="flex flex-wrap gap-8">
                {categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategoryKey(c)}
                    className={
                      categoryKey === c
                        ? 'rounded-full bg-brand-andaman px-16 py-8 text-small text-on-dark-text'
                        : 'rounded-full border border-border-line bg-surface-paper px-16 py-8 text-small text-text-ink'
                    }
                  >
                    {labels[`catalog.ticket_categories.${c}.label`] || c}
                  </button>
                ))}
              </div>
            </div>

            <Input
              label={labels['tickets.new.subject']}
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <div className="flex flex-col gap-8">
              <label htmlFor="ticket-description" className="text-small text-text-stone">
                {labels['tickets.new.description']}
              </label>
              <textarea
                id="ticket-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="px-12 py-12 rounded-sm bg-surface-paper border border-border-line text-body text-text-ink focus:border-brand-andaman focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-8">
              <label htmlFor="ticket-priority" className="text-small text-text-stone">
                {labels['tickets.new.priority']}
              </label>
              <select
                id="ticket-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="h-48 px-12 rounded-sm bg-surface-paper border border-border-line text-body text-text-ink"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {labels[`tickets.new.priority.${p}`] || p}
                  </option>
                ))}
              </select>
            </div>

            {error && <p className="text-small text-state-error">{error}</p>}

            <Button type="submit" isLoading={busy} disabled={!title.trim()}>
              {labels['tickets.new.submit']}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
