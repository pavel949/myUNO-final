import { describe, it, expect, beforeAll } from 'vitest';
import { db, resetDb, createIdentity } from '@/test/util';
import { ensureContentKey, setTranslation, clearTranslationCache } from '@/modules/content';
import { getLabels } from './i18n';

// Board 21's closing rule: "no locale ships partially… an untranslated key
// falls back to EN and is visibly flagged, never silently English." getLabels
// is the batch UI-label loader every page calls, so this is where that rule
// either holds platform-wide or doesn't.
describe('getLabels — visible fallback flag (board 21)', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('shows the RU translation unflagged when one exists', async () => {
    clearTranslationCache();
    const author = await createIdentity();
    await ensureContentKey(db, 'test.i18n.translated', 'test', 'Test key');
    await setTranslation(db, 'test.i18n.translated', 'ru', 'Сохранить', 'ok', author.id);
    await setTranslation(db, 'test.i18n.translated', 'en', 'Save', 'ok', author.id);

    const labels = await getLabels({ 'test.i18n.translated': 'Save (draft)' }, 'ru');
    expect(labels['test.i18n.translated']).toBe('Сохранить');
  });

  it('flags a RU visitor served the EN row because RU is missing', async () => {
    clearTranslationCache();
    const author = await createIdentity();
    await ensureContentKey(db, 'test.i18n.en_only', 'test', 'Test key');
    await setTranslation(db, 'test.i18n.en_only', 'en', 'Save', 'ok', author.id);

    const labels = await getLabels({ 'test.i18n.en_only': 'Save (draft)' }, 'ru');
    expect(labels['test.i18n.en_only']).toBe('Save · EN');
  });

  it('flags a RU visitor served the caller-supplied EN draft when no row exists at all', async () => {
    clearTranslationCache();
    const labels = await getLabels({ 'test.i18n.never_seeded': 'Untranslated draft copy' }, 'ru');
    expect(labels['test.i18n.never_seeded']).toBe('Untranslated draft copy · EN');
  });

  it('never flags an EN visitor — English seeing English is not a fallback', async () => {
    clearTranslationCache();
    const labels = await getLabels({ 'test.i18n.never_seeded': 'Untranslated draft copy' }, 'en');
    expect(labels['test.i18n.never_seeded']).toBe('Untranslated draft copy');
  });

  it('flags a TH visitor served RU content (a real translation, but not theirs)', async () => {
    clearTranslationCache();
    const author = await createIdentity();
    await ensureContentKey(db, 'test.i18n.ru_only', 'test', 'Test key');
    await setTranslation(db, 'test.i18n.ru_only', 'ru', 'Только русский', 'ok', author.id);

    const labels = await getLabels({ 'test.i18n.ru_only': 'English draft' }, 'th');
    expect(labels['test.i18n.ru_only']).toBe('Только русский · RU');
  });
});
