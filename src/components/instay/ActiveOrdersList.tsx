'use client';

import React from 'react';

interface ActiveOrder {
  id: string;
  serviceId: string;
  serviceName: string;
  status: string;
  totalThb: number;
  scheduledStart: string;
  scheduledEnd: string;
}

interface ActiveOrdersListProps {
  orders: ActiveOrder[];
}

const formatCurrency = (thb: number): string => {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(thb);
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

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'placed':
      return 'bg-yellow-100 text-yellow-700';
    case 'accepted':
      return 'bg-blue-100 text-blue-700';
    case 'in_progress':
      return 'bg-green-100 text-green-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

export const ActiveOrdersList = React.forwardRef<HTMLDivElement, ActiveOrdersListProps>(
  ({ orders }, ref) => {
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
          <div key={order.id} className="border border-border-line rounded-md p-20 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start gap-16 mb-12">
              <div className="flex-1">
                <p className="text-body font-medium text-text-ink">{order.serviceName}</p>
              </div>
              <span className={`inline-flex items-center px-12 py-6 rounded-full text-small font-medium ${getStatusColor(order.status)}`}>
                {order.status.replace('_', ' ')}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-16 text-small text-text-secondary">
              <div>
                <span className="font-medium">Scheduled:</span>
                <p>{formatDateTime(order.scheduledStart)}</p>
              </div>
              <div className="text-right">
                <span className="font-medium">Cost:</span>
                <p>{formatCurrency(order.totalThb)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }
);

ActiveOrdersList.displayName = 'ActiveOrdersList';
