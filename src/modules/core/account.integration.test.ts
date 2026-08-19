import { describe, it, expect, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { db, resetDb, createIdentity } from '@/test/util';
import {
  getAccountProfile,
  updateAccountProfile,
  changeAccountPassword,
  getNotificationSettings,
  setNotificationPreference,
  UNMUTABLE_TYPES,
} from './account.service';

/**
 * Nobody could change their own name, language or password, and nothing could
 * write NotificationPreference — so a consent could be given and never
 * withdrawn, which under the PDPA is not consent at all.
 */
describe('a person managing their own account', () => {
  let identityId: string;

  beforeEach(async () => {
    await resetDb();
    const identity = await createIdentity({ firstName: 'Anna', lastName: 'Petrova' });
    identityId = identity.id;
  });

  describe('the profile', () => {
    it('reports who they are without ever returning the password hash', async () => {
      const profile = await getAccountProfile(db, identityId);

      expect(profile!.firstName).toBe('Anna');
      // A hash is not a field a client has any use for, and leaking it makes an
      // offline attack possible from a page that merely renders a name.
      expect(JSON.stringify(profile)).not.toMatch(/hash/i);
      expect(profile).toHaveProperty('hasPassword');
    });

    it('changes a name and a language', async () => {
      await updateAccountProfile(db, identityId, { firstName: 'Anya', preferredLocale: 'ru' });

      const profile = await getAccountProfile(db, identityId);
      expect(profile!.firstName).toBe('Anya');
      expect(profile!.preferredLocale).toBe('ru');
    });

    it('refuses a language the platform does not speak', async () => {
      await expect(
        updateAccountProfile(db, identityId, { preferredLocale: 'fr' })
      ).rejects.toThrow(/unsupported locale/i);
    });

    it('refuses an empty name rather than storing one', async () => {
      await expect(
        updateAccountProfile(db, identityId, { firstName: '   ' })
      ).rejects.toThrow(/cannot be empty/i);
    });

    it('cannot change email or phone here', async () => {
      // Both are verified identifiers and both recover the account. Changing one
      // is a flow with a confirmation step, not a field edit — otherwise a
      // borrowed session moves the account to an address the thief controls.
      await updateAccountProfile(db, identityId, {
        firstName: 'Anya',
        // @ts-expect-error — proving the field is not part of the input type
        email: 'attacker@example.com',
      });

      const identity = await db.identity.findUnique({ where: { id: identityId } });
      expect(identity!.email).not.toBe('attacker@example.com');
    });
  });

  describe('the password', () => {
    beforeEach(async () => {
      await db.identity.update({
        where: { id: identityId },
        data: { hashedPassword: await bcrypt.hash('current-password', 4) },
      });
    });

    it('changes when the current one is proved', async () => {
      await expect(
        changeAccountPassword(db, identityId, 'current-password', 'a-new-password')
      ).resolves.toEqual({ changed: true });

      const identity = await db.identity.findUnique({ where: { id: identityId } });
      expect(await bcrypt.compare('a-new-password', identity!.hashedPassword!)).toBe(true);
    });

    it('refuses without the current one, so a borrowed session cannot lock the owner out', async () => {
      await expect(
        changeAccountPassword(db, identityId, 'guessing', 'a-new-password')
      ).rejects.toMatchObject({ code: 'WRONG_PASSWORD' });

      const identity = await db.identity.findUnique({ where: { id: identityId } });
      expect(await bcrypt.compare('current-password', identity!.hashedPassword!)).toBe(true);
    });

    it('refuses a password too short to be worth having', async () => {
      await expect(
        changeAccountPassword(db, identityId, 'current-password', 'short')
      ).rejects.toThrow(/at least 8/i);
    });

    it('refuses reusing the current password', async () => {
      await expect(
        changeAccountPassword(db, identityId, 'current-password', 'current-password')
      ).rejects.toThrow(/differ/i);
    });

    it('tells an identity with no password to use the reset link', async () => {
      const linkOnly = await createIdentity();

      await expect(
        changeAccountPassword(db, linkOnly.id, 'anything', 'a-new-password')
      ).rejects.toThrow(/reset link/i);
    });
  });

  describe('what reaches them', () => {
    const TYPES = ['stay_confirmed', 'stay_cancelled'] as const;
    const CHANNELS = ['in_app', 'email'] as const;

    it('lists every combination, not only the ones stored', async () => {
      // Nobody has touched a preference yet. Listing only stored rows would show
      // an empty screen to everyone, which is everyone at first.
      const settings = await getNotificationSettings(db, identityId, TYPES, CHANNELS);

      expect(settings).toHaveLength(4);
      expect(settings.every((s) => s.muted === false)).toBe(true);
    });

    it('mutes and unmutes one type on one channel', async () => {
      await setNotificationPreference(db, identityId, 'stay_confirmed', 'email', true);

      let settings = await getNotificationSettings(db, identityId, TYPES, CHANNELS);
      expect(settings.find((s) => s.type === 'stay_confirmed' && s.channel === 'email')!.muted).toBe(true);
      // The other channel is untouched: muting email is not muting everything.
      expect(settings.find((s) => s.type === 'stay_confirmed' && s.channel === 'in_app')!.muted).toBe(false);

      await setNotificationPreference(db, identityId, 'stay_confirmed', 'email', false);
      settings = await getNotificationSettings(db, identityId, TYPES, CHANNELS);
      expect(settings.find((s) => s.type === 'stay_confirmed' && s.channel === 'email')!.muted).toBe(false);
    });

    it('refuses to silence a notification carrying a legal obligation', async () => {
      // A guest muting their own TM30 escalation would leave the operator in
      // breach of a 24-hour immigration deadline on their behalf.
      await expect(
        setNotificationPreference(db, identityId, UNMUTABLE_TYPES[0], 'email', true)
      ).rejects.toMatchObject({ code: 'UNMUTABLE' });
    });

    it('still allows unmuting one of those, since that only adds messages', async () => {
      await expect(
        setNotificationPreference(db, identityId, UNMUTABLE_TYPES[0], 'email', false)
      ).resolves.toBeTruthy();
    });

    it('records the consent change in the audit log', async () => {
      await setNotificationPreference(db, identityId, 'stay_confirmed', 'email', true);

      const entries = await db.auditLog.findMany({ where: { actorIdentityId: identityId } });
      expect(entries.some((e) => e.action === 'account:mute_notification')).toBe(true);
    });

    it('keeps one person-s preferences out of another-s', async () => {
      const other = await createIdentity();
      await setNotificationPreference(db, identityId, 'stay_confirmed', 'email', true);

      const settings = await getNotificationSettings(db, other.id, TYPES, CHANNELS);
      expect(settings.every((s) => s.muted === false)).toBe(true);
    });
  });
});
