import { describe, expect, it } from 'vitest';
import { isStitchWorkspace } from './stitch-surface';

describe('command and guest navigation boundary', () => {
  it.each(['/ops', '/ops/stays/booking', '/mc/portfolio', '/owner/units/unit', '/provider/orders', '/app/admin/units', '/admin/finance/reconciliation'])('uses command chrome for %s', path => {
    expect(isStitchWorkspace(path)).toBe(true);
  });
  it.each(['/', '/owners', '/providers', '/management-companies', '/login', '/app', '/account', '/units/unit', '/services/orders', '/property/onboard'])('retains guest/account navigation for %s', path => {
    expect(isStitchWorkspace(path)).toBe(false);
  });
});
