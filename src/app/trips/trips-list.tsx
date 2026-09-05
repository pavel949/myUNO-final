'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SlaCountdown } from '@/components/SlaCountdown';

interface Booking {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  totalThb: number;
  holdExpiresAt?: string | null;
  guestNote?: string;
  unit: {
    id: string;
    name: string;
  };
  project: {
    id: string;
    name: string;
  };
  payments?: Array<{
    id: string;
    status: string;
    method: string;
    amountThb: number;
    succeededAt?: string;
  }>;
}

interface TripsResponse {
  bookings: Booking[];
  total: number;
}

const statusColors: Record<string, string> = {
  pending_payment: 'bg-state-warning-soft text-state-warning',
  confirmed: 'bg-state-success-soft text-state-success',
  checked_in: 'bg-state-info-soft text-state-info',
  checked_out: 'bg-surface-ivory text-text-ink',
  cancelled: 'bg-state-error-soft text-state-error',
  requested: 'bg-state-warning-soft text-state-warning',
  declined: 'bg-state-error-soft text-state-error',
  expired: 'bg-surface-ivory text-text-ink',
};

interface TripsListProps {
  labels: Record<string, string>;
}

export default function TripsList({ labels }: TripsListProps) {
  const router = useRouter();
  const [trips, setTrips] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrips = async () => {
      try {
        const response = await fetch('/api/bookings/me');
        if (!response.ok) {
          if (response.status === 401) {
            router.push('/login?next=/trips');
            return;
          }
          throw new Error('Failed to fetch trips');
        }
        const data: TripsResponse = await response.json();
        setTrips(data.bookings);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : labels['booking.trips.fetch_error'] || 'An error occurred'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchTrips();
  }, [router, labels]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-ivory p-24 md:p-32">
        <div className="text-center">
          <p className="text-body text-text-secondary">{labels['booking.trips.loading']}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-ivory p-24 md:p-32">
      <div className="max-w-4xl mx-auto">
        <div className="mb-24">
          <h1 className="font-display text-display-xl font-semibold text-text-ink">
            {labels['booking.trips.title']}
          </h1>
          <p className="text-body text-text-secondary">
            {trips.length} {trips.length === 1 ? labels['booking.trips.count_singular'] : labels['booking.trips.count_plural']}
          </p>
        </div>

        {error && (
          <div className="bg-state-error-soft border border-state-error rounded-lg p-16 mb-24">
            <p className="text-body text-state-error">{error}</p>
          </div>
        )}

        {trips.length === 0 ? (
          <div className="bg-surface-paper border border-border-line rounded-lg p-32 text-center">
            <p className="text-body text-text-secondary mb-16">{labels['booking.trips.empty_title']}</p>
            <a
              href="/"
              className="inline-block h-48 px-24 leading-[48px] bg-brand-andaman text-surface-ivory rounded-sm hover:bg-brand-deep"
            >
              {labels['booking.trips.empty_action']}
            </a>
          </div>
        ) : (
          <div className="space-y-16">
            {trips.map((trip) => (
              <div
                key={trip.id}
                onClick={() => router.push(`/trips/${trip.id}`)}
                className="bg-surface-paper border border-border-line rounded-lg p-24 hover:shadow-card transition cursor-pointer"
              >
                <div className="flex items-start justify-between mb-16">
                  <div>
                    <h3 className="text-subtitle font-semibold text-text-ink">
                      {trip.unit.name}
                    </h3>
                    <p className="text-small text-text-secondary">
                      {trip.project.name}
                    </p>
                  </div>
                  <span
                    className={`px-12 py-4 rounded-full text-small font-semibold ${
                      statusColors[trip.status] ||
                      'bg-surface-ivory text-text-ink'
                    }`}
                  >
                    {trip.status
                      .replace(/_/g, ' ')
                      .replace(/\b\w/g, (l) => l.toUpperCase())}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-16 mb-16 pb-16 border-b border-border-line">
                  <div>
                    <p className="text-small text-text-secondary">{labels['booking.trips.check_in']}</p>
                    <p className="font-semibold text-text-ink">
                      {new Date(trip.startDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-small text-text-secondary">{labels['booking.trips.check_out']}</p>
                    <p className="font-semibold text-text-ink">
                      {new Date(trip.endDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-small text-text-secondary">{labels['booking.trips.total']}</p>
                    <p className="font-display text-title font-semibold text-brand-andaman tabular-nums">
                      ฿{trip.totalThb?.toLocaleString()}
                    </p>
                  </div>

                  {trip.status === 'pending_payment' && (
                    <div className="text-right">
                      <p className="text-small text-state-warning font-semibold mb-8">
                        {labels['booking.trips.payment_pending']}
                      </p>
                      {trip.holdExpiresAt ? (
                        <p className="text-small mb-8">
                          <SlaCountdown
                            deadline={trip.holdExpiresAt}
                            leftTemplate={labels['booking.trips.hold_expires']}
                            overdueLabel={labels['booking.trips.hold_expired']}
                          />
                        </p>
                      ) : null}
                      <button
                        onClick={(e) => { e.stopPropagation(); router.push(`/trips/${trip.id}`); }}
                        className="h-40 px-16 bg-brand-andaman text-surface-ivory rounded-sm hover:bg-brand-deep text-small"
                      >
                        {labels['booking.trips.payment_action']}
                      </button>
                    </div>
                  )}

                  {trip.status === 'confirmed' && (
                    <div className="text-right">
                      <p className="text-small text-state-success font-semibold">
                        {labels['booking.trips.ready_checkin']}
                      </p>
                    </div>
                  )}
                </div>

                {trip.guestNote && (
                  <div className="mt-16 pt-16 border-t border-border-line">
                    <p className="text-small text-text-secondary mb-4">{labels['booking.trips.note_label']}</p>
                    <p className="text-body text-text-ink">{trip.guestNote}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
