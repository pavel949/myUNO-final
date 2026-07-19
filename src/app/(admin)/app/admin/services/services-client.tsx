'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';

interface AdminService {
  id: string;
  title: string;
  providerName: string;
  status: string;
  createdAt: string;
}

type Labels = Record<string, string>;

const statusStyle: Record<string, string> = {
  draft: 'bg-state-warning-soft text-state-warning',
  vetted: 'bg-state-success-soft text-state-success',
  rejected: 'bg-state-error-soft text-state-error',
};

export default function ServicesAdminClient({
  services,
  labels,
}: {
  services: AdminService[];
  labels: Labels;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const act = async (
    serviceId: string,
    action: 'approve' | 'reject',
    reason?: string
  ) => {
    setBusyId(serviceId);
    setError(null);
    try {
      const response = await fetch(`/api/admin/services/${serviceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...(reason ? { reason } : {}) }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || labels['admin.services.error_generic']);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['admin.services.error_generic']);
    } finally {
      setBusyId(null);
    }
  };

  if (services.length === 0) {
    return (
      <div className="bg-surface-paper border border-border-line rounded-lg p-32">
        <p className="text-body text-text-secondary">{labels['admin.services.empty']}</p>
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
      {services.map((service) => (
        <div
          key={service.id}
          className="flex flex-col lg:flex-row lg:items-center gap-12 py-16 border-b border-border-line last:border-b-0"
        >
          <div className="flex-1 min-w-0">
            <p className="text-body font-semibold text-text-ink">
              {service.title}
              <span className="text-text-secondary font-normal"> · {service.providerName}</span>
            </p>
            <p className="text-small text-text-secondary">
              {new Date(service.createdAt).toLocaleDateString()}
            </p>
          </div>
          <span
            className={`self-start px-12 py-4 rounded-full text-small font-semibold ${
              statusStyle[service.status] || 'bg-surface-ivory text-text-ink'
            }`}
          >
            {labels[`admin.services.status_${service.status}`] || service.status}
          </span>
          <div className="flex items-center gap-8">
            {service.status === 'draft' && (
              <>
                <Button
                  size="sm"
                  variant="sun"
                  onClick={() => act(service.id, 'approve')}
                  isLoading={busyId === service.id}
                >
                  {labels['admin.services.approve']}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const reason = (rejectionReasons[service.id] || '').trim();
                    if (!reason) {
                      setError('Rejection reason required');
                      return;
                    }
                    act(service.id, 'reject', reason);
                  }}
                  isLoading={busyId === service.id}
                >
                  {labels['admin.services.reject']}
                </Button>
                <input
                  type="text"
                  value={rejectionReasons[service.id] || ''}
                  onChange={(e) =>
                    setRejectionReasons((prev) => ({ ...prev, [service.id]: e.target.value }))
                  }
                  placeholder={labels['admin.services.reason_placeholder']}
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
