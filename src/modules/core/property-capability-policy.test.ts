import { describe, expect, it } from 'vitest';
import { capabilityExpiryWithin, capabilityScopeContains, capabilityScopeMatches,
  isEffectiveCapabilityGrant, validCapabilityScope, type PropertyCapabilityGrant } from './property-capability-policy';

const now = new Date('2026-10-15T12:00:00Z');
const root: PropertyCapabilityGrant = { id: 'root', identityId: 'manager', role: 'pricing_editor', status: 'active',
  scopeType: 'project', projectId: 'project-a', unitId: null, canDelegate: true, parentGrantId: null,
  grantedByIdentityId: 'founder', expiresAt: new Date('2026-12-01T00:00:00Z') };
const leaf: PropertyCapabilityGrant = { ...root, id: 'leaf', identityId: 'employee', scopeType: 'unit',
  unitId: 'unit-a', canDelegate: false, parentGrantId: 'root', grantedByIdentityId: 'manager',
  expiresAt: new Date('2026-11-01T00:00:00Z') };
const effective = (grant = leaf, parent = root, extra = {}) => isEffectiveCapabilityGrant({
  grant, parent, actorIdentityId: 'employee', actorActive: true, parentActorActive: true, now, ...extra,
});

describe('bounded one-step property capability delegation', () => {
  it.each(['pricing_editor', 'booking_mode_editor'])('supports only separately granted %s authority', role => {
    expect(effective({ ...leaf, role }, { ...root, role })).toBe(true);
  });
  it.each(['content_contributor', 'staff_ops', 'mc_member', 'portfolio_manager'])('never infers the capability from %s', role => {
    expect(effective({ ...leaf, role }, { ...root, role })).toBe(false);
  });
  it('allows a current direct founder-created root without requiring delegation rights', () => {
    expect(isEffectiveCapabilityGrant({ grant: { ...root, canDelegate: false }, actorIdentityId: 'manager', actorActive: true, now })).toBe(true);
  });
  it.each([
    { scopeType: 'platform', projectId: null, unitId: null },
    { scopeType: 'project', unitId: 'unit-a' }, { scopeType: 'unit', unitId: null },
    { projectId: null }, { projectId: '' }, { projectId: ' project-a' },
    { organizationId: 'org' }, { providerId: 'provider' },
  ])('rejects malformed scope %j', change => {
    expect(validCapabilityScope({ ...leaf, ...change })).toBe(false);
    expect(effective({ ...leaf, ...change })).toBe(false);
  });
  it.each([
    { status: 'revoked' }, { expiresAt: now }, { expiresAt: new Date('invalid') },
    { role: 'booking_mode_editor' }, { canDelegate: false }, { parentGrantId: 'ancestor' },
    { identityId: 'replacement-manager' }, { projectId: 'foreign-project' },
    { scopeType: 'unit', unitId: 'other-unit' },
  ])('immediately rejects an invalid or changed ancestor %j', change => {
    expect(effective(leaf, { ...root, ...change })).toBe(false);
  });
  it.each([
    { status: 'revoked' }, { identityId: 'other-employee' }, { canDelegate: true },
    { parentGrantId: 'leaf' }, { id: 'root' }, { grantedByIdentityId: 'unrelated-manager' },
    { expiresAt: null }, { expiresAt: new Date('2027-01-01T00:00:00Z') },
  ])('rejects invalid leaf or escalated grant %j', change => {
    expect(effective({ ...leaf, ...change })).toBe(false);
  });
  it('rejects blocked actors or blocked parent holders without revoking their rows first', () => {
    expect(effective(leaf, root, { actorActive: false })).toBe(false);
    expect(effective(leaf, root, { parentActorActive: false })).toBe(false);
  });
  it('does not let an exact unit parent become a project grant', () => {
    expect(capabilityScopeContains({ ...root, scopeType: 'unit', unitId: 'unit-a' }, { ...leaf, scopeType: 'project', unitId: null })).toBe(false);
    expect(capabilityScopeContains({ ...root, scopeType: 'unit', unitId: 'unit-a' }, leaf)).toBe(true);
  });
  it('requires both actual project and unit to match an exact unit grant', () => {
    expect(capabilityScopeMatches(leaf, { projectId: 'project-a', unitId: 'unit-a' })).toBe(true);
    expect(capabilityScopeMatches(leaf, { projectId: 'foreign', unitId: 'unit-a' })).toBe(false);
    expect(capabilityScopeMatches(leaf, { projectId: 'project-a' })).toBe(false);
  });
  it('does not require an expiry for a child of an unbounded parent', () => {
    expect(capabilityExpiryWithin({ ...root, expiresAt: null }, { ...leaf, expiresAt: null })).toBe(true);
  });
});
