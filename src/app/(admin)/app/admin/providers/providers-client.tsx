'use client';

import { useEffect, useState } from 'react';

interface Provider {
  id: string;
  name: string;
  contactEmail: string;
  contactPhone: string;
  categoryKeys: string[];
  status: string;
  createdAt: string;
  vetted_at?: string;
  vetted_by?: {
    firstName: string;
    lastName: string;
  };
}

export function ProvidersClient() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const response = await fetch('/api/admin/providers?status=applied');
        const data = await response.json();
        setProviders(data);
      } catch (error) {
        console.error('Failed to fetch providers:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProviders();
  }, []);

  const handleApprove = async (providerId: string) => {
    try {
      const response = await fetch(`/api/admin/providers/${providerId}/approve`, {
        method: 'POST',
      });

      if (response.ok) {
        setProviders((prev) =>
          prev.filter((p) => p.id !== providerId)
        );
        alert('Provider approved');
      }
    } catch (error) {
      console.error('Approval error:', error);
      alert('Failed to approve provider');
    }
  };

  const handleReject = async (providerId: string) => {
    if (!rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }

    try {
      const response = await fetch(`/api/admin/providers/${providerId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectionReason }),
      });

      if (response.ok) {
        setProviders((prev) =>
          prev.filter((p) => p.id !== providerId)
        );
        setSelectedId(null);
        setRejectionReason('');
        alert('Provider rejected');
      }
    } catch (error) {
      console.error('Rejection error:', error);
      alert('Failed to reject provider');
    }
  };

  if (loading) {
    return <div className="text-center py-32">Loading...</div>;
  }

  if (providers.length === 0) {
    return (
      <div className="text-center py-32 text-text-secondary">
        No applications pending review
      </div>
    );
  }

  return (
    <div className="space-y-24">
      {providers.map((provider) => (
        <div
          key={provider.id}
          className="bg-white rounded-sm border border-border-line p-24"
        >
          <div className="flex justify-between items-start mb-16">
            <div className="flex-1">
              <h3 className="text-body font-bold text-text-ink mb-8">
                {provider.name}
              </h3>
              <p className="text-small text-text-secondary mb-12">
                Applied: {new Date(provider.createdAt).toLocaleDateString()}
              </p>
              <div className="space-y-8">
                <p className="text-small">
                  <span className="text-text-secondary">Email:</span>{' '}
                  <span className="text-text-ink">{provider.contactEmail}</span>
                </p>
                <p className="text-small">
                  <span className="text-text-secondary">Phone:</span>{' '}
                  <span className="text-text-ink">{provider.contactPhone}</span>
                </p>
                <p className="text-small">
                  <span className="text-text-secondary">Categories:</span>{' '}
                  <span className="text-text-ink">
                    {provider.categoryKeys.join(', ')}
                  </span>
                </p>
              </div>
            </div>

            <div className="ml-24 flex gap-8">
              <button
                onClick={() => handleApprove(provider.id)}
                className="px-16 py-12 bg-state-success text-white rounded-sm hover:opacity-90 text-small font-medium"
              >
                Approve
              </button>
              <button
                onClick={() => setSelectedId(provider.id)}
                className="px-16 py-12 bg-state-error text-white rounded-sm hover:opacity-90 text-small font-medium"
              >
                Reject
              </button>
            </div>
          </div>

          {selectedId === provider.id && (
            <div className="mt-16 p-16 bg-surface-paper rounded-sm">
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Rejection reason..."
                className="w-full h-96 px-12 py-12 rounded-sm border border-border-line text-text-ink focus:border-brand-andaman focus:ring-2 focus:ring-brand-andaman resize-none"
              />
              <div className="flex gap-12 mt-12">
                <button
                  onClick={() => handleReject(provider.id)}
                  className="px-16 py-12 bg-state-error text-white rounded-sm hover:opacity-90 text-small font-medium"
                >
                  Confirm Rejection
                </button>
                <button
                  onClick={() => {
                    setSelectedId(null);
                    setRejectionReason('');
                  }}
                  className="px-16 py-12 bg-border-line text-text-ink rounded-sm hover:opacity-90 text-small font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
