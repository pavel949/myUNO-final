'use client';

import { useCallback, useEffect, useState } from 'react';

interface Service {
  id: string;
  title: string;
  description?: string;
  categoryKey: string;
  priceModel: string;
  basePriceThb?: number;
  status: string;
  approved_at?: string;
  createdAt: string;
}

interface ServicesClientProps {
  providerId: string;
}

export default function ServicesClient({ providerId }: ServicesClientProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    categoryKey: '',
    priceModel: 'fixed' as const,
    basePriceThb: 0,
  });

  const fetchServices = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/provider/services?providerId=${providerId}`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setServices(data || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch services:', err);
      setError('Failed to load your services');
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/provider/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          basePriceThb: parseFloat(formData.basePriceThb.toString()),
        }),
      });
      if (!response.ok) throw new Error('Failed to create');
      setFormData({
        title: '',
        description: '',
        categoryKey: '',
        priceModel: 'fixed',
        basePriceThb: 0,
      });
      setShowForm(false);
      await fetchServices();
    } catch (err) {
      console.error('Failed to create service:', err);
      alert('Failed to create service');
    }
  };

  const handleDelete = async (serviceId: string) => {
    if (!confirm('Are you sure you want to delete this service?')) return;
    try {
      const response = await fetch(`/api/provider/services/${serviceId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete');
      await fetchServices();
    } catch (err) {
      console.error('Failed to delete service:', err);
      alert('Failed to delete service');
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading your services...</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : 'Add Service'}
        </button>
      </div>

      {error && <div className="text-red-600 mb-6">{error}</div>}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="border border-gray-200 rounded-lg p-6 bg-white mb-8"
        >
          <h2 className="text-lg font-semibold mb-4">Create New Service</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Title *</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full border border-gray-300 rounded px-3 py-2"
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Category *</label>
              <input
                type="text"
                required
                value={formData.categoryKey}
                onChange={(e) =>
                  setFormData({ ...formData, categoryKey: e.target.value })
                }
                className="w-full border border-gray-300 rounded px-3 py-2"
                placeholder="e.g., concierge, cleaning, transportation"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Price Model *</label>
                <select
                  required
                  value={formData.priceModel}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      priceModel: e.target.value as any,
                    })
                  }
                  className="w-full border border-gray-300 rounded px-3 py-2"
                >
                  <option value="fixed">Fixed</option>
                  <option value="per_hour">Per Hour</option>
                  <option value="per_person">Per Person</option>
                  <option value="quote">Quote</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Base Price (THB)
                </label>
                <input
                  type="number"
                  value={formData.basePriceThb}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      basePriceThb: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Create Service
            </button>
          </div>
        </form>
      )}

      {services.length === 0 ? (
        <div className="text-gray-500 py-8">
          No services yet. Create one to get started!
        </div>
      ) : (
        <div className="space-y-4">
          {services.map((service) => (
            <div
              key={service.id}
              className="border border-gray-200 rounded-lg p-6 bg-white"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">{service.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {service.description}
                  </p>
                  <div className="mt-3 space-y-1 text-sm">
                    <p>
                      <span className="font-medium">Category:</span>{' '}
                      {service.categoryKey}
                    </p>
                    <p>
                      <span className="font-medium">Price Model:</span>{' '}
                      {service.priceModel}
                    </p>
                    {service.basePriceThb ? (
                      <p>
                        <span className="font-medium">Base Price:</span> ฿
                        {service.basePriceThb}
                      </p>
                    ) : null}
                    <p>
                      <span className="font-medium">Status:</span>{' '}
                      <span
                        className={
                          service.status === 'active'
                            ? 'text-green-600'
                            : service.status === 'draft'
                            ? 'text-yellow-600'
                            : 'text-gray-600'
                        }
                      >
                        {service.status}
                        {service.status === 'draft' && ' (Pending approval)'}
                      </span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(service.id)}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
