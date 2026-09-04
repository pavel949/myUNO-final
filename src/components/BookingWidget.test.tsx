// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { BookingWidget, type BookingWidgetLabels } from './BookingWidget';

const labels: BookingWidgetLabels = {
  perNight: '/ night',
  pickDates: 'Choose dates to see the price.',
  total: 'Total',
  bookingType: 'Booking type',
  paymentMethod: 'Payment method',
  guestNote: 'Guest note',
  guestNotePlaceholder: 'Any requests…',
  reserve: 'Reserve',
  reserving: 'Booking…',
};

const baseProps = {
  nightlySatang: 939300, // ฿9,393
  bookingTypeValue: 'Instant book',
  paymentMethods: [
    { value: 'cash', label: 'Cash on arrival' },
    { value: 'card_provider', label: 'Card (online)' },
  ],
  paymentMethod: 'cash',
  onPaymentMethodChange: () => {},
  guestNote: '',
  onGuestNoteChange: () => {},
  onReserve: () => {},
  reserving: false,
  labels,
};

describe('BookingWidget', () => {
  it('shows the nightly price in baht and prompts for dates before a quote', () => {
    render(<BookingWidget {...baseProps} priceLines={null} totalSatang={null} canReserve={false} />);
    expect(screen.getByText(/9,393/)).toBeInTheDocument();
    expect(screen.getByText('Choose dates to see the price.')).toBeInTheDocument();
    // Reserve is disabled until there is a quote.
    expect(screen.getByRole('button', { name: 'Reserve' })).toBeDisabled();
  });

  it('renders the breakdown and total when a quote is present', () => {
    render(
      <BookingWidget
        {...baseProps}
        priceLines={[{ label: '× 2 nights', satang: 1878600 }]}
        totalSatang={2028600} // ฿20,286
        canReserve
      />
    );
    expect(screen.getByText('× 2 nights')).toBeInTheDocument();
    expect(screen.getByText(/20,286/)).toBeInTheDocument();
    expect(screen.queryByText('Choose dates to see the price.')).not.toBeInTheDocument();
  });

  it('exposes the configured payment methods and fires reserve', () => {
    const onReserve = vi.fn();
    render(
      <BookingWidget
        {...baseProps}
        priceLines={[{ label: '× 2 nights', satang: 1878600 }]}
        totalSatang={1878600}
        canReserve
        onReserve={onReserve}
      />
    );
    expect(screen.getByRole('option', { name: 'Cash on arrival' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Card (online)' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reserve' }));
    expect(onReserve).toHaveBeenCalledOnce();
  });

  it('shows the read-only booking type', () => {
    render(<BookingWidget {...baseProps} priceLines={null} totalSatang={null} canReserve={false} />);
    expect(screen.getByText('Booking type')).toBeInTheDocument();
    expect(screen.getByText('Instant book')).toBeInTheDocument();
  });
});
