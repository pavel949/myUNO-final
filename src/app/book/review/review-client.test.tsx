import userEvent from '@testing-library/user-event';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BookingReviewClient, { type ReviewLabels } from './review-client';

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), params: new URLSearchParams() }));
vi.mock('next/navigation', () => ({
  useRouter: () => navigation,
  useSearchParams: () => navigation.params,
}));

const labels = Object.fromEntries([
  'requestTitle', 'requestConfirm', 'requestConsent', 'requestNote', 'title', 'recap', 'checkIn', 'checkOut', 'guests', 'policy', 'policyConsent',
  'verificationNote', 'paymentMethod', 'payCash', 'payCard', 'payTransfer', 'confirm',
  'confirming', 'back', 'error', 'requote', 'unavailableForDates', 'conflictTitle', 'conflictBody', 'searchAgain',
  'categoryNote', 'total', 'nights', 'discountLongStay', 'discountEarlyBird', 'cleaningFee', 'occupancyTax',
].map(key => [key, key])) as unknown as ReviewLabels;
const fetchMock = vi.fn();
const quote = (total = 3000) => ({
  isAvailable: true, nights: 3, subtotal: total, total, acceptedTotalSatang: Math.round(total * 100),
  lengthOfStayDiscount: 0, earlyBirdDiscount: 0, cleaningFee: 0, occupancyTax: 0,
});
const response = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data });
const renderReview = () => render(
  <BookingReviewClient labels={labels} methods={['cash']} defaultPolicy="Policy" projectId="project-a" />
);
const bookingCalls = () => fetchMock.mock.calls.filter(([url]) => url === '/api/bookings');

async function consent() {
  await waitFor(() => expect(screen.getByText('total')).toBeInTheDocument());
  fireEvent.click(screen.getByRole('checkbox'));
  await waitFor(() => expect(screen.getByRole('button', { name: 'confirm' })).toBeEnabled());
}

describe('reviewed price and recovery', () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
  beforeEach(() => {
    vi.clearAllMocks();
    navigation.params = new URLSearchParams('unitId=unit-a&startDate=2027-02-01&endDate=2027-02-04&adults=2&children=0');
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockImplementation(async (url: string) => {
      if (url.startsWith('/api/units/')) return response({ name: 'Villa A', instantBook: true });
      if (url === '/api/pricing/breakdown') return response(quote());
      if (url === '/api/pricing/category-quote') return response({
        categoryName: 'Villas', instantBook: true, breakdown: quote(), quoteToken: 'signed-quote', acceptedTotalSatang: 300_000,
      });
      return response({ booking: { id: 'booking-a' } }, 201);
    });
  });

  it('submits exactly the direct-unit total the guest reviewed in satang', async () => {
    renderReview();
    await consent();
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }));
    await waitFor(() => expect(bookingCalls()).toHaveLength(1));
    expect(JSON.parse(bookingCalls()[0][1].body)).toMatchObject({ unitId: 'unit-a', acceptedTotalSatang: 300_000 });
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/trips'));
  });

  it('retains the category signed quote and accepted ceiling', async () => {
    navigation.params.delete('unitId');
    navigation.params.set('inventoryCategoryId', 'category-a');
    renderReview();
    await consent();
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }));
    await waitFor(() => expect(bookingCalls()).toHaveLength(1));
    expect(JSON.parse(bookingCalls()[0][1].body)).toMatchObject({
      inventoryCategoryId: 'category-a', categoryQuoteToken: 'signed-quote', acceptedTotalSatang: 300_000,
    });
  });

  it('refreshes a changed direct-unit price and requires fresh consent', async () => {
    let prices = 0;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.startsWith('/api/units/')) return response({ name: 'Villa A', instantBook: true });
      if (url === '/api/pricing/breakdown') return response(quote(++prices === 1 ? 3000 : 3500));
      return response({ code: 'REQUOTE_REQUIRED' }, 409);
    });
    renderReview();
    await consent();
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }));
    await waitFor(() => expect(prices).toBe(2));
    expect(screen.getByText('requote')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'confirm' })).toBeDisabled();
    expect(screen.queryByText('conflictTitle')).not.toBeInTheDocument();
    await consent();
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }));
    await waitFor(() => expect(bookingCalls()).toHaveLength(2));
    expect(JSON.parse(bookingCalls()[1][1].body).acceptedTotalSatang).toBe(350_000);
  });

  it('preserves the stay through authentication interruption', async () => {
    const normalFetch = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url: string, options: unknown) => url === '/api/bookings'
      ? response({}, 401) : normalFetch(url, options));
    renderReview();
    await consent();
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalled());
    const destination = new URL(navigation.push.mock.calls[0][0], 'http://localhost');
    expect(destination.pathname).toBe('/login');
    const next = new URL(destination.searchParams.get('next')!, 'http://localhost');
    expect(next.searchParams.get('bookingIntent')).toBe(JSON.parse(bookingCalls()[0][1].body).idempotencyKey);
    next.searchParams.delete('bookingIntent');
    expect(next.pathname + next.search).toBe(`/book/review?${navigation.params}`);
  });

  it('reuses the attempt after a network error and stores it in the review URL', async () => {
    const normalFetch = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url: string, options: unknown) => {
      if (url === '/api/bookings') throw new Error('Lost response');
      return normalFetch(url, options);
    });
    renderReview();
    await consent();
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }));
    await waitFor(() => expect(screen.getByText('Lost response')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }));
    await waitFor(() => expect(bookingCalls()).toHaveLength(2));
    const firstKey = JSON.parse(bookingCalls()[0][1].body).idempotencyKey;
    expect(JSON.parse(bookingCalls()[1][1].body).idempotencyKey).toBe(firstKey);
    const review = new URL(navigation.replace.mock.calls[0][0], 'http://localhost');
    expect(review.searchParams.get('bookingIntent')).toBe(firstKey);
  });

  it('recovers the committed booking after refresh even when its dates cannot be quoted again', async () => {
    const key = '00000000-0000-4000-8000-000000000001';
    navigation.params.set('bookingIntent', key);
    fetchMock.mockImplementation(async (url: string) => url.startsWith('/api/bookings?')
      ? response({ booking: { id: 'already-created' } }) : response({}, 409));
    renderReview();
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/trips/already-created'));
    expect(fetchMock).toHaveBeenCalledWith(`/api/bookings?idempotencyKey=${key}`, expect.anything());
    expect(bookingCalls()).toHaveLength(0);
  });

  it.each([
    { instantBook: true, isAvailable: false }, { instantBook: false, isAvailable: false },
    { instantBook: true, isAvailable: undefined }, { instantBook: false, isAvailable: undefined },
  ])('refuses direct review for mode=$instantBook availability=$isAvailable', async ({ instantBook, isAvailable }) => {
    fetchMock.mockImplementation(async (url: string) => url.startsWith('/api/units/')
      ? response({ name: 'Villa A', instantBook })
      : response({ ...quote(), isAvailable }));
    renderReview();
    expect(await screen.findByText('unavailableForDates')).toBeInTheDocument();
    expect(screen.queryByText('total')).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(screen.getByRole('button', { name: instantBook ? 'confirm' : 'requestConfirm' })).toBeDisabled();
    expect(bookingCalls()).toHaveLength(0);
  });

  it('clears prior price and consent when changed dates are unavailable, then requires new consent after recovery', async () => {
    let available = true;
    const normalFetch = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url: string, options: unknown) => url === '/api/pricing/breakdown'
      ? response({ ...quote(), isAvailable: available }) : normalFetch(url, options));
    const view = renderReview(); await consent();
    available = false; navigation.params.set('endDate', '2027-02-05');
    view.rerender(<BookingReviewClient labels={labels} methods={['cash']} defaultPolicy="Policy" projectId="project-a" />);
    expect(await screen.findByText('unavailableForDates')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(screen.queryByText('total')).not.toBeInTheDocument();
    available = true; navigation.params.set('endDate', '2027-02-06');
    view.rerender(<BookingReviewClient labels={labels} methods={['cash']} defaultPolicy="Policy" projectId="project-a" />);
    await waitFor(() => expect(screen.getByText('total')).toBeInTheDocument());
    expect(screen.queryByText('unavailableForDates')).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'confirm' })).toBeDisabled();
    expect(bookingCalls()).toHaveLength(0);
  });

  it('shows quote failure and keeps confirmation disabled', async () => {
    fetchMock.mockRejectedValue(new Error('network unavailable'));
    renderReview();
    expect(await screen.findByText('error')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: 'confirm' })).toBeDisabled();
    expect(bookingCalls()).toHaveLength(0);
  });

  it('ignores a stale quote after the selected dates change', async () => {
    let resolveOld!: (value: unknown) => void;
    let prices = 0;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.startsWith('/api/units/')) return response({ name: 'Villa A', instantBook: true });
      if (url === '/api/pricing/breakdown' && ++prices === 1) {
        return new Promise(resolve => { resolveOld = resolve; });
      }
      return response(quote(4000));
    });
    const view = renderReview();
    await waitFor(() => expect(prices).toBe(1));
    navigation.params.set('endDate', '2027-02-05');
    view.rerender(<BookingReviewClient labels={labels} methods={['cash']} defaultPolicy="Policy" projectId="project-a" />);
    await waitFor(() => expect(prices).toBe(2));
    await act(async () => resolveOld(response(quote(3000))));
    await consent();
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }));
    await waitFor(() => expect(bookingCalls()).toHaveLength(1));
    expect(JSON.parse(bookingCalls()[0][1].body)).toMatchObject({ endDate: '2027-02-05', acceptedTotalSatang: 400_000 });
  });

  it('shows request terms from the current unit even when the URL says instant', async () => {
    navigation.params.set('instantBook', '1');
    const normalFetch = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url: string, options: unknown) => url.startsWith('/api/units/')
      ? response({ name: 'Villa A', instantBook: false }) : normalFetch(url, options));
    renderReview();
    await waitFor(() => expect(screen.getByText('requestNote')).toBeInTheDocument());
    expect(screen.getByText('requestTitle')).toBeInTheDocument();
    expect(screen.getByText('requestConsent')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeEnabled());
    fireEvent.click(screen.getByRole('checkbox'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'requestConfirm' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'requestConfirm' }));
    await waitFor(() => expect(bookingCalls()).toHaveLength(1));
    expect(JSON.parse(bookingCalls()[0][1].body).instantBook).toBe(false);
  });

  it('uses the category quote mode instead of the URL', async () => {
    navigation.params.delete('unitId');
    navigation.params.set('inventoryCategoryId', 'category-a');
    navigation.params.set('instantBook', '1');
    const normalFetch = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url: string, options: unknown) => url === '/api/pricing/category-quote'
      ? response({ categoryName: 'Villas', instantBook: false, breakdown: quote(),
        quoteToken: 'signed-quote', acceptedTotalSatang: 300_000 }) : normalFetch(url, options));
    renderReview();
    await waitFor(() => expect(screen.getByText('requestNote')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeEnabled());
    fireEvent.click(screen.getByRole('checkbox'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'requestConfirm' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'requestConfirm' }));
    await waitFor(() => expect(bookingCalls()).toHaveLength(1));
    expect(JSON.parse(bookingCalls()[0][1].body).instantBook).toBe(false);
  });

  it('refreshes mode and requires new consent after a mode mismatch', async () => {
    let units = 0;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.startsWith('/api/units/')) return response({ name: 'Villa A', instantBook: ++units === 1 });
      if (url === '/api/pricing/breakdown') return response(quote());
      return response({ code: 'REQUOTE_REQUIRED' }, 409);
    });
    renderReview();
    await consent();
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }));
    await waitFor(() => expect(screen.getByText('requestNote')).toBeInTheDocument());
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'requestConfirm' })).toBeDisabled();
  });

  it('never submits without an authoritative booking mode', async () => {
    const normalFetch = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url: string, options: unknown) => url.startsWith('/api/units/')
      ? response({ name: 'Villa A' }) : normalFetch(url, options));
    renderReview();
    expect(await screen.findByText('error')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: 'confirm' })).toBeDisabled();
    expect(bookingCalls()).toHaveLength(0);
  });


  it('cannot carry an early checkbox click into mode and total that have not loaded', async () => {
    const user = userEvent.setup();
    let finishUnit!: (result: unknown) => void;
    let finishPrice!: (result: unknown) => void;
    fetchMock.mockImplementation((url: string) => {
      if (url.startsWith('/api/units/')) return new Promise(resolve => { finishUnit = resolve; });
      if (url === '/api/pricing/breakdown') return new Promise(resolve => { finishPrice = resolve; });
      return Promise.resolve(response({}, 404));
    });
    renderReview();
    expect(screen.getByRole('checkbox')).toBeDisabled();
    await user.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    await act(async () => finishUnit(response({ name: 'Villa A', instantBook: false })));
    expect(screen.getByText('requestNote')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeDisabled();
    await user.click(screen.getByRole('checkbox'));
    await act(async () => finishPrice(response(quote())));
    expect(screen.getByRole('checkbox')).toBeEnabled();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'requestConfirm' })).toBeDisabled();
    expect(bookingCalls()).toHaveLength(0);
    await user.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: 'requestConfirm' })).toBeEnabled();
  });

});
