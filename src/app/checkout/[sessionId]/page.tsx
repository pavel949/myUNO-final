'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface CheckoutPageProps {
  params: { sessionId: string };
}

export default function CheckoutPage({ params }: CheckoutPageProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);

  const handlePayment = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/checkout/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: params.sessionId }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Payment confirmation failed');
        setIsLoading(false);
        return;
      }

      const result = await response.json();

      if (result.confirmed || result.payment?.status === 'succeeded') {
        setSuccess(true);
        if (result.payment?.bookingId) {
          setBookingId(result.payment.bookingId);
        }
        // Redirect after 2 seconds
        setTimeout(() => {
          router.push('/bookings');
        }, 2000);
      } else {
        setError('Payment confirmation failed. Please try again.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full text-center">
          <div className="mb-4">
            <svg
              className="w-16 h-16 text-green-500 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Payment Confirmed
          </h1>
          <p className="text-gray-600 mb-4">
            Your booking has been confirmed successfully.
          </p>
          {bookingId && (
            <p className="text-sm text-gray-500 mb-6">
              Booking ID: {bookingId}
            </p>
          )}
          <p className="text-sm text-gray-500">
            Redirecting to your bookings...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Complete Payment
        </h1>

        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-gray-700">
            <span className="font-semibold">Mock Checkout</span>
          </p>
          <p className="text-xs text-gray-600 mt-1">
            This is a test checkout page. Click "Pay Now" to simulate card
            payment.
          </p>
        </div>

        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-gray-600">Session ID:</span>
            <span className="text-xs font-mono text-gray-800 truncate">
              {params.sessionId}
            </span>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <button
          onClick={handlePayment}
          disabled={isLoading}
          className="w-full py-3 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
        >
          {isLoading ? 'Processing...' : 'Pay Now'}
        </button>

        <p className="text-xs text-gray-500 text-center mt-4">
          No real payment will be charged during testing.
        </p>
      </div>
    </div>
  );
}
