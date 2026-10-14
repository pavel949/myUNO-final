import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import UnitDetailClient, { type UnitDetailLabels } from './unit-client';

const mocks = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), available: true }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  usePathname: () => '/units/request-unit',
  useSearchParams: () => new URLSearchParams('startDate=2027-01-10&endDate=2027-01-13&adults=2'),
}));
vi.mock('@/components/LocaleProvider', () => ({ useLocale: () => 'en' }));
vi.mock('@/components/UnitPhotoMosaic', () => ({ UnitPhotoMosaic: () => null }));
vi.mock('@/components/StayDatePicker', () => ({ StayDatePicker: () => null }));
vi.mock('@/components/LeadForm', () => ({ LeadForm: () => null }));

const labels = {
  loading: 'Loading', notFound: 'Not found', backToResults: 'Back', onMyUno: 'on myUNO',
  showAllPhotos: 'All {count} photos', photosPending: 'Photos pending', representativeMedia: 'Representative photos',
  guestsCount: '{count} guests', bedroomsCount: '{count} bedrooms', minNightsCount: 'From {count} nights',
  sizeUnit: 'sqm', floor: 'Floor {value}', notChargedYet: 'No charge yet', fewerGuests: 'Fewer guests', moreGuests: 'More guests',
  checkIn: 'Check-in', checkOut: 'Check-out', maxGuests: 'Maximum guests', minStay: 'Minimum stay', nights: 'nights', night: 'night',
  bedrooms: 'bedrooms', bathrooms: 'bathrooms', cancellationPolicy: 'Cancellation policy', perNight: '/ night',
  averageForDates: 'Average for selected dates', baseRateNote: 'Base rate', priceNights: '{nights} nights',
  discountLongStay: 'Long-stay discount', discountEarlyBird: 'Early-bird discount', cleaningFee: 'Cleaning',
  occupancyTax: 'Tax', total: 'Total', bookingType: 'Booking type', instantBook: 'Instant booking', requestToBook: 'Request to book',
  guestNote: 'Note', guestNotePlaceholder: 'Note', paymentMethod: 'Payment method', payCash: 'Cash', payCard: 'Card',
  reserve: 'Reserve', reserving: 'Reserving', pickDates: 'Pick dates', errorPrice: 'Price unavailable', errorBooking: 'Booking failed',
  unavailableForDates: 'Dates unavailable', leaseRequiredTitle: 'Lease required', leaseRequiredBody: 'Contact us', leaseRequestMessage: '{unit}',
  conflictTitle: 'Conflict', conflictBody: 'Try other dates', searchAgain: 'Search again', amenitiesTitle: 'Amenities',
  amenityLabels: {}, policyLabels: {},
} as UnitDetailLabels;

beforeEach(() => {
  vi.clearAllMocks(); mocks.available = true;
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    if (input.startsWith('/api/units/')) {
      const id = input.split('/').at(-1)!;
      return { ok: true, json: async () => ({ id, name: id, projectId: 'project', baseNightlyThb: 123400,
        instantBook: id === 'instant-unit', maxGuests: 4, bedrooms: 2, minNights: 1 }) };
    }
    if (!mocks.available) return { ok: false, json: async () => ({ code: 'stay_unquotable' }) };
    return { ok: true, json: async () => ({ isAvailable: true, nights: 3, nightlyRate: 1234,
      subtotal: 3702, total: 3702, lengthOfStayDiscount: 0, earlyBirdDiscount: 0, cleaningFee: 0, occupancyTax: 0 }) };
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function readyActions(name: string) {
  await waitFor(() => {
    const buttons = screen.getAllByRole('button', { name, exact: true });
    expect(buttons).toHaveLength(2);
    for (const button of buttons) expect(button).toBeEnabled();
  });
  return screen.getAllByRole('button', { name, exact: true });
}

describe('unit primary booking actions follow the fetched canonical mode', () => {
  it.each([
    ['request-unit', 'Request to book', '0'], ['instant-unit', 'Reserve', '1'],
  ])('uses the correct label and review intent for %s in both desktop and sticky placements', async (unitId, name, mode) => {
    render(<UnitDetailClient unitId={unitId} labels={labels} />);
    for (const button of await readyActions(name)) {
      expect(button).toBeEnabled(); fireEvent.click(button);
      const url = new URL(mocks.push.mock.calls.at(-1)![0], 'http://localhost');
      expect(url.pathname).toBe('/book/review');
      expect(url.searchParams.get('instantBook')).toBe(mode);
      expect(url.searchParams.get('unitId')).toBe(unitId);
    }
    expect(screen.queryByRole('button', { name: mode === '0' ? 'Reserve' : 'Request to book', exact: true })).not.toBeInTheDocument();
  });

  it('does not retain request wording when the next loaded unit permits instant booking', async () => {
    const view = render(<UnitDetailClient unitId="request-unit" labels={labels} />);
    await readyActions('Request to book');
    view.rerender(<UnitDetailClient unitId="instant-unit" labels={labels} />);
    await readyActions('Reserve');
    expect(screen.queryByRole('button', { name: 'Request to book', exact: true })).not.toBeInTheDocument();
  });

  it('does not enable a request without an available quote', async () => {
    mocks.available = false;
    render(<UnitDetailClient unitId="request-unit" labels={labels} />);
    await screen.findByText('Dates unavailable');
    const buttons = screen.getAllByRole('button', { name: 'Request to book', exact: true });
    expect(buttons).toHaveLength(1); // No quoted total means no sticky action.
    for (const button of buttons) expect(button).toBeDisabled();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
