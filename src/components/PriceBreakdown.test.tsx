// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { PriceBreakdown } from './PriceBreakdown';

describe('PriceBreakdown', () => {
  it('renders charges and total in baht from satang, with a discount shown negative', () => {
    render(
      <PriceBreakdown
        lines={[
          { label: '× 3 nights', satang: 2817900 }, // ฿28,179
          { label: 'Long stay discount', satang: 281790, kind: 'discount' }, // −฿2,818
          { label: 'Cleaning fee', satang: 150000 }, // ฿1,500
        ]}
        totalLabel="Total"
        totalSatang={2686110} // ฿26,861
      />
    );
    expect(screen.getByText('× 3 nights')).toBeInTheDocument();
    expect(screen.getByText(/28,179/)).toBeInTheDocument();
    // Discount renders with a leading minus sign; the "−" and the amount are
    // separate nodes, so match the combined text of the wrapping span.
    expect(
      screen.getByText((_content, node) => node?.textContent === '−฿2,818')
    ).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText(/26,861/)).toBeInTheDocument();
    // Never prints raw satang.
    expect(screen.queryByText(/2,817,900/)).not.toBeInTheDocument();
  });
});
