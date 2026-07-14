import { Suspense } from 'react';
import TripsList from './trips-list';

export const dynamic = 'force-dynamic';

export default function TripsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 p-8"><p>Loading...</p></div>}>
      <TripsList />
    </Suspense>
  );
}
