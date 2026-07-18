'use client';

import { useEffect, useState } from 'react';

interface Service {
  id: string;
  title: string;
  description?: string;
  categoryKey: string;
  priceModel: string;
  basePriceThb?: number;
  provider: {
    id: string;
    name: string;
    status: string;
  };
  createdAt: string;
  availableProjectIds: string[];
}

export default function ServicesClient() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/services');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setServices(data || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch services:', err);
      setError('Failed to load pending services');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (serviceId: string) => {
    try {
      setActionInProgress(serviceId);
      const response = await fetch(`/api/admin/services/${serviceId}/approve`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to approve');
      setServices(services.filter((s) => s.id !== serviceId));
    } catch (err) {
      console.error('Failed to approve service:', err);
      alert('Failed to approve service');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleReject = async (serviceId: string) => {
    const reason = prompt('Rejection reason (optional):');
    if (reason === null) return;

    try {
      setActionInProgress(serviceId);
      const response = await fetch(`/api/admin/services/${serviceId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) throw new Error('Failed to reject');
      setServices(services.filter((s) => s.id !== serviceId));
    } catch (err) {
      console.error('Failed to reject service:', err);
      alert('Failed to reject service');
    } finally {
      setActionInProgress(null);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading pending services...</div>;
  }

  if (error) {
    return <div className="text-red-600 py-8">{error}</div>;
  }

  if (services.length === 0) {
    return <div className="text-gray-500 py-8">No services pending approval</div>;
  }

  return (
    <div className="space-y-4">
      {services.map((service) => (
        <div
          key={service.id}
          className="border border-gray-200 rounded-lg p-6 bg-white"
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-lg font-semibold">{service.title}</h2>
              <p className="text-sm text-gray-600 mt-1">{service.description}</p>
              <div className="mt-3 space-y-1 text-sm">
                <p>
                  <span className="font-medium">Provider:</span> {service.provider.name}
                </p>
                <p>
                  <span className="font-medium">Category:</span> {service.categoryKey}
                </p>
                <p>
                  <span className="font-medium">Price Model:</span> {service.priceModel}
                </p>
                {service.basePriceThb && (
                  <p>
                    <span className="font-medium">Base Price:</span> ฿{service.basePriceThb}
                  </p>
                )}
                <p>
                  <span className="font-medium">Submitted:</span>{' '}
                  {new Date(service.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleApprove(service.id)}
                disabled={actionInProgress === service.id}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                onClick={() => handleReject(service.id)}
                disabled={actionInProgress === service.id}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
