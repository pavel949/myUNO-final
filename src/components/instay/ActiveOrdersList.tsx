'use client';

import React, { useState } from 'react';
import { Button, Chip } from '@/components';
import { ServiceOrderRatingModal } from './ServiceOrderRatingModal';

interface ActiveOrder {
  id: string;
  serviceId: string;
  serviceName: string;
  status: string;
  totalThb: number;
  scheduledStart: string;
  scheduledEnd: string;
  hasRating?: boolean;
  rating?: number;
}

interface ActiveOrdersListProps {
  orders: ActiveOrder[];
  labels?: Record<string, string>;
}

// order.totalThb (below) is satang (THB × 100) straight from the DB via
// getInStayHomeSpace — this formatter converts to baht right at final render
// (money rule, CLAUDE.md "Money rules"). It is local to this component, so
// the conversion lives inside it rather than at each call site.
const formatCurrency = (satang: number): string => {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(satang / 100);
};

const formatDateTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Real ServiceOrderStatus values only (placed/paid/accepted/declined/expired/
// fulfilled/cancelled/failed/closed) — an earlier version styled a
// nonexistent 'in_progress' status that could never render.
const orderChipStatus = (
  status: string
): 'confirmed' | 'requested' | 'declined' | 'closed' | 'default' => {
  switch (status) {
    case 'accepted':
    case 'paid':
    case 'fulfilled':
      return 'confirmed';
    case 'placed':
      return 'requested';
    case 'declined':
    case 'cancelled':
    case 'failed':
      return 'declined';
    case 'closed':
    case 'expired':
      return 'closed';
    default:
      return 'default';
  }
};

const renderStars = (rating: number): string => {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
};

export const ActiveOrdersList = React.forwardRef<HTMLDivElement, ActiveOrdersListProps>(
  ({ orders, labels = {} }, ref) => {
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

    if (!orders || orders.length === 0) {
      return (
        <div ref={ref} className="text-center py-32 bg-surface-paper-soft rounded-md">
          <p className="text-body text-text-secondary">No active orders</p>
        </div>
      );
    }

    return (
      <div ref={ref} className="space-y-12">
        {orders.map((order) => (
          <div key={order.id} className="bg-surface-paper border border-border-line rounded-md p-16">
            <div className="flex justify-between items-start gap-16">
              <div className="flex-1">
                <p className="text-body font-semibold text-text-ink m-0 mb-4">{order.serviceName}</p>
                <p className="text-small text-text-stone m-0">
                  {formatDateTime(order.scheduledStart)} · {formatCurrency(order.totalThb)}
                </p>
              </div>
              <Chip variant="status" status={orderChipStatus(order.status)}>
                {labels[`common.status.service_order.${order.status}`] ?? order.status.replace('_', ' ')}
              </Chip>
            </div>

            {/* Rating section for fulfilled orders */}
            {order.status === 'fulfilled' && (
              <div className="flex items-center justify-between pt-12 mt-12 border-t border-border-line">
                {order.hasRating ? (
                  <div className="flex items-center gap-8">
                    <span className="text-small text-text-secondary">
                      {labels['home.order.you_rated'] ?? 'You rated:'}
                    </span>
                    <span className="text-body font-medium text-brand-sun">{renderStars(order.rating || 0)}</span>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setSelectedOrderId(order.id)}
                  >
                    {labels['home.order.rate_button'] ?? 'Rate this service'}
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Rating modal */}
        {selectedOrderId && (
          <ServiceOrderRatingModal
            orderId={selectedOrderId}
            labels={labels}
            onClose={() => setSelectedOrderId(null)}
            onSuccess={() => {
              setSelectedOrderId(null);
              // Trigger a page refresh to update the order rating
              window.location.reload();
            }}
          />
        )}
      </div>
    );
  }
);

ActiveOrdersList.displayName = 'ActiveOrdersList';
