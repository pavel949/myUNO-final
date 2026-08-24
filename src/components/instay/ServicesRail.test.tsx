// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ServicesRail, type RailService } from './ServicesRail';

// Q47 regression guard: basePriceThb arrives as satang (THB × 100) straight
// from getInStayHomeSpace — the rail must show baht, not raw satang.
describe('ServicesRail money display', () => {
  const baseService: RailService = {
    id: 'svc-1',
    title: 'In-villa massage',
    categoryKey: 'wellness',
    basePriceThb: 150000, // ฿1,500
    priceModel: 'fixed',
    providerName: 'Andaman Wellness',
    isVetted: true,
  };

  const labels = { 'home.services.title': 'Services for your stay', 'home.services.from': 'from', 'home.services.vetted': 'Vetted' };

  it('renders the base price converted to baht, not raw satang', () => {
    render(
      <ServicesRail
        services={[baseService]}
        labels={labels}
        hrefForService={(id) => `/services/${id}`}
      />
    );
    expect(screen.getByText(/from ฿1,500/)).toBeInTheDocument();
    expect(screen.queryByText(/150,000/)).not.toBeInTheDocument();
  });

  it('renders nothing when there are no services', () => {
    const { container } = render(
      <ServicesRail services={[]} labels={labels} hrefForService={(id) => `/services/${id}`} />
    );
    expect(container.firstChild).toBeNull();
  });
});
