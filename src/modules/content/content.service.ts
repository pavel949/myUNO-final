import { PrismaClient } from '@prisma/client';
import {
  Locale,
  DEFAULT_LOCALE,
  getLocaleFallbackChain,
  TranslationParams,
} from './types';

const CACHE_TTL_SECONDS = 60;

interface CacheEntry {
  // `null` is a *known miss*: this key genuinely has no row for this locale.
  // Caching the miss is what stops a missing key from re-walking the whole
  // fallback chain against the DB on every single request.
  value: string | null;
  expiresAt: number;
}

class TranslationCache {
  private cache = new Map<string, CacheEntry>();

  /** `undefined` = not cached; `null` = cached miss; string = cached hit. */
  get(key: string): string | null | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: string | null): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000,
    });
  }

  invalidatePrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

const cache = new TranslationCache();

function getCacheKey(contentKey: string, locale: Locale): string {
  return `${contentKey}:${locale}`;
}

/**
 * Format ICU-style placeholders in a translation string
 * Simple implementation supporting {var} syntax
 */
function formatPlaceholders(template: string, params?: TranslationParams): string {
  if (!params || Object.keys(params).length === 0) return template;

  let result = template;
  for (const [key, value] of Object.entries(params)) {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    let formatted = String(value);

    // Format dates per locale
    if (value instanceof Date) {
      formatted = value.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }

    result = result.replace(regex, formatted);
  }

  return result;
}

/**
 * Resolve many content keys in ONE query.
 *
 * The per-key `t()` cost one `findFirst` per key *per locale in the fallback
 * chain*. A single admin page asks for ~120 keys across the root layout, the
 * admin shell and the page itself — 120+ serialized round trips before a byte
 * of HTML, which is what made navigation feel dead. This resolves the whole
 * batch against the DB once and fills the cache for every locale in the chain,
 * hits and misses alike.
 *
 * Returns the resolved string per key, or `null` when the key has no value in
 * any locale of the chain. Callers decide what to render for `null`.
 */
export async function tMany(
  db: PrismaClient,
  keys: string[],
  locale: Locale = DEFAULT_LOCALE
): Promise<Record<string, string | null>> {
  const chain = getLocaleFallbackChain(locale);
  const resolved: Record<string, string | null> = {};
  const needsDb: string[] = [];

  for (const key of new Set(keys)) {
    // Walk the chain in order. A cached hit wins immediately; a cached miss
    // moves to the next locale; anything unknown sends the key to the DB.
    // Stopping at the first unknown preserves `t()`'s ordering guarantee —
    // a warm fallback-locale entry must never shadow a requested-locale row
    // we have not looked for yet.
    let decided = false;
    for (const tryLocale of chain) {
      const cached = cache.get(getCacheKey(key, tryLocale));
      if (cached === undefined) break;
      if (cached !== null) {
        resolved[key] = cached;
        decided = true;
        break;
      }
    }
    if (decided) continue;

    if (chain.every((l) => cache.get(getCacheKey(key, l)) === null)) {
      resolved[key] = null; // every locale is a known miss
    } else {
      needsDb.push(key);
    }
  }

  if (needsDb.length > 0) {
    // One join, one round trip. Prisma's relation filter
    // (`contentKey: { key: { in } }` with a nested select) issues two queries —
    // it resolves the relation separately — and this is the hottest read in the
    // app, so the join is worth expressing directly. Both parameters are bound,
    // never interpolated.
    const rows = await db.$queryRaw<Array<{ key: string; locale: string; value: string }>>`
      SELECT ck.key AS key, tr.locale AS locale, tr.value AS value
      FROM translation tr
      JOIN content_key ck ON ck.id = tr.content_key_id
      WHERE ck.key = ANY(${needsDb}) AND tr.locale = ANY(${chain})
    `;

    const byKey = new Map<string, Map<string, string>>();
    for (const row of rows) {
      if (!row.value) continue;
      let perLocale = byKey.get(row.key);
      if (!perLocale) {
        perLocale = new Map();
        byKey.set(row.key, perLocale);
      }
      perLocale.set(row.locale, row.value);
    }

    for (const key of needsDb) {
      const perLocale = byKey.get(key);
      let value: string | null = null;
      for (const tryLocale of chain) {
        const found = perLocale?.get(tryLocale);
        // Cache every locale in the chain — the hit and, just as importantly,
        // each miss above it.
        cache.set(getCacheKey(key, tryLocale), found ?? null);
        if (found && value === null) value = found;
      }
      resolved[key] = value;
    }
  }

  return resolved;
}

// One warning per missing key per process. The old code logged on every
// request for every missing key; in a serverless runtime that is a synchronous
// write per key per render, which is itself a measurable share of the latency.
const warnedMissing = new Set<string>();

/**
 * Get a translation with fallback chain: requested locale → en → ru → key name
 */
export async function t(
  db: PrismaClient,
  key: string,
  params?: TranslationParams,
  locale: Locale = DEFAULT_LOCALE
): Promise<string> {
  const value = (await tMany(db, [key], locale))[key];

  if (value === null || value === undefined) {
    if (!warnedMissing.has(key)) {
      warnedMissing.add(key);
      console.warn(`[i18n] Missing translation for key: ${key} (locale: ${locale})`);
    }
    const isDev = process.env.NODE_ENV !== 'production';
    return isDev ? key : '—';
  }

  return formatPlaceholders(value, params);
}

/**
 * Set a translation and invalidate cache
 */
export async function setTranslation(
  db: PrismaClient,
  contentKey: string,
  locale: Locale,
  value: string,
  status: 'ok' | 'needs_review' | 'missing',
  changedByIdentityId: string
): Promise<void> {
  // Translation.contentKeyId is a FK to ContentKey.id (uuid), not the human key.
  // Resolve it so the row satisfies the FK constraint.
  const keyRow = await db.contentKey.findUnique({
    where: { key: contentKey },
    select: { id: true },
  });
  if (!keyRow) {
    throw new Error(`Content key "${contentKey}" not found — call ensureContentKey first`);
  }

  await db.translation.upsert({
    where: {
      contentKeyId_locale: {
        contentKeyId: keyRow.id,
        locale,
      },
    },
    create: {
      contentKeyId: keyRow.id,
      locale,
      value,
      status,
      updatedByIdentityId: changedByIdentityId,
    },
    update: {
      value,
      status,
      updatedByIdentityId: changedByIdentityId,
    },
  });

  cache.invalidatePrefix(contentKey);
}

/**
 * Ensure a content key exists (used during seeding)
 */
export async function ensureContentKey(
  db: PrismaClient,
  key: string,
  namespace: string,
  description: string,
  supportsRich: boolean = false
): Promise<void> {
  await db.contentKey.upsert({
    where: { key },
    create: { key, namespace, description, supportsRich },
    update: { description, supportsRich },
  });
}

/**
 * Clear the entire translation cache
 */
export function clearTranslationCache(): void {
  cache.clear();
  warnedMissing.clear();
}
