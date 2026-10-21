import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { claimIdentity, generateClaimLink } from './people.service';
vi.mock('bcryptjs', () => ({ default: { hash: vi.fn(async (password: string) => `hashed:${password}`) } }));
const hash = 'a'.repeat(64);
function fixture() {
  const token = { id: 'token', identityId: 'invited', consumedAt: null, expiresAt: new Date('2030-01-01'), identity: { id: 'invited', status: 'invited' } };
  const tx = { $queryRaw: vi.fn().mockResolvedValue([]),
    identity: { findUnique: vi.fn().mockResolvedValue(token.identity), update: vi.fn().mockResolvedValue({ id: 'invited', status: 'active' }) },
    oneTimeToken: { findFirst: vi.fn().mockResolvedValue(token), update: vi.fn().mockResolvedValue({}), updateMany: vi.fn().mockResolvedValue({ count: 1 }), create: vi.fn().mockResolvedValue({}) },
    auditLog: { create: vi.fn().mockResolvedValue({}) } };
  return { tx, db: { ...tx, $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)) } };
}
describe('single-use invitation safety', () => {
  let h: ReturnType<typeof fixture>, db: PrismaClient;
  beforeEach(() => { h = fixture(); db = h.db as unknown as PrismaClient; });
  it('locks the identity then token and only then validates current claim state', async () => {
    await claimIdentity(db, { tokenHash: hash, password: 'synthetic-password' });
    expect(h.tx.$queryRaw.mock.calls.map(call => call[0].join('?'))).toEqual([
      'SELECT id FROM identity WHERE id = ? FOR UPDATE', 'SELECT id FROM one_time_token WHERE id = ? FOR UPDATE']);
    expect(h.tx.oneTimeToken.findFirst).toHaveBeenNthCalledWith(2, { where: { id: 'token', tokenHash: hash, purpose: 'account_claim' }, include: { identity: true } });
    expect(h.tx.identity.update).toHaveBeenCalledWith({ where: { id: 'invited' }, data: { status: 'active', hashedPassword: 'hashed:synthetic-password' } });
    expect(h.tx.auditLog.create).toHaveBeenCalledWith({ data: { actorIdentityId: 'invited', action: 'people.account_claimed', entityType: 'Identity', entityId: 'invited', data: {} } });
  });
  it.each(['consumed', 'expired', 'blocked', 'claimed', 'removed'])('rejects changed %s state after the initial lookup', async state => {
    const fresh = { id: 'token', identityId: 'invited', consumedAt: null, expiresAt: new Date('2030-01-01'), identity: { id: 'invited', status: 'invited' } };
    if (state === 'consumed') Object.assign(fresh, { consumedAt: new Date() });
    if (state === 'expired') fresh.expiresAt = new Date(0);
    if (state === 'blocked') fresh.identity.status = 'blocked';
    if (state === 'claimed') fresh.identity.status = 'active';
    h.tx.oneTimeToken.findFirst.mockResolvedValueOnce({ id: 'token', identityId: 'invited' }).mockResolvedValueOnce(state === 'removed' ? null : fresh);
    await expect(claimIdentity(db, { tokenHash: hash, password: 'synthetic-password' })).rejects.toThrow();
    expect(h.tx.identity.update).not.toHaveBeenCalled(); expect(h.tx.oneTimeToken.update).not.toHaveBeenCalled();
  });
  it.each(['short', 'x'.repeat(73), 'я'.repeat(37), '', null])('rejects unsafe password before DB access %#', async password => {
    await expect(claimIdentity(db, { tokenHash: hash, password: password as string })).rejects.toThrow(/password/);
    expect(h.tx.oneTimeToken.findFirst).not.toHaveBeenCalled();
  });
  it.each(['', 'secret', 'A'.repeat(64), null])('rejects malformed token hash %#', async tokenHash => {
    await expect(claimIdentity(db, { tokenHash: tokenHash as string, password: 'synthetic-password' })).rejects.toThrow(/claim link/);
    expect(h.tx.oneTimeToken.findFirst).not.toHaveBeenCalled();
  });
  it('serializes resends with claims and never stores a plaintext claim token', async () => {
    const token = await generateClaimLink(db, { identityId: 'invited' });
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(h.tx.$queryRaw.mock.calls[0][0].join('?')).toBe('SELECT id FROM identity WHERE id = ? FOR UPDATE');
    expect(h.tx.oneTimeToken.create).toHaveBeenCalledWith({ data: expect.objectContaining({ identityId: 'invited', purpose: 'account_claim', tokenHash: expect.not.stringMatching(token) }) });
    expect(h.db.$transaction).toHaveBeenCalledTimes(1);
  });
  it('rechecks invited state after obtaining the resend lock', async () => {
    h.tx.identity.findUnique.mockResolvedValue({ id: 'invited', status: 'active' });
    await expect(generateClaimLink(db, { identityId: 'invited' })).rejects.toThrow(/not in invited/);
    expect(h.tx.oneTimeToken.updateMany).not.toHaveBeenCalled();
  });
  it.each([0, -1, 1.5, NaN, 10081])('rejects invalid claim TTL %s', async ttlMinutes => {
    await expect(generateClaimLink(db, { identityId: 'invited', ttlMinutes })).rejects.toThrow(/expiry/);
    expect(h.db.$transaction).not.toHaveBeenCalled();
  });
});
