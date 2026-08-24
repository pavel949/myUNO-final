// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
