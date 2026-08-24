import { describe, it, expect } from 'vitest';
import { formatServicePriceLabel } from './price-label';

// Locks in the Q47 satang-shown-as-baht fix on the service detail page
// (src/app/services/[id]/page.tsx). basePriceThb is satang (THB × 100)
// straight from the DB — CLAUDE.md "Money rules".
describe('formatServicePriceLabel', () => {
  it('renders a fixed-price service in baht, not satang', () => {
    // ฿500 cleaning service stored as basePriceThb: 50000
    expect(formatServicePriceLabel('fixed', 50000)).toBe('฿500');
  });

  it('renders a per-hour service with the "from" prefix in baht', () => {
    expect(formatServicePriceLabel('per_hour', 150000)).toBe('from ฿1,500');
  });

  it('does not leave the raw satang integer in the label', () => {
    const label = formatServicePriceLabel('fixed', 500000);
    expect(label).toBe('฿5,000');
    expect(label).not.toContain('500,000');
  });
});
