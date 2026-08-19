import { describe, it, expect, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { db, resetDb, createIdentity } from '@/test/util';
import { inviteIdentity, generateClaimLink, claimIdentity } from './people.service';
import crypto from 'crypto';

const hash = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

/**
 * The claim flow was complete and unreachable from the other end: the emailed
 * link, the landing page, the token and the password form all existed and were
 * tested, and **nothing could put a person into `invited` status**. An owner
 * handed over a unit had no way in, because the invitation itself was missing.
 */
describe('inviting someone onto the platform', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('creates a person who can then claim their account', async () => {
    const { identity, created } = await inviteIdentity(db, {
      email: 'anna@example.com',
      firstName: 'Anna',
      lastName: 'Petrova',
    });

    expect(created).toBe(true);
    expect(identity.status).toBe('invited');
    // No password is set for them. Setting one and mailing it out would put a
    // working credential in an inbox forever.
    expect(identity.hashedPassword).toBeNull();

    const token = await generateClaimLink(db, { identityId: identity.id });
    const claimed = await claimIdentity(db, { tokenHash: hash(token), password: 'a-good-password' });

    expect(claimed.status).toBe('active');
    const stored = await db.identity.findUnique({ where: { id: identity.id } });
    expect(await bcrypt.compare('a-good-password', stored!.hashedPassword!)).toBe(true);
  });

  it('normalises the email, so the same person is not invited twice', async () => {
    await inviteIdentity(db, { email: 'Anna@Example.com ', firstName: 'Anna', lastName: 'P' });
    const second = await inviteIdentity(db, {
      email: 'anna@example.com',
      firstName: 'Anna',
      lastName: 'P',
    });

    expect(second.created).toBe(false);
    expect(await db.identity.count()).toBe(1);
  });

  it('never downgrades a live account to invited', async () => {
    // An identity is a person, global and singular. The same human arrives as a
    // guest long before they are an owner, and typing their address into the
    // invite form must not suspend the login they already use.
    const existing = await createIdentity({ email: 'owner@example.com' });
    await db.identity.update({
      where: { id: existing.id },
      data: { hashedPassword: await bcrypt.hash('their-password', 4) },
    });

    const result = await inviteIdentity(db, {
      email: 'owner@example.com',
      firstName: 'Someone',
      lastName: 'Else',
    });

    expect(result.created).toBe(false);
    expect(result.alreadyActive).toBe(true);
    expect(result.identity.id).toBe(existing.id);

    const stored = await db.identity.findUnique({ where: { id: existing.id } });
    expect(stored!.status).toBe('active');
    // And their name was not overwritten by whatever was typed into the form.
    expect(stored!.firstName).not.toBe('Someone');
  });

  it('refuses a request missing an email or a name', async () => {
    await expect(
      inviteIdentity(db, { email: 'not-an-email', firstName: 'A', lastName: 'B' })
    ).rejects.toThrow(/valid email/i);

    await expect(
      inviteIdentity(db, { email: 'a@example.com', firstName: '  ', lastName: 'B' })
    ).rejects.toThrow(/name/i);
  });

  it('defaults to Russian, which is the language of this clientele', async () => {
    const { identity } = await inviteIdentity(db, {
      email: 'new@example.com',
      firstName: 'Ivan',
      lastName: 'Ivanov',
    });
    expect(identity.preferredLocale).toBe('ru');
  });
});

describe('resending an invitation', () => {
  let identityId: string;

  beforeEach(async () => {
    await resetDb();
    const { identity } = await inviteIdentity(db, {
      email: 'anna@example.com',
      firstName: 'Anna',
      lastName: 'Petrova',
    });
    identityId = identity.id;
  });

  it('kills the previous link, so an old email is not still a key', async () => {
    const first = await generateClaimLink(db, { identityId });
    const second = await generateClaimLink(db, { identityId });

    await expect(
      claimIdentity(db, { tokenHash: hash(first), password: 'a-good-password' })
    ).rejects.toThrow(/already been used/i);

    await expect(
      claimIdentity(db, { tokenHash: hash(second), password: 'a-good-password' })
    ).resolves.toBeTruthy();
  });

  it('cannot be issued for someone who has already claimed', async () => {
    const token = await generateClaimLink(db, { identityId });
    await claimIdentity(db, { tokenHash: hash(token), password: 'a-good-password' });

    await expect(generateClaimLink(db, { identityId })).rejects.toThrow(/not in invited status/i);
  });
});
