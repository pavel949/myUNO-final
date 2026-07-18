import { PrismaClient } from '@prisma/client';
import {
  Locale,
  DEFAULT_LOCALE,
  getLocaleFallbackChain,
  TranslationParams,
} from './types';

const CACHE_TTL_SECONDS = 60;

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

  // Try cache for each fallback locale
  for (const tryLocale of fallbackChain) {
    const cacheKey = getCacheKey(key, tryLocale);
    const cached = cache.get(cacheKey);
    if (cached) return formatPlaceholders(cached, params);
  }

  // Try database for each fallback locale. Translations are keyed by the
  // ContentKey's uuid id (FK), so match through the relation on the human key.
  for (const tryLocale of fallbackChain) {
    const translation = await db.translation.findFirst({
      where: {
        locale: tryLocale,
        contentKey: { key },
      },
    });

    if (translation && translation.value) {
      cache.set(getCacheKey(key, tryLocale), translation.value);
      return formatPlaceholders(translation.value, params);
    }
  }

  // Missing translation: log warning and return fallback
  console.warn(`[i18n] Missing translation for key: ${key} (locale: ${locale})`);
  const isDev = process.env.NODE_ENV !== 'production';
  return isDev ? key : '—';
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
}
