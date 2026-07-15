'use client';

import React, { useState } from 'react';
import { Button } from '@/components';

interface OwnerStayModalProps {
  isOpen: boolean;
  unitId: string | null;
  noticeHours?: number;
  onClose: () => void;
  onSubmit: (unitId: string, startDate: Date, endDate: Date) => Promise<void>;
  isLoading?: boolean;
}

const getMinDate = (noticeHours: number = 24): string => {
  const minDate = new Date();
  minDate.setHours(minDate.getHours() + noticeHours);
  return minDate.toISOString().split('T')[0];
};

const isValidDateRange = (startStr: string, endStr: string, noticeHours: number): boolean => {
  if (!startStr || !endStr) return false;
  const start = new Date(startStr);
  const end = new Date(endStr);
  const minDate = new Date();
  minDate.setHours(minDate.getHours() + noticeHours);
  return start >= minDate && end > start;
};

export const OwnerStayModal = React.forwardRef<HTMLDivElement, OwnerStayModalProps>(
  ({ isOpen, unitId, noticeHours = 24, onClose, onSubmit, isLoading = false }, ref) => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');

      if (!isValidDateRange(startDate, endDate, noticeHours)) {
        setError(`Please ensure start date is at least ${noticeHours} hours from now and end date is after start date.`);
        return;
      }

      if (!unitId) {
        setError('Unit not selected');
        return;
      }

      try {
        await onSubmit(unitId, new Date(startDate), new Date(endDate));
        setStartDate('');
        setEndDate('');
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to book owner stay');
      }
    };

    if (!isOpen) return null;

    const minDate = getMinDate(noticeHours);

    return (
      <div
        ref={ref}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="bg-surface-ivory rounded-lg shadow-lg max-w-md w-full mx-4 p-32">
          <h2 className="text-heading-2 font-semibold text-text-ink mb-24">Book Your Stay</h2>

          <form onSubmit={handleSubmit} className="space-y-20">
            <div>
              <label className="block text-body font-medium text-text-ink mb-8">Start Date</label>
              <input
                type="date"
                min={minDate}
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (endDate && new Date(e.target.value) >= new Date(endDate)) {
                    setEndDate('');
                  }
                }}
                className="w-full px-16 py-12 border border-border-line rounded-md text-body focus:outline-none focus:ring-2 focus:ring-brand-andaman"
              />
              <p className="text-small text-text-secondary mt-8">
                Minimum {noticeHours} hours notice required
              </p>
            </div>

            <div>
              <label className="block text-body font-medium text-text-ink mb-8">End Date</label>
              <input
                type="date"
                min={startDate || minDate}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-16 py-12 border border-border-line rounded-md text-body focus:outline-none focus:ring-2 focus:ring-brand-andaman"
              />
            </div>

            {error && (
              <div className="bg-state-error-soft border border-state-error rounded-md p-16">
                <p className="text-small text-state-error">{error}</p>
              </div>
            )}

            <div className="flex gap-16 pt-16">
              <Button
                variant="secondary"
                fullWidth
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                fullWidth
                type="submit"
                isLoading={isLoading}
              >
                Book Stay
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }
);

OwnerStayModal.displayName = 'OwnerStayModal';
