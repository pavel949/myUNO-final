// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { UnitCard } from './UnitCard';

// Q47 regression guard: the search API returns the raw unit row, so
// nightlySatang arrives as satang (THB × 100). UnitCard must render baht via
// MoneyAmount — the prior inline search card printed satang as baht (100x).
describe('UnitCard money display', () => {
  it('renders the nightly price converted to baht, not raw satang', () => {
    render(
      <UnitCard
        href="/units/u1"
        name="Villa G-08"
        nightlySatang={939300} // ฿9,393
        perNightLabel="per night"
      />
    );
    expect(screen.getByText(/9,393/)).toBeInTheDocument();
    expect(screen.queryByText(/939,300/)).not.toBeInTheDocument();
  });

  it('shows the rating summary only when a rating is known', () => {
    const { rerender } = render(
      <UnitCard
        href="/units/u1"
        name="Villa G-08"
        nightlySatang={939300}
        perNightLabel="per night"
        averageRating={null}
        ratingSummary="4.8 (12 reviews)"
      />
    );
    expect(screen.queryByText(/reviews/)).not.toBeInTheDocument();

    rerender(
      <UnitCard
        href="/units/u1"
        name="Villa G-08"
        nightlySatang={939300}
        perNightLabel="per night"
        averageRating={4.8}
        ratingSummary="4.8 (12 reviews)"
      />
    );
    expect(screen.getByText('4.8 (12 reviews)')).toBeInTheDocument();
  });

  it('renders a save toggle that reflects saved state and fires onToggle', () => {
    const onToggle = vi.fn();
    render(
      <UnitCard
        href="/units/u1"
        name="Villa G-08"
        nightlySatang={939300}
        perNightLabel="per night"
        save={{ saved: true, onToggle, saveLabel: 'Save', savedLabel: 'Saved' }}
      />
    );
    const toggle = screen.getByRole('button', { name: 'Saved' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
