import { describe, it, expect } from 'vitest';
import { resolveLanding, availableSurfaces } from './landing';

/**
 * Doc 08 §5 specifies an adaptive landing and there wasn't one, so where a
 * person ended up depended on which link they had last been sent. These pin the
 * routing policy, which is a decision worth being able to read.
 */
describe('where a person lands', () => {
  const base = { isAdmin: false, roles: [] as never[] };

  it('sends someone with a stay under way to that stay, above everything else', () => {
    // A person in a bed tonight needs the door code, not a portfolio. It is the
    // most time-bound context there is, and it ends by itself in a few days.
    expect(
      resolveLanding({ isAdmin: true, roles: ['owner', 'staff_ops'], activeBookingId: 'b-1' })
    ).toEqual({ path: '/bookings/b-1/home-space', reason: 'active_stay' });
  });

  it('sends an admin to the admin panel', () => {
    expect(resolveLanding({ ...base, isAdmin: true }).path).toBe('/app/admin');
  });

  it('sends staff to the ops board, ahead of anything they happen to own', () => {
    // Both hats are real; at nine in the morning they are at work.
    const landing = resolveLanding({ ...base, roles: ['owner', 'staff_ops'] });
    expect(landing).toEqual({ path: '/ops', reason: 'staff' });
  });

  it('treats an on-site host as staff', () => {
    expect(resolveLanding({ ...base, roles: ['onsite_host'] }).path).toBe('/ops');
  });

  it.each([
    ['mc_member', '/mc'],
    ['juristic_member', '/juristic'],
    ['provider_member', '/provider'],
    ['owner', '/owner'],
    ['resident', '/residence'],
  ] as const)('sends a %s to %s', (role, path) => {
    expect(resolveLanding({ ...base, roles: [role] }).path).toBe(path);
  });

  it('sends a buyer to the search rather than to an empty page', () => {
    // Doc 07 F-BUY defers the buyer surfaces to phase two (Q1). There is
    // genuinely nothing authenticated for them yet, and a blank screen would be
    // a worse answer than the search they arrived from.
    expect(resolveLanding({ ...base, roles: ['buyer'] })).toEqual({
      path: '/search',
      reason: 'public',
    });
  });

  it('sends a guest between stays to the search', () => {
    expect(resolveLanding({ ...base, roles: ['guest'] }).path).toBe('/search');
  });

  it('sends someone with no role at all somewhere they can act', () => {
    expect(resolveLanding(base).path).toBe('/search');
  });
});

describe('the other hats a person is wearing', () => {
  it('lists every surface they can reach, not only the one they landed on', () => {
    const surfaces = availableSurfaces({
      isAdmin: true,
      roles: ['owner', 'staff_ops', 'resident'],
      activeBookingId: 'b-1',
    });

    expect(surfaces.map((s) => s.reason)).toEqual([
      'active_stay',
      'admin',
      'staff',
      'owner',
      'resident',
    ]);
  });

  it('does not offer the ops board twice to someone who is both kinds of staff', () => {
    const surfaces = availableSurfaces({
      isAdmin: false,
      roles: ['staff_ops', 'onsite_host'],
    });

    expect(surfaces.map((s) => s.path)).toEqual(['/ops']);
  });

  it('is empty for someone with nothing of their own', () => {
    expect(availableSurfaces({ isAdmin: false, roles: ['guest'] })).toEqual([]);
  });
});
