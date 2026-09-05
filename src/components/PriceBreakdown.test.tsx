import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PriceBreakdown } from './PriceBreakdown';

describe('PriceBreakdown', () => {
  it('renders every line item with its attribution and the total', () => {
    render(
      <PriceBreakdown
        items={[
          { label: '8 nights × ฿4,500', amountSatang: 3_600_000, attribution: 'high season · rule RS-2026-HI' },
          { label: 'Cleaning fee', amountSatang: 180_000 },
          { label: 'Direct-booking credit', amountSatang: -120_000 },
        ]}
        totalLabel="Total"
        totalSatang={3_660_000}
      />
    );

    expect(screen.getByText('8 nights × ฿4,500')).toBeInTheDocument();
    expect(screen.getByText('high season · rule RS-2026-HI')).toBeInTheDocument();
    expect(screen.getByText('฿36,000')).toBeInTheDocument();
    expect(screen.getByText('−฿1,200')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('฿36,600')).toBeInTheDocument();
  });

  it('never computes the total itself — it only renders what it is given', () => {
    render(<PriceBreakdown items={[{ label: 'A', amountSatang: 100 }]} totalLabel="Total" totalSatang={999_999} />);
    // Deliberately mismatched vs. the sum of items — PriceBreakdown must not "correct" it.
    expect(screen.getByText('฿10,000')).toBeInTheDocument();
  });
});
