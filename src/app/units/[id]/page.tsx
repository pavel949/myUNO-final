'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface Unit {
  id: string;
  name: string;
  description?: string;
  baseNightlyThb: number;
  maxGuests?: number;
  minNights?: number;
  cleaningFeeThb?: number;
  cancellationPolicy?: string;
  projectId: string;
}

interface PriceBreakdown {
  nights: number;
  nightlyRate: number;
  subtotal: number;
  lengthOfStayDiscount: number;
  cleaningFee: number;
  subtotalAfterFees: number;
  serviceFee: number;
  total: number;
}

export default function UnitDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [unit, setUnit] = useState<Unit | null>(null);
  const [breakdown, setBreakdown] = useState<PriceBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingType, setBookingType] = useState<'instant' | 'request'>('instant');
  const [guestNote, setGuestNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const adults = parseInt(searchParams.get('adults') || '1');
  const children = parseInt(searchParams.get('children') || '0');

  useEffect(() => {
    const fetchUnit = async () => {
      try {
        const response = await fetch(`/api/admin/units/${params.id}`);
        if (!response.ok) throw new Error('Unit not found');
        const data = await response.json();
        setUnit(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load unit'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchUnit();
  }, [params.id]);

  useEffect(() => {
    const fetchBreakdown = async () => {
      if (!unit || !startDate || !endDate) return;

      try {
        const response = await fetch('/api/pricing/breakdown', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            unitId: unit.id,
            startDate,
            endDate,
          }),
        });

        if (!response.ok) throw new Error('Failed to calculate price');
        const data = await response.json();
        setBreakdown(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to calculate price'
        );
      }
    };

    fetchBreakdown();
  }, [unit, startDate, endDate]);

  const handleBooking = async () => {
    if (!startDate || !endDate || !breakdown) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId: unit!.id,
          projectId: unit!.projectId,
          startDate,
          endDate,
          adultsCount: adults,
          childrenCount: children,
          totalThb: breakdown.total,
          instantBook: bookingType === 'instant',
          guestNote: guestNote || undefined,
          paymentMethod: 'cash',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Booking failed');
      }

      const result = await response.json();

      if (result.checkout) {
        router.push(result.checkout.checkoutUrl);
      } else {
        router.push(`/trips/${result.booking.id}`);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Booking failed'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="text-center">
          <p className="text-gray-600">Loading unit details...</p>
        </div>
      </div>
    );
  }

  if (!unit) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error || 'Unit not found'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Unit details */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
              <div className="aspect-video bg-gradient-to-br from-blue-400 to-blue-600" />
              <div className="p-6">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {unit.name}
                </h1>
                <p className="text-gray-600 mb-4">
                  {unit.description || 'A beautiful unit in Phuket'}
                </p>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="border-t pt-4">
                    <p className="text-sm text-gray-600">Max Guests</p>
                    <p className="text-2xl font-semibold">
                      {unit.maxGuests || '2+'}
                    </p>
                  </div>
                  <div className="border-t pt-4">
                    <p className="text-sm text-gray-600">Min Stay</p>
                    <p className="text-2xl font-semibold">
                      {unit.minNights || '1'} night{unit.minNights !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm font-semibold text-gray-900 mb-2">
                    Cancellation Policy
                  </p>
                  <p className="text-gray-600">
                    {unit.cancellationPolicy || 'Flexible cancellation'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Booking widget */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                ฿{unit.baseNightlyThb?.toLocaleString()} / night
              </h2>

              {breakdown && (
                <div className="space-y-3 mb-6 pb-6 border-b">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      ฿{breakdown.nightlyRate?.toLocaleString()} × {breakdown.nights} nights
                    </span>
                    <span className="text-gray-900 font-semibold">
                      ฿{breakdown.subtotal?.toLocaleString()}
                    </span>
                  </div>
                  {breakdown.lengthOfStayDiscount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Long stay discount</span>
                      <span className="text-green-600 font-semibold">
                        -฿{breakdown.lengthOfStayDiscount?.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {breakdown.cleaningFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Cleaning fee</span>
                      <span className="text-gray-900 font-semibold">
                        ฿{breakdown.cleaningFee?.toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="text-blue-600">
                      ฿{breakdown.total?.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Booking Type
                </label>
                <select
                  value={bookingType}
                  onChange={(e) =>
                    setBookingType(e.target.value as 'instant' | 'request')
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="instant">Instant Book</option>
                  <option value="request">Request to Book</option>
                </select>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Guest Note (optional)
                </label>
                <textarea
                  value={guestNote}
                  onChange={(e) => setGuestNote(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  rows={3}
                  placeholder="Any special requests..."
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <button
                onClick={handleBooking}
                disabled={submitting || !breakdown}
                className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
              >
                {submitting ? 'Booking...' : 'Reserve'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
