import { describe, expect, it } from 'vitest';
import { resolveProjectResponsibility, resolveUnitResponsibility } from './public-responsibility';

const now = new Date('2026-10-05T00:00:00Z');

describe('public responsibility resolver', () => {
  it('publishes a unit manager only from an active evidenced mandate', () => {
    expect(resolveUnitResponsibility([{
      status: 'active',
      mandateMediaId: 'mandate',
      startsOn: new Date('2026-01-01'),
      endsOn: null,
      managementOrg: { name: 'myUNO', status: 'active' },
    }], now)).toEqual({ scope: 'unit', organizationName: 'myUNO', verified: true });

    expect(resolveUnitResponsibility([{
      status: 'active',
      mandateMediaId: null,
      startsOn: null,
      endsOn: null,
      managementOrg: { name: 'myUNO', status: 'active' },
    }], now).verified).toBe(false);
  });

  it('prefers a verified project operator role over unit-level inference', () => {
    expect(resolveProjectResponsibility([{
      roleKey: 'resort_operator',
      effectiveFrom: new Date('2026-01-01'),
      effectiveTo: null,
      provenance: 'verified',
      organization: { name: 'myUNO', status: 'active' },
    }], [{ organizationName: 'Other Manager' }], 20, now)).toEqual({
      scope: 'project',
      organizationName: 'myUNO',
      verified: true,
    });
  });

  it('describes partial unit coverage as selected units, never the whole project', () => {
    expect(resolveProjectResponsibility([], [
      { organizationName: 'myUNO' },
      { organizationName: 'myUNO' },
    ], 50, now)).toEqual({
      scope: 'selected_units',
      organizationName: 'myUNO',
      verified: true,
    });
  });
});
