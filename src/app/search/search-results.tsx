'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

interface Unit {
  id: string;
  name: string;
  baseNightlyThb: number;
  description?: string;
  projectId?: string;
}

interface SearchResult {
  units: Unit[];
  total: number;
  limit: number;
  offset: number;
}

export default function SearchResults() {
  const searchParams = useSearchParams();
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const adults = searchParams.get('adults') || '1';
  const children = searchParams.get('children') || '0';

  useEffect(() => {
    const fetchResults = async () => {
      if (!startDate || !endDate) {
        setError('Search dates are required');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          startDate,
          endDate,
          adultsCount: adults,
          childrenCount: children,
          limit: '50',
        });

        const response = await fetch(`/api/search/units?${params}`);
        if (!response.ok) {
          throw new Error('Failed to fetch results');
        }

        const data = await response.json();
        setResults(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'An error occurred'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [startDate, endDate, adults, children]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="text-center">
          <p className="text-gray-600">Loading results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Search Results
          </h1>
          <p className="text-gray-600">
            {startDate} to {endDate} • {parseInt(adults) + parseInt(children)} guests
          </p>
        </div>

        {results && results.units.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <p className="text-gray-600 mb-4">No units found matching your criteria.</p>
            <a
              href="/"
              className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              New Search
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {results?.units.map((unit) => (
              <a
                key={unit.id}
                href={`/units/${unit.id}?startDate=${startDate}&endDate=${endDate}&adults=${adults}&children=${children}`}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition"
              >
                <div className="aspect-video bg-gradient-to-br from-blue-400 to-blue-600" />
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {unit.name}
                  </h3>
                  <p className="text-2xl font-bold text-blue-600 mb-2">
                    ฿{unit.baseNightlyThb?.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600">per night</p>
                </div>
              </a>
            ))}
          </div>
        )}

        {results && results.total > results.limit && (
          <div className="mt-8 text-center">
            <p className="text-gray-600">
              Showing {results.units.length} of {results.total} results
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
