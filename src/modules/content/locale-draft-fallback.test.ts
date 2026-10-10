import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { clearTranslationCache, tMany } from './content.service';

const query = vi.fn();
const db = { $queryRaw: query } as unknown as PrismaClient;
beforeEach(() => { clearTranslationCache(); query.mockReset(); });

describe('bounded requested-locale draft fallback', () => {
  it('keeps a selected-locale CMS value ahead of any draft, even when it contains Latin text', async () => {
    query.mockResolvedValue([{ key: 'nav', locale: 'ru', value: 'myUNO Property Team' }, { key: 'nav', locale: 'en', value: 'Operations' }]);
    expect(await tMany(db, ['nav'], 'ru', { requestedLocaleFallbacks: { nav: 'Управление' } }))
      .toEqual({ nav: 'myUNO Property Team' });
  });
  it('uses the selected-locale draft before a database fallback language without caching the draft', async () => {
    query.mockResolvedValue([{ key: 'nav', locale: 'en', value: 'Operations' }]);
    expect(await tMany(db, ['nav'], 'en')).toEqual({ nav: 'Operations' });
    expect(await tMany(db, ['nav'], 'ru', { requestedLocaleFallbacks: { nav: 'Управление' } })).toEqual({ nav: 'Управление' });
    expect(await tMany(db, ['nav'], 'ru')).toEqual({ nav: 'Operations' });
    expect(await tMany(db, ['nav'], 'en')).toEqual({ nav: 'Operations' });
    expect(query).toHaveBeenCalledTimes(1);
  });
  it('handles a cold cache in one batch and keeps normal fallback for keys without a locale draft', async () => {
    query.mockResolvedValue([{ key: 'nav', locale: 'en', value: 'Operations' }, { key: 'legal', locale: 'en', value: 'Reviewed legal text' }]);
    expect(await tMany(db, ['nav', 'legal'], 'ru', { requestedLocaleFallbacks: { nav: 'Управление' } }))
      .toEqual({ nav: 'Управление', legal: 'Reviewed legal text' });
    expect(query).toHaveBeenCalledTimes(1);
  });
  it('keeps known misses cacheable but allows a supplied draft on a later call', async () => {
    query.mockResolvedValue([]);
    expect(await tMany(db, ['nav'], 'ru')).toEqual({ nav: null });
    expect(await tMany(db, ['nav'], 'ru', { requestedLocaleFallbacks: { nav: 'Управление' } })).toEqual({ nav: 'Управление' });
    expect(await tMany(db, ['nav'], 'ru')).toEqual({ nav: null });
    expect(query).toHaveBeenCalledTimes(1);
  });
});
