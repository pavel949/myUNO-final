import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db, resetDb, createIdentity } from '@/test/util';
import { t, setTranslation, ensureContentKey, clearTranslationCache } from './content.service';
import { seedContent } from './seed';
import { DEFAULT_LOCALE } from './types';

// Translations are FK-linked to ContentKey.id and authored by a real identity.
// A helper to resolve a content key's uuid for direct table assertions.
async function keyId(key: string): Promise<string> {
  const row = await db.contentKey.findUnique({ where: { key }, select: { id: true } });
  if (!row) throw new Error(`content key ${key} not seeded`);
  return row.id;
}

describe('T-004 · Content module', () => {
  let authorId: string;

  beforeAll(async () => {
    await resetDb();
    await seedContent(db);
    // A real identity to author test translations (updatedByIdentityId is a FK).
    authorId = (await createIdentity()).id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  describe('fallback chain: requested → en → ru → key name', () => {
    it('returns value in requested locale when available', async () => {
      clearTranslationCache();
      const result = await t(db, 'common.action.save', {}, 'ru');
      expect(result).toBe('Сохранить');
    });

    it('falls back to en when requested locale missing', async () => {
      clearTranslationCache();
      // Delete TH translation (keyed by the ContentKey uuid, not the human key)
      await db.translation.delete({
        where: {
          contentKeyId_locale: {
            contentKeyId: await keyId('common.action.save'),
            locale: 'th',
          },
        },
      });

      const result = await t(db, 'common.action.save', {}, 'th');
      expect(result).toBe('Save'); // Falls back to EN
    });

    it('falls back to ru when en also missing', async () => {
      clearTranslationCache();
      // Create a key with only RU translation
      await ensureContentKey(db, 'test.fallback.only_ru', 'test', 'Test key');
      await setTranslation(
        db,
        'test.fallback.only_ru',
        'ru',
        'Только русский',
        'ok',
        authorId
      );

      const result = await t(db, 'test.fallback.only_ru', {}, 'th');
      expect(result).toBe('Только русский');
    });

    it('returns key name in dev mode when all translations missing', async () => {
      clearTranslationCache();
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const result = await t(db, 'test.missing.key', {}, 'ru');
      expect(result).toBe('test.missing.key');

      process.env.NODE_ENV = originalEnv;
    });

    it('returns dash in production when all translations missing', async () => {
      clearTranslationCache();
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const result = await t(db, 'test.missing.prod', {}, 'ru');
      expect(result).toBe('—');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('placeholder formatting', () => {
    it('formats simple {var} placeholders', async () => {
      clearTranslationCache();
      // Create a key with placeholders
      await ensureContentKey(db, 'test.placeholder.simple', 'test', 'Test placeholder');
      await setTranslation(
        db,
        'test.placeholder.simple',
        'en',
        'Hello {name}, you have {count} messages',
        'ok',
        authorId
      );

      const result = await t(db, 'test.placeholder.simple', {
        name: 'Alice',
        count: 5,
      });
      expect(result).toBe('Hello Alice, you have 5 messages');
    });

    it('handles multiple occurrences of same placeholder', async () => {
      clearTranslationCache();
      await ensureContentKey(db, 'test.placeholder.repeat', 'test', 'Test repeat');
      await setTranslation(
        db,
        'test.placeholder.repeat',
        'en',
        '{user} confirmed {user}',
        'ok',
        authorId
      );

      const result = await t(db, 'test.placeholder.repeat', { user: 'Bob' });
      expect(result).toBe('Bob confirmed Bob');
    });

    it('returns template unchanged when no params provided', async () => {
      clearTranslationCache();
      await ensureContentKey(db, 'test.placeholder.none', 'test', 'Test no params');
      await setTranslation(
        db,
        'test.placeholder.none',
        'en',
        'No placeholders here',
        'ok',
        authorId
      );

      const result = await t(db, 'test.placeholder.none');
      expect(result).toBe('No placeholders here');
    });
  });

  describe('cache behavior', () => {
    it('returns cached value without re-querying database', async () => {
      clearTranslationCache();
      const value1 = await t(db, 'common.action.cancel', {}, 'en');
      const value2 = await t(db, 'common.action.cancel', {}, 'en');

      expect(value1).toBe(value2);
      expect(value1).toBe('Cancel');
    });

    it('invalidates cache when translation is updated', async () => {
      clearTranslationCache();
      const key = 'test.cache.invalidate';
      await ensureContentKey(db, key, 'test', 'Test cache');
      await setTranslation(db, key, 'en', 'Original', 'ok', authorId);

      const value1 = await t(db, key, {}, 'en');
      expect(value1).toBe('Original');

      // Update translation
      await setTranslation(db, key, 'en', 'Updated', 'ok', authorId);

      const value2 = await t(db, key, {}, 'en');
      expect(value2).toBe('Updated');
    });
  });

  describe('content key creation', () => {
    it('seeds all common.* keys', async () => {
      const keys = await db.contentKey.findMany({
        where: { namespace: 'common' },
      });

      expect(keys.length).toBeGreaterThan(20);
      expect(keys.some((k) => k.key === 'common.action.save')).toBe(true);
      expect(keys.some((k) => k.key === 'common.status.booking.confirmed')).toBe(true);
    });

    it('creates translations for all locales', async () => {
      // Use a key not mutated by the fallback-chain tests above (which delete
      // the TH row of common.action.save to exercise the fallback).
      const translations = await db.translation.findMany({
        where: { contentKey: { key: 'common.action.cancel' } },
      });

      expect(translations).toHaveLength(3);
      expect(translations.map((t) => t.locale).sort()).toEqual(['en', 'ru', 'th']);
      expect(translations.every((t) => t.status === 'ok')).toBe(true);
    });

    it('ensures key is idempotent when re-seeded', async () => {
      const countBefore = await db.contentKey.count({
        where: { namespace: 'common' },
      });

      await seedContent(db);

      const countAfter = await db.contentKey.count({
        where: { namespace: 'common' },
      });

      expect(countBefore).toBe(countAfter);
    });
  });

  describe('translation updates', () => {
    it('updates existing translation', async () => {
      const key = 'test.update.existing';
      const identity = await createIdentity();

      await ensureContentKey(db, key, 'test', 'Test update');
      await setTranslation(db, key, 'en', 'Version 1', 'ok', identity.id);

      let result = await t(db, key, {}, 'en');
      expect(result).toBe('Version 1');

      clearTranslationCache();
      await setTranslation(db, key, 'en', 'Version 2', 'ok', identity.id);

      result = await t(db, key, {}, 'en');
      expect(result).toBe('Version 2');
    });

    it('tracks updated_by_identity_id', async () => {
      const key = 'test.audit.identity';
      const identity = await createIdentity();

      await ensureContentKey(db, key, 'test', 'Test audit');
      await setTranslation(db, key, 'en', 'Tracked', 'ok', identity.id);

      const translation = await db.translation.findUnique({
        where: {
          contentKeyId_locale: {
            contentKeyId: await keyId(key),
            locale: 'en',
          },
        },
      });

      expect(translation?.updatedByIdentityId).toBe(identity.id);
    });
  });
});
