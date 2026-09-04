'use client';

import React from 'react';
import { Button } from './Button';
import { MoneyAmount } from './MoneyAmount';
import { PriceBreakdown, type PriceLine } from './PriceBreakdown';

export interface BookingWidgetPaymentMethod {
  value: string;
  /** Pre-resolved label. */
  label: string;
}

export interface BookingWidgetLabels {
  perNight: string;
  pickDates: string;
  total: string;
  bookingType: string;
  paymentMethod: string;
  guestNote: string;
  guestNotePlaceholder: string;
  reserve: string;
  reserving: string;
}

export interface BookingWidgetProps {
  /** Nightly headline price in satang. */
  nightlySatang: number;
  /** Assembled price lines in satang; null until dates produce a quote. */
  priceLines: PriceLine[] | null;
  totalSatang: number | null;
  /** Read-only resolved booking-type value (instant vs request). */
  bookingTypeValue: string;
  paymentMethods: BookingWidgetPaymentMethod[];
  paymentMethod: string;
  onPaymentMethodChange: (value: string) => void;
  guestNote: string;
  onGuestNoteChange: (value: string) => void;
  /** Pre-resolved error line, if any. */
  error?: string | null;
  onReserve: () => void;
  reserving: boolean;
  /** Disable reserve until a quote exists. */
  canReserve: boolean;
  labels: BookingWidgetLabels;
}

/**
 * BookingWidget — doc 06 §3 / S4. The sticky stay booking sidebar: headline
 * price, itemised breakdown (via PriceBreakdown), the unit's read-only booking
 * type, payment method, an optional note, and the reserve CTA. Presentational —
 * the page owns quoting and submission; every figure is satang via MoneyAmount.
 */
export const BookingWidget: React.FC<BookingWidgetProps> = ({
  nightlySatang,
  priceLines,
  totalSatang,
  bookingTypeValue,
  paymentMethods,
  paymentMethod,
  onPaymentMethodChange,
  guestNote,
  onGuestNoteChange,
  error,
  onReserve,
  reserving,
  canReserve,
  labels,
}) => {
  return (
    <div className="sticky top-96 rounded-lg border border-border-line bg-surface-paper p-24">
      <p className="mb-24 text-heading-2 font-bold text-text-ink">
        <MoneyAmount satang={nightlySatang} />{' '}
        <span className="text-body font-normal text-text-secondary">{labels.perNight}</span>
      </p>

      {priceLines && totalSatang !== null ? (
        <div className="mb-24 border-b border-border-line pb-24">
          <PriceBreakdown lines={priceLines} totalLabel={labels.total} totalSatang={totalSatang} />
        </div>
      ) : (
        <p className="mb-24 text-body text-text-secondary">{labels.pickDates}</p>
      )}

      {/* Booking type is a property of the unit, not a guest choice — shown
          read-only so a guest can't route themselves into request-to-book on an
          instant-book unit. */}
      <div className="mb-24">
        <span className="mb-8 block text-small font-semibold text-text-ink">
          {labels.bookingType}
        </span>
        <p className="text-body text-text-secondary">{bookingTypeValue}</p>
      </div>

      <div className="mb-24">
        <label htmlFor="payment-method" className="mb-8 block text-small font-semibold text-text-ink">
          {labels.paymentMethod}
        </label>
        <select
          id="payment-method"
          value={paymentMethod}
          onChange={(e) => onPaymentMethodChange(e.target.value)}
          className="h-48 w-full rounded-sm border border-border-line bg-surface-paper px-12 text-body text-text-ink focus-visible:outline-none focus-visible:border-brand-andaman focus-visible:ring-2 focus-visible:ring-brand-andaman"
        >
          {paymentMethods.map((method) => (
            <option key={method.value} value={method.value}>
              {method.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-24">
        <label htmlFor="guest-note" className="mb-8 block text-small font-semibold text-text-ink">
          {labels.guestNote}
        </label>
        <textarea
          id="guest-note"
          value={guestNote}
          onChange={(e) => onGuestNoteChange(e.target.value)}
          rows={3}
          placeholder={labels.guestNotePlaceholder}
          className="w-full rounded-sm border border-border-line bg-surface-paper px-12 py-12 text-body text-text-ink focus-visible:outline-none focus-visible:border-brand-andaman focus-visible:ring-2 focus-visible:ring-brand-andaman"
        />
      </div>

      {error && (
        <div className="mb-16 rounded-lg border border-state-error bg-state-error-soft p-12">
          <p className="text-small text-state-error">{error}</p>
        </div>
      )}

      <Button onClick={onReserve} disabled={reserving || !canReserve} isLoading={reserving} fullWidth>
        {labels.reserve}
      </Button>
    </div>
  );
};

BookingWidget.displayName = 'BookingWidget';
