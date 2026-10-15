import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import UnitDetailClient, { type UnitDetailLabels } from './unit-client';

const mocks = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), available: true as boolean | undefined,
  unquotable: false, bathrooms: undefined as number | null | undefined, params: new URLSearchParams() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  usePathname: () => '/units/request-unit',
  useSearchParams: () => mocks.params,
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
  vi.clearAllMocks(); mocks.available = true; mocks.unquotable = false; mocks.bathrooms = undefined;
  mocks.params = new URLSearchParams('startDate=2027-01-10&endDate=2027-01-13&adults=2');
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    if (input.startsWith('/api/units/')) {
      const id = input.split('/').at(-1)!;
      return { ok: true, json: async () => ({ id, name: id, projectId: 'project', baseNightlyThb: 123400,
        instantBook: id === 'instant-unit', maxGuests: 4, bedrooms: 2, minNights: 1, bathrooms: mocks.bathrooms, inventoryCategory: { id: 'category-a', categoryKey: 'two-bedroom', name: 'Two-bedroom' } }) };
    }
    if (mocks.unquotable) return { ok: false, json: async () => ({ code: 'stay_unquotable' }) };
    return { ok: true, json: async () => ({ isAvailable: mocks.available, nights: 3, nightlyRate: 1234,
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
    mocks.unquotable = true;
    render(<UnitDetailClient unitId="request-unit" labels={labels} />);
    await screen.findByText('Dates unavailable');
    const buttons = screen.getAllByRole('button', { name: 'Request to book', exact: true });
    expect(buttons).toHaveLength(1); // No quoted total means no sticky action.
    for (const button of buttons) expect(button).toBeDisabled();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it.each([
    ['request-unit', false], ['instant-unit', false], ['request-unit', undefined], ['instant-unit', undefined],
  ] as const)('does not offer %s when quote availability is %s', async (unitId, available) => {
    mocks.available = available;
    render(<UnitDetailClient unitId={unitId} labels={labels} />);
    await screen.findByText('Dates unavailable');
    const name = unitId === 'instant-unit' ? 'Reserve' : 'Request to book';
    expect(screen.getByRole('button', { name, exact: true })).toBeDisabled();
    expect(screen.queryByText('Total')).not.toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('clears the old quote when new dates are blocked and recovers on valid dates', async () => {
    const view = render(<UnitDetailClient unitId="instant-unit" labels={labels} />);
    await readyActions('Reserve'); expect(screen.getByText('Total')).toBeInTheDocument();
    mocks.available = false; mocks.params.set('endDate', '2027-01-14');
    view.rerender(<UnitDetailClient unitId="instant-unit" labels={labels} />);
    await screen.findByText('Dates unavailable');
    expect(screen.queryByText('Total')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reserve', exact: true })).toBeDisabled();
    mocks.available = true; mocks.params.set('endDate', '2027-01-15');
    view.rerender(<UnitDetailClient unitId="instant-unit" labels={labels} />);
    await readyActions('Reserve');
    expect(screen.queryByText('Dates unavailable')).not.toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});


describe('unit facts and return context', () => {
  it.each([undefined, null, 0, -1, Number.NaN])('omits unknown bathroom count %s', async (bathrooms) => {
    mocks.bathrooms = bathrooms;
    render(<UnitDetailClient unitId="request-unit" labels={labels} />);
    await readyActions('Request to book');
    expect(screen.queryByText(/bathrooms/)).not.toBeInTheDocument();
  });

  it('shows a known bathroom count', async () => {
    mocks.bathrooms = 2;
    render(<UnitDetailClient unitId="request-unit" labels={labels} />);
    await readyActions('Request to book');
    expect(screen.getByText('2 bathrooms')).toBeInTheDocument();
  });

  it('carries only supported search filters into review with the canonical project', async () => {
    mocks.params.set('projectId', 'unrelated-project');
    mocks.params.set('areaSlug', 'layan');
    mocks.params.set('inventoryCategoryId', 'unrelated-category');
    mocks.params.set('bedrooms', '2');
    mocks.params.set('sort', 'price_asc');
    mocks.params.set('bookingIntent', 'old-attempt');
    mocks.params.set('next', 'https://example.invalid');
    render(<UnitDetailClient unitId="request-unit" labels={labels} />);
    fireEvent.click((await readyActions('Request to book'))[0]);
    const query = new URL(mocks.push.mock.calls.at(-1)![0], 'http://localhost').searchParams;
    expect(query.get('projectId')).toBe('project');
    expect(query.get('areaSlug')).toBe('layan');
    expect(query.get('bedrooms')).toBe('2');
    expect(query.get('sort')).toBe('price_asc');
    expect(query.has('inventoryCategoryId')).toBe(false);
    expect(query.has('bookingIntent')).toBe(false);
    expect(query.has('next')).toBe(false);
  });
});

it('preserves a search category that matches the loaded unit', async () => {
  mocks.params.set('inventoryCategoryId', 'category-a');
  render(<UnitDetailClient unitId="request-unit" labels={labels} />);
  fireEvent.click((await readyActions('Request to book'))[0]);
  const query = new URL(mocks.push.mock.calls.at(-1)![0], 'http://localhost').searchParams;
  expect(query.get('inventoryCategoryId')).toBe('category-a');
});
