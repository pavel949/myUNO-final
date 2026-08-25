// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import ProviderServicesClient from './services-client';

// Q47 regression guard: basePriceThb arrives as satang (THB × 100) straight
// from /api/provider/services — the provider's own service list (read-only
// view) must show baht, not raw satang.
describe('ProviderServicesClient money display', () => {
  const labels = {
    'provider.services.title': 'My services',
    'provider.services.empty': 'No services yet',
    'provider.services.new_title': 'Add a service',
    'provider.services.field_title': 'Title',
    'provider.services.field_description': 'Description',
    'provider.services.field_category': 'Category',
    'provider.services.field_price_model': 'Price model',
    'provider.services.field_price': 'Price (THB)',
    'provider.services.field_duration': 'Duration (minutes)',
    'provider.services.field_notice': 'Advance notice (hours)',
    'provider.services.create': 'Add service',
    'provider.services.save': 'Save',
    'provider.services.edit': 'Edit',
    'provider.services.draft_note': 'Drafts go live after review.',
    'services.category.wellness': 'Wellness',
    'provider.services.price_model.fixed': 'Fixed price',
    'service.status.active': 'Active',
  };

  it('renders a service base price converted to baht, not raw satang', () => {
    render(
      <ProviderServicesClient
        services={[
          {
            id: 'svc-1',
            categoryKey: 'wellness',
            title: 'In-villa massage',
            description: null,
            priceModel: 'fixed',
            basePriceThb: 150000, // ฿1,500
            durationMin: 60,
            advanceNoticeHours: 2,
            status: 'active',
          },
        ]}
        categories={[{ key: 'wellness', label: 'Wellness' }]}
        labels={labels}
      />
    );
    expect(screen.getByText(/฿1,500/)).toBeInTheDocument();
    expect(screen.queryByText(/150,000/)).not.toBeInTheDocument();
  });
});

// Q49 regression guard: the price field asks the provider for baht (its own
// label says "Price (THB)") but was submitting the typed number straight
// into the satang column, and pre-filling the edit box with raw satang. Both
// directions of that round-trip are covered here.
describe('ProviderServicesClient price round-trip (Q49)', () => {
  const labels = {
    'provider.services.title': 'My services',
    'provider.services.empty': 'No services yet',
    'provider.services.new_title': 'Add a service',
    'provider.services.field_title': 'Title',
    'provider.services.field_description': 'Description',
    'provider.services.field_category': 'Category',
    'provider.services.field_price_model': 'Price model',
    'provider.services.field_price': 'Price (THB)',
    'provider.services.field_duration': 'Duration (minutes)',
    'provider.services.field_notice': 'Advance notice (hours)',
    'provider.services.create': 'Add service',
    'provider.services.save': 'Save',
    'provider.services.edit': 'Edit',
    'provider.services.draft_note': 'Drafts go live after review.',
    'services.category.wellness': 'Wellness',
    'provider.services.price_model.fixed': 'Fixed price',
    'provider.services.price_model.quote': 'Quote',
    'provider.services.price_model.per_hour': 'Per hour',
    'provider.services.price_model.per_person': 'Per person',
    'service.status.active': 'Active',
    'service.status.draft': 'Draft',
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends baht typed into the create form as satang', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(
      <ProviderServicesClient
        services={[]}
        categories={[{ key: 'wellness', label: 'Wellness' }]}
        labels={labels}
      />
    );

    await user.type(screen.getByLabelText('Title'), 'In-villa massage');
    await user.type(screen.getByLabelText('Price (THB)'), '1500');
    await user.click(screen.getByRole('button', { name: 'Add service' }));

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body as string);
    // ฿1,500 typed -> 150,000 satang sent to the API.
    expect(body.basePriceThb).toBe(150000);
  });

  it('pre-fills the edit box in baht and re-submits the round-trip as satang', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(
      <ProviderServicesClient
        services={[
          {
            id: 'svc-1',
            categoryKey: 'wellness',
            title: 'In-villa massage',
            description: null,
            priceModel: 'fixed',
            basePriceThb: 150000, // ฿1,500
            durationMin: 60,
            advanceNoticeHours: 2,
            status: 'draft',
          },
        ]}
        categories={[{ key: 'wellness', label: 'Wellness' }]}
        labels={labels}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Edit' }));

    // Pre-filled in baht (1500), not raw satang (150000).
    const priceInput = screen.getByPlaceholderText('Price (THB)') as HTMLInputElement;
    expect(priceInput.value).toBe('1500');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(body.basePriceThb).toBe(150000);
  });
});
