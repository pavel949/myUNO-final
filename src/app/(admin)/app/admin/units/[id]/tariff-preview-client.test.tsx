import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TariffPreviewClient from './tariff-preview-client';
const labels = { title: 'Preview', mode: 'Mode', daily: 'Stay', monthly: 'Monthly', yearly: 'Yearly', arrival: 'Arrival',
  departure: 'Departure', preview: 'Calculate', draft: 'Lease only', total: 'Booking total', minimum: 'Minimum', failure: 'Failed',
  terms: 'Terms', deposit: 'Deposit', confirmation: 'Confirmation', guests: 'Guests', subtotal: 'Subtotal', partial: 'Partial tariff only',
  saved: 'Saved data only', availability: 'Availability not checked', cleaning: 'Cleaning', service: 'Service', tax: 'Tax', discount: 'Discount', annual: 'Annual illustration' };
const response = (body: unknown) => ({ ok: true, json: async () => body });
const fill = () => {
  fireEvent.change(screen.getByLabelText('Arrival'), { target: { value: '2028-06-01' } });
  fireEvent.change(screen.getByLabelText('Departure'), { target: { value: '2028-06-04' } });
};
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('saved-price preview state', () => {
  it('clears an old result when dates change or saved tariffs change', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ pricingScope: 'canonical_quote', totalSatang: 370200 })));
    render(<TariffPreviewClient unitId="unit" labels={labels} />); fill();
    fireEvent.click(screen.getByRole('button', { name: 'Calculate' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Booking total');
    expect(screen.getByRole('status')).toHaveTextContent('Availability not checked');
    fireEvent.change(screen.getByLabelText('Departure'), { target: { value: '2028-06-05' } });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Calculate' }));
    await screen.findByRole('status');
    fireEvent(window, new CustomEvent('tariff-saved', { detail: { unitId: 'unit' } }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
  it('ignores an older in-flight response after an input change and repeated clicks', async () => {
    let finish!: (value: unknown) => void;
    const fetch = vi.fn().mockImplementation(() => new Promise(resolve => { finish = resolve; })); vi.stubGlobal('fetch', fetch);
    render(<TariffPreviewClient unitId="unit" labels={labels} />); fill();
    fireEvent.click(screen.getByRole('button', { name: 'Calculate' }));
    fireEvent.click(screen.getByRole('button', { name: 'Calculate' }));
    expect(fetch).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText('Arrival'), { target: { value: '2028-06-02' } });
    finish(response({ pricingScope: 'canonical_quote', totalSatang: 370200 }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Calculate' })).toBeEnabled());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
  it('rejects malformed success instead of displaying a zero quote', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({})));
    render(<TariffPreviewClient unitId="unit" labels={labels} />); fill();
    fireEvent.click(screen.getByRole('button', { name: 'Calculate' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed');
  });
});
