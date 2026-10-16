import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDb } from '@/test/util';
import { inviteIdentity, generateClaimLink, claimIdentity } from './people.service';
const url = new URL(process.env.DATABASE_URL_TEST ?? 'http://invalid');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || !['/myuno_test', '/myuno_browser_test'].includes(url.pathname))
  throw new Error('Claim concurrency tests require an isolated local myUNO test database');
const hash = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
describe('single-use employee password setup on real PostgreSQL', () => {
  let identityId: string;
  beforeEach(async () => { await resetDb(); identityId = (await inviteIdentity(db, {
    email: 'synthetic-employee@example.test', firstName: 'Synthetic', lastName: 'Employee',
  })).identity.id; });
  it('two simultaneous claims cannot overwrite the first chosen password', async () => {
    const token = await generateClaimLink(db, { identityId });
    const passwords = ['synthetic-first-password', 'synthetic-second-password'];
    const result = await Promise.allSettled(passwords.map(password => claimIdentity(db, { tokenHash: hash(token), password })));
    expect(result.filter(item => item.status === 'fulfilled')).toHaveLength(1);
    const winner = result.findIndex(item => item.status === 'fulfilled');
    const stored = await db.identity.findUniqueOrThrow({ where: { id: identityId } });
    expect(stored.status).toBe('active'); expect(stored.emailVerifiedAt).toBeNull();
    expect(await bcrypt.compare(passwords[winner], stored.hashedPassword!)).toBe(true);
    expect(await bcrypt.compare(passwords[1 - winner], stored.hashedPassword!)).toBe(false);
    expect(await db.auditLog.count({ where: { action: 'people.account_claimed', entityId: identityId } })).toBe(1);
    await expect(claimIdentity(db, { tokenHash: hash(token), password: 'synthetic-third-password' })).rejects.toThrow(/already been used/);
  });
  it('preserves a separately verified mailbox timestamp without manufacturing verification', async () => {
    const verifiedAt = new Date('2026-01-01T00:00:00Z');
    await db.identity.update({ where: { id: identityId }, data: { emailVerifiedAt: verifiedAt } });
    const token = await generateClaimLink(db, { identityId });
    await claimIdentity(db, { tokenHash: hash(token), password: 'synthetic-password' });
    expect((await db.identity.findUniqueOrThrow({ where: { id: identityId } })).emailVerifiedAt).toEqual(verifiedAt);
  });
  it('concurrent resends leave exactly one live link', async () => {
    const tokens = await Promise.all([generateClaimLink(db, { identityId }), generateClaimLink(db, { identityId })]);
    const live = await db.oneTimeToken.findMany({ where: { identityId, purpose: 'account_claim', consumedAt: null } });
    expect(live).toHaveLength(1); expect(tokens.map(hash)).toContain(live[0].tokenHash);
    const old = tokens.find(token => hash(token) !== live[0].tokenHash)!;
    await expect(claimIdentity(db, { tokenHash: hash(old), password: 'synthetic-password' })).rejects.toThrow(/already been used/);
  });
  it('a blocked invitation cannot be claimed and keeps no chosen password', async () => {
    const token = await generateClaimLink(db, { identityId });
    await db.identity.update({ where: { id: identityId }, data: { status: 'blocked' } });
    await expect(claimIdentity(db, { tokenHash: hash(token), password: 'synthetic-password' })).rejects.toThrow(/not in invited/);
    expect((await db.identity.findUniqueOrThrow({ where: { id: identityId } })).hashedPassword).toBeNull();
  });
});
