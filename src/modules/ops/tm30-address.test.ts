import { describe, expect, it } from 'vitest';
import { buildTm30AddressBlock } from './tm30-address';

describe('buildTm30AddressBlock', () => {
  it('joins unit, supplement, and project address', () => {
    expect(
      buildTm30AddressBlock({
        unitName: 'Villa 12',
        addressSupplement: 'Building B',
        projectAddress: '123 Beach Road, Phuket',
      })
    ).toBe('Villa 12\nBuilding B\n123 Beach Road, Phuket');
  });

  it('skips empty lines', () => {
    expect(
      buildTm30AddressBlock({
        unitName: 'Villa 12',
        addressSupplement: '',
        projectAddress: null,
      })
    ).toBe('Villa 12');
  });
});
