import { PrismaClient } from '@prisma/client';
import {
  Locale,
  DEFAULT_LOCALE,
  getLocaleFallbackChain,
  TranslationParams,
} from './types';

const CACHE_TTL_SECONDS = 300; // 5 minutes cache TTL

interface CacheEntry {
  value: any;
  expiresAt: number;
}

class TranslationCache {
  private cache = new Map<string, CacheEntry>();

  get(key: string): string | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: string): void {
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
 * Get a translation with fallback chain: requested locale → en → ru → key name
 */
export async function t(
  db: PrismaClient,
  key: string,
  params?: TranslationParams,
  locale: Locale = DEFAULT_LOCALE
): Promise<string> {
  const fallbackChain = getLocaleFallbackChain(locale);

  for (const tryLocale of fallbackChain) {
    const cacheKey = getCacheKey(key, tryLocale);
    const cached = cache.get(cacheKey);
    if (cached) return formatPlaceholders(cached, params);

    const translation = await db.translation.findFirst({
      where: {
        locale: tryLocale,
        contentKey: { key },
      },
    });

    if (translation && translation.value) {
      cache.set(cacheKey, translation.value);
      return formatPlaceholders(translation.value, params);
    }
  }

  const isDev = process.env.NODE_ENV !== 'production';
  return isDev ? key : '—';
}

/**
 * High-performance batch translation resolver.
 * Fetches all requested keys in 1 single DB query instead of N individual queries.
 */
export async function getBatchTranslations<K extends string>(
  db: PrismaClient,
  keysMap: Record<K, string>,
  locale: Locale = DEFAULT_LOCALE
): Promise<Record<K, string>> {
  const keys = Object.keys(keysMap) as K[];
  const fallbackChain = getLocaleFallbackChain(locale);
  const result = {} as Record<K, string>;

  const missingKeys: K[] = [];

  // Check in-memory cache first
  for (const key of keys) {
    let resolvedValue: string | undefined;
    for (const tryLocale of fallbackChain) {
      const cached = cache.get(getCacheKey(key, tryLocale));
      if (cached) {
        resolvedValue = cached;
        break;
      }
    }
    if (resolvedValue && resolvedValue !== key && resolvedValue !== '—') {
      result[key] = resolvedValue;
    } else {
      missingKeys.push(key);
    }
  }

  if (missingKeys.length > 0) {
    try {
      const dbRows = await db.translation.findMany({
        where: {
          contentKey: { key: { in: missingKeys } },
          locale: { in: fallbackChain },
        },
        include: {
          contentKey: { select: { key: true } },
        },
      });

      // Cache all returned rows
      for (const row of dbRows) {
        if (row.contentKey?.key && row.value) {
          cache.set(getCacheKey(row.contentKey.key, row.locale as Locale), row.value);
        }
      }

      // Resolve missing keys from newly cached rows
      for (const key of missingKeys) {
        let val: string | undefined;
        for (const tryLocale of fallbackChain) {
          const cached = cache.get(getCacheKey(key, tryLocale));
          if (cached) {
            val = cached;
            break;
          }
        }
        result[key] = val && val !== key && val !== '—' ? val : keysMap[key];
      }
    } catch (err) {
      // Fallback to draft defaults on error
      for (const key of missingKeys) {
        result[key] = keysMap[key];
      }
    }
  }

  return result;
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
}
