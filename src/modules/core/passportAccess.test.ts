import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db as prisma, resetDb } from '@/test/util';
import { requirePassportAccess } from './passportAccess';
import { grantRole } from './roles';
import { getAuditLogForEntity } from '@/modules/audit';
import type { RoleType } from '@prisma/client';

/**
 * Doc 12 §§1, 4 / canvas board 19's permission matrix: opening a guest
 * passport is one of the table's two absolutes. This locks in the rule at
 * the one function every passport-viewing surface is meant to call through.
 */
describe('requirePassportAccess', () => {
  let adminGranterId: string;

  beforeEach(async () => {
    await resetDb();
    const granter = await prisma.identity.create({
      data: { firstName: 'Granter', lastName: 'Admin', email: 'granter@test.com', isAdmin: true, status: 'active' },
    });
    adminGranterId = granter.id;
  });

  afterEach(async () => {
    await resetDb();
  });

  async function identityWithRole(role: RoleType | null, opts: { isAdmin?: boolean } = {}) {
    const identity = await prisma.identity.create({
      data: {
        firstName: role ?? 'Admin',
        lastName: 'User',
        email: `${role ?? 'admin'}-${Math.random()}@test.com`,
        status: 'active',
        isAdmin: opts.isAdmin ?? false,
      },
    });
    if (role) {
      await grantRole({ identityId: identity.id, role, scopeType: 'platform', grantedByIdentityId: adminGranterId });
    }
    return identity;
  }

  it('never allows an owner to open another guest\'s passport', async () => {
    const owner = await identityWithRole('owner');
    const guest = await identityWithRole('guest');

    const result = await requirePassportAccess({
      identity: owner,
      subjectIdentityId: guest.id,
      entityType: 'PartyMember',
      entityId: 'party-1',
      reason: 'checking in',
    });

    expect(result).toEqual({ ok: false, error: 'forbidden' });
  });

  it('never allows an mc_member to open a guest passport, even for their own units', async () => {
    const mc = await identityWithRole('mc_member');
    const guest = await identityWithRole('guest');

    const result = await requirePassportAccess({
      identity: mc,
      subjectIdentityId: guest.id,
      entityType: 'PartyMember',
      entityId: 'party-1',
      reason: 'their unit, arrivals today',
    });

    expect(result).toEqual({ ok: false, error: 'forbidden' });
  });

  it('never allows a provider member to open a guest passport', async () => {
    const provider = await identityWithRole('provider_member');
    const guest = await identityWithRole('guest');

    const result = await requirePassportAccess({
      identity: provider,
      subjectIdentityId: guest.id,
      entityType: 'PartyMember',
      entityId: 'party-1',
      reason: 'fulfilling an order',
    });

    expect(result).toEqual({ ok: false, error: 'forbidden' });
  });

  it('requires a reason from staff_ops before it will disclose another identity\'s passport', async () => {
    const staff = await identityWithRole('staff_ops');
    const guest = await identityWithRole('guest');

    const withoutReason = await requirePassportAccess({
      identity: staff,
      subjectIdentityId: guest.id,
      entityType: 'PartyMember',
      entityId: 'party-1',
    });
    expect(withoutReason).toEqual({ ok: false, error: 'reason_required' });

    const withReason = await requirePassportAccess({
      identity: staff,
      subjectIdentityId: guest.id,
      entityType: 'PartyMember',
      entityId: 'party-1',
      reason: 'verifying arrival identity',
    });
    expect(withReason).toEqual({ ok: true });
  });

  it('writes an audit entry with the stated reason when staff_ops or admin actually view it', async () => {
    const staff = await identityWithRole('staff_ops');
    const guest = await identityWithRole('guest');

    await requirePassportAccess({
      identity: staff,
      subjectIdentityId: guest.id,
      entityType: 'PartyMember',
      entityId: 'party-42',
      reason: 'verifying arrival identity',
    });

    const entries = await getAuditLogForEntity('PartyMember', 'party-42');
    expect(entries).toHaveLength(1);
    expect(entries[0].actorIdentityId).toBe(staff.id);
    expect(entries[0].action).toBe('compliance:view_passport_and_sensitive_data');
    expect((entries[0].data as any).reason).toBe('verifying arrival identity');
  });

  it('admin also needs a reason and is also logged — the bypass in can() does not apply here', async () => {
    const admin = await identityWithRole(null, { isAdmin: true });
    const guest = await identityWithRole('guest');

    const withoutReason = await requirePassportAccess({
      identity: admin,
      subjectIdentityId: guest.id,
      entityType: 'PartyMember',
      entityId: 'party-2',
    });
    expect(withoutReason).toEqual({ ok: false, error: 'reason_required' });

    await requirePassportAccess({
      identity: admin,
      subjectIdentityId: guest.id,
      entityType: 'PartyMember',
      entityId: 'party-2',
      reason: 'dispute investigation',
    });
    const entries = await getAuditLogForEntity('PartyMember', 'party-2');
    expect(entries).toHaveLength(1);
    expect(entries[0].actorIdentityId).toBe(admin.id);
  });

  it('needs neither a reason nor an audit entry when a person views their own record', async () => {
    const guest = await identityWithRole('guest');

    const result = await requirePassportAccess({
      identity: guest,
      subjectIdentityId: guest.id,
      entityType: 'PartyMember',
      entityId: 'party-own',
    });

    expect(result).toEqual({ ok: true });
    const entries = await getAuditLogForEntity('PartyMember', 'party-own');
    expect(entries).toHaveLength(0);
  });
});
