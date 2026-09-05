'use client';

import { useEffect, useState } from 'react';

type Labels = Record<string, string>;

/**
 * Applicant vetting status — reads GET /api/provider/me so the route has a
 * product caller (the member queue uses the same endpoint in ProviderOrdersClient).
 */
export default function ProviderApplicationStatus({ labels }: { labels: Labels }) {
  const [name, setName] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/provider/me');
        if (!response.ok) {
          throw new Error('not found');
        }
        const data = await response.json();
        if (!cancelled) {
          setName(data.provider?.name ?? null);
          setStatus(data.provider?.status ?? null);
        }
      } catch {
        if (!cancelled) setError(labels['provider.application.error']);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [labels]);

  if (loading) {
    return (
      <div className="bg-surface-paper border border-border-line rounded-lg p-24">
        <p className="text-body text-text-secondary">{labels['provider.application.loading']}</p>
      </div>
    );
  }

  if (error || !name || !status) {
    return (
      <div className="bg-surface-paper border border-border-line rounded-lg p-24">
        <p className="text-body text-state-error">{error || labels['provider.application.error']}</p>
      </div>
    );
  }

  return (
    <div className="bg-surface-paper border border-border-line rounded-lg p-24">
      <h2 className="text-heading-3 font-bold text-text-ink mb-8">
        {labels['provider.application.title']}
      </h2>
      <p className="text-body font-semibold text-brand-andaman mb-8">
        {name} — {labels[`provider.status.${status}`] || status}
      </p>
      <p className="text-body text-text-secondary">{labels['provider.application.note']}</p>
    </div>
  );
}
