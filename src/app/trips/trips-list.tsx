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
  pending_payment: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-green-100 text-green-800',
  checked_in: 'bg-blue-100 text-blue-800',
  checked_out: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
  requested: 'bg-orange-100 text-orange-800',
  declined: 'bg-red-100 text-red-800',
  expired: 'bg-gray-100 text-gray-800',
};

export default function TripsList() {
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
            router.push('/auth/login');
            return;
          }
          throw new Error('Failed to fetch trips');
        }
        const data: TripsResponse = await response.json();
        setTrips(data.bookings);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'An error occurred'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchTrips();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="text-center">
          <p className="text-gray-600">Loading your trips...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Trips</h1>
          <p className="text-gray-600">
            {trips.length} booking{trips.length !== 1 ? 's' : ''}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {trips.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <p className="text-gray-600 mb-4">No trips yet. Ready for your first adventure?</p>
            <a
              href="/"
              className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Search Stays
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {trips.map((trip) => (
              <div
                key={trip.id}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      {trip.unit.name}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {trip.project.name}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      statusColors[trip.status] ||
                      'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {trip.status
                      .replace(/_/g, ' ')
                      .replace(/\b\w/g, (l) => l.toUpperCase())}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b">
                  <div>
                    <p className="text-sm text-gray-600">Check-in</p>
                    <p className="font-semibold text-gray-900">
                      {new Date(trip.startDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Check-out</p>
                    <p className="font-semibold text-gray-900">
                      {new Date(trip.endDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total</p>
                    <p className="text-2xl font-bold text-blue-600">
                      ฿{trip.totalThb?.toLocaleString()}
                    </p>
                  </div>

                  {trip.status === 'pending_payment' && (
                    <div className="text-right">
                      <p className="text-sm text-orange-600 font-semibold mb-2">
                        Payment pending
                      </p>
                      <button
                        onClick={() => router.push(`/trips/${trip.id}/pay`)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                      >
                        Complete Payment
                      </button>
                    </div>
                  )}

                  {trip.status === 'confirmed' && (
                    <div className="text-right">
                      <p className="text-sm text-green-600 font-semibold">
                        Ready for check-in
                      </p>
                    </div>
                  )}
                </div>

                {trip.guestNote && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm text-gray-600 mb-1">Guest Note:</p>
                    <p className="text-gray-800">{trip.guestNote}</p>
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
