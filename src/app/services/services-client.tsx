'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

interface Service {
  id: string;
  title: string;
  description?: string;
  categoryKey: string;
  priceModel: string;
  basePriceThb?: number;
  status: string;
  createdAt: string;
  provider: {
    id: string;
    name: string;
    status: string;
    vetted_at?: string;
  };
  isVetted: boolean;
}

interface ServicesClientProps {
  projectId?: string;
}

export default function ServicesClient({}: ServicesClientProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const fetchServices = useCallback(async () => {
    try {
      setLoading(true);
      const url = new URL('/api/services', window.location.origin);
      if (selectedCategory) {
        url.searchParams.set('categoryKey', selectedCategory);
      }
      const response = await fetch(url.toString());
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setServices(data || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch services:', err);
      setError('Failed to load services');
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  // Extract unique categories from services
  const categories = Array.from(
    new Set(services.map((s) => s.categoryKey))
  );

  if (loading) {
    return <div className="text-center py-8">Loading services...</div>;
  }

  if (error) {
    return <div className="text-red-600 py-8">{error}</div>;
  }

  const filteredServices = selectedCategory
    ? services.filter((s) => s.categoryKey === selectedCategory)
    : services;

  return (
    <div>
      {/* Category filter chips */}
      {categories.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-full font-medium transition ${
              selectedCategory === null
                ? 'bg-brand-teal text-white'
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
          >
            All Services
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full font-medium transition capitalize ${
                selectedCategory === cat
                  ? 'bg-brand-teal text-white'
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Services grid */}
      {filteredServices.length === 0 ? (
        <div className="text-gray-500 py-8 text-center">
          <p>No services available</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map((service) => (
            <Link
              key={service.id}
              href={`/services/${service.id}`}
              className="border border-gray-200 rounded-lg p-6 bg-white hover:shadow-lg transition"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {service.title}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    by {service.provider.name}
                  </p>
                </div>
                {service.isVetted && (
                  <div className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                    Vetted
                  </div>
                )}
              </div>

              <p className="text-gray-600 text-sm mb-4">
                {service.description || 'No description'}
              </p>

              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Category:</span>
                  <span className="text-gray-600 ml-2 capitalize">
                    {service.categoryKey}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Price Model:</span>
                  <span className="text-gray-600 ml-2 capitalize">
                    {service.priceModel}
                  </span>
                </div>
                {service.basePriceThb && (
                  <div>
                    <span className="font-medium text-gray-700">Base Price:</span>
                    <span className="text-gray-600 ml-2">
                      ฿{service.basePriceThb.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-gray-200">
                <button className="text-brand-teal font-medium text-sm hover:underline">
                  View Details →
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
