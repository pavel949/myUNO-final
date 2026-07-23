'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';

interface AdminProvider {
  id: string;
  name: string;
  email: string;
  status: string;
  createdAt: string;
}

type Labels = Record<string, string>;

const statusStyle: Record<string, string> = {
  applied: 'bg-state-warning-soft text-state-warning',
  approved: 'bg-state-success-soft text-state-success',
  rejected: 'bg-state-error-soft text-state-error',
};

export default function ProvidersAdminClient({
  providers,
  labels,
}: {
  providers: AdminProvider[];
  labels: Labels;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const act = async (
    providerId: string,
    action: 'approve' | 'reject',
    reason?: string
  ) => {
    setBusyId(providerId);
    setError(null);
    try {
      const response = await fetch(`/api/admin/providers/${providerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...(reason ? { reason } : {}) }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || labels['admin.providers.error_generic']);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['admin.providers.error_generic']);
    } finally {
      setBusyId(null);
    }
  };

  if (providers.length === 0) {
    return (
      <div className="bg-surface-paper border border-border-line rounded-lg p-32">
        <p className="text-body text-text-secondary">{labels['admin.providers.empty']}</p>
      </div>
    );
  }

  return (
    <div className="bg-surface-paper border border-border-line rounded-lg p-24">
      {error && (
        <div className="bg-state-error-soft border border-state-error rounded-lg p-16 mb-16">
          <p className="text-body text-state-error">{error}</p>
        </div>
      )}
      {providers.map((provider) => (
        <div
          key={provider.id}
          className="flex flex-col lg:flex-row lg:items-center gap-12 py-16 border-b border-border-line last:border-b-0"
        >
          <div className="flex-1 min-w-0">
            <p className="text-body font-semibold text-text-ink">
              {provider.name}
              <span className="text-text-secondary font-normal"> · {provider.email}</span>
            </p>
            <p className="text-small text-text-secondary">
              {new Date(provider.createdAt).toLocaleDateString()}
            </p>
          </div>
          <span
            className={`self-start px-12 py-4 rounded-full text-small font-semibold ${
              statusStyle[provider.status] || 'bg-surface-ivory text-text-ink'
            }`}
          >
            {labels[`admin.providers.status_${provider.status}`] || provider.status}
          </span>
          <div className="flex items-center gap-8">
            {provider.status === 'applied' && (
              <>
                <Button
                  size="sm"
                  variant="sun"
                  onClick={() => act(provider.id, 'approve')}
                  isLoading={busyId === provider.id}
                >
                  {labels['admin.providers.approve']}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const reason = (rejectionReasons[provider.id] || '').trim();
                    if (!reason) {
                      setError('Rejection reason required');
                      return;
                    }
                    act(provider.id, 'reject', reason);
                  }}
                  isLoading={busyId === provider.id}
                >
                  {labels['admin.providers.reject']}
                </Button>
                <input
                  type="text"
                  value={rejectionReasons[provider.id] || ''}
                  onChange={(e) =>
                    setRejectionReasons((prev) => ({ ...prev, [provider.id]: e.target.value }))
                  }
                  placeholder={labels['admin.providers.reason_placeholder']}
                  className="h-40 px-12 rounded-sm bg-surface-paper border border-border-line text-small text-text-ink"
                  style={{ width: '200px' }}
                />
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
