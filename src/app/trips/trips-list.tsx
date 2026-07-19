'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Booking {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  totalThb: number;
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
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-background p-8">
        <div className="text-center">
          <p className="text-text-secondary">{labels['booking.trips.loading']}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-ink">{labels['booking.trips.title']}</h1>
          <p className="text-text-secondary">
            {trips.length} booking{trips.length !== 1 ? 's' : ''}
          </p>
        </div>

        {error && (
          <div className="bg-state-error-soft border border-state-error rounded-lg p-4 mb-6">
            <p className="text-state-error">{error}</p>
          </div>
        )}

        {trips.length === 0 ? (
          <div className="bg-surface-paper border border-border-line rounded-lg p-8 text-center">
            <p className="text-text-secondary mb-4">{labels['booking.trips.empty_title']}</p>
            <a
              href="/"
              className="inline-block px-6 py-2 bg-brand-andaman text-surface-ivory rounded-lg hover:bg-brand-deep"
            >
              {labels['booking.trips.empty_action']}
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {trips.map((trip) => (
              <div
                key={trip.id}
                onClick={() => router.push(`/trips/${trip.id}`)}
                className="bg-surface-paper border border-border-line rounded-lg p-6 hover:shadow-lg transition cursor-pointer"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-text-ink">
                      {trip.unit.name}
                    </h3>
                    <p className="text-sm text-text-secondary">
                      {trip.project.name}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      statusColors[trip.status] ||
                      'bg-surface-ivory text-text-ink'
                    }`}
                  >
                    {trip.status
                      .replace(/_/g, ' ')
                      .replace(/\b\w/g, (l) => l.toUpperCase())}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b">
                  <div>
                    <p className="text-sm text-text-secondary">{labels['booking.trips.check_in']}</p>
                    <p className="font-semibold text-text-ink">
                      {new Date(trip.startDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-text-secondary">{labels['booking.trips.check_out']}</p>
                    <p className="font-semibold text-text-ink">
                      {new Date(trip.endDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-text-secondary">{labels['booking.trips.total']}</p>
                    <p className="text-2xl font-bold text-brand-andaman">
                      ฿{trip.totalThb?.toLocaleString()}
                    </p>
                  </div>

                  {trip.status === 'pending_payment' && (
                    <div className="text-right">
                      <p className="text-sm text-state-warning font-semibold mb-2">
                        {labels['booking.trips.payment_pending']}
                      </p>
                      <button
                        onClick={(e) => { e.stopPropagation(); router.push(`/trips/${trip.id}`); }}
                        className="px-4 py-2 bg-brand-andaman text-surface-ivory rounded-lg hover:bg-brand-deep text-sm"
                      >
                        {labels['booking.trips.payment_action']}
                      </button>
                    </div>
                  )}

                  {trip.status === 'confirmed' && (
                    <div className="text-right">
                      <p className="text-sm text-state-success font-semibold">
                        {labels['booking.trips.ready_checkin']}
                      </p>
                    </div>
                  )}
                </div>

                {trip.guestNote && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm text-text-secondary mb-1">{labels['booking.trips.note_label']}</p>
                    <p className="text-text-ink">{trip.guestNote}</p>
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
