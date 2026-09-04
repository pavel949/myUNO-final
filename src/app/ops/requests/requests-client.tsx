'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';

interface OpsBookingRequestRow {
  id: string;
  startDate: string;
  endDate: string;
  totalThb: number;
  requestExpiresAt: string | null;
  adults: number;
  children: number;
  guestName: string;
  projectName: string;
  unitId: string;
  unitName: string;
  unitCalendarHref: string;
}

export default function OpsRequestsClient({
  requests,
  showProjectName,
  labels,
}: {
  requests: OpsBookingRequestRow[];
  showProjectName: boolean;
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const respond = async (bookingId: string, action: 'approve' | 'decline') => {
    if (action === 'decline' && !window.confirm(labels['staff.ops.confirm_decline_request'])) {
      return;
    }
    setBusyId(bookingId);
    setError(null);
    try {
      const response = await fetch(`/api/bookings/${bookingId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || labels['staff.ops.error_generic']);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['staff.ops.error_generic']);
    } finally {
      setBusyId(null);
    }
  };

  if (requests.length === 0) {
    return <p className="text-body text-text-secondary">{labels['staff.ops.requests_empty']}</p>;
  }

  return (
    <div>
      {error && (
        <div className="mb-16 bg-state-error-soft border border-state-error rounded-lg p-12">
          <p className="text-small text-state-error">{error}</p>
        </div>
      )}
      <ul className="space-y-0 bg-surface-paper border border-border-line rounded-lg divide-y divide-border-line">
        {requests.map((request) => {
          const party = request.adults + request.children;
          return (
            <li key={request.id} className="p-20 flex flex-col md:flex-row md:items-center gap-16">
              <div className="flex-1 min-w-0">
                <p className="text-body font-semibold text-text-ink">
                  {request.guestName}
                  <span className="text-text-secondary font-normal">
                    {' · '}
                    <Link
                      href={request.unitCalendarHref}
                      className="text-brand-andaman hover:underline"
                    >
                      {request.unitName}
                    </Link>
                  </span>
                </p>
                <p className="text-small text-text-secondary mt-4">
                  {showProjectName ? (
                    <>
                      {request.projectName}
                      {' · '}
                    </>
                  ) : null}
                  {new Date(request.startDate).toLocaleDateString()} —{' '}
                  {new Date(request.endDate).toLocaleDateString()} · {party}{' '}
                  {labels['staff.ops.guest'].toLowerCase()} · ฿{request.totalThb.toLocaleString()}
                </p>
                {request.requestExpiresAt ? (
                  <p className="text-small text-state-warning mt-4">
                    {labels['staff.ops.request_expires']}:{' '}
                    {new Date(request.requestExpiresAt).toLocaleString()}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-8 shrink-0">
                <Button
                  size="sm"
                  variant="sun"
                  onClick={() => void respond(request.id, 'approve')}
                  isLoading={busyId === request.id}
                >
                  {labels['staff.ops.approve_request']}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void respond(request.id, 'decline')}
                  isLoading={busyId === request.id}
                >
                  {labels['staff.ops.decline_request']}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
