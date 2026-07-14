import { Suspense } from 'react';
import SearchResults from './search-results';

export const dynamic = 'force-dynamic';

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 p-8"><p>Loading...</p></div>}>
      <SearchResults />
    </Suspense>
  );
}
