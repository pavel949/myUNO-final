import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import ServicesClient from './services-client';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock('next/image', () => ({ default: () => <span /> }));
const labels = new Proxy({ 'services.browse.loading': 'Loading catalogue', 'services.browse.load_error': 'Load failed', 'services.browse.empty': 'No services', 'services.my_orders.empty': 'No orders', 'services.browse.retry': 'Retry' }, { get: (target, key) => target[key as keyof typeof target] ?? String(key) }) as Record<string, string>;
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('service discovery failure recovery', () => {
  it('does not show empty supply while loading', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
    render(<ServicesClient labels={labels} categories={[]} />);
    expect(screen.queryByText('No services')).toBeNull();
    expect(screen.getAllByText('Loading catalogue').length).toBe(2);
  });
  it('shows recoverable load failure rather than empty supply', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    render(<ServicesClient labels={labels} categories={[]} />);
    expect((await screen.findAllByText('Load failed')).length).toBe(2);
    expect(screen.queryByText('No services')).toBeNull();
    expect(screen.queryByText('No orders')).toBeNull();
  });
  it('retains the public catalogue when private orders fail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => url.startsWith('/api/service-orders') ? { ok: false, status: 500 } : { ok: true, json: async () => ({ services: [{ id: 'clean', title: 'Cleaning test', categoryKey: 'cleaning', priceModel: 'fixed', basePriceThb: 50000, providerVetted: false, coverUrl: null }] }) }));
    render(<ServicesClient labels={labels} categories={[]} />);
    expect(await screen.findByText('Cleaning test')).toBeTruthy();
    expect(screen.queryByText('No services')).toBeNull();
    expect(await screen.findByText('Load failed')).toBeTruthy();
  });
});
