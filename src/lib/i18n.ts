import { prisma } from '@/lib/prisma';
import { tMany } from '@/modules/content';
import type { Locale } from '@/modules/content';

export const SUPPORTED_LOCALES: Locale[] = ['ru', 'en', 'th', 'zh'];

// RU-first: the clientele is Russian-speaking (doc 05, Q19). Request-bound
// locale resolution lives in i18n-request.ts; this shared module must stay free
// of next/headers so it is safe in static/error/legacy-compatible bundles.
export const DEFAULT_UI_LOCALE: Locale = 'ru';

/** Normalize an explicit locale without touching request-only Next.js APIs. */
export function normalizeLocale(value?: string | null): Locale {
  return value && SUPPORTED_LOCALES.includes(value as Locale)
    ? (value as Locale)
    : DEFAULT_UI_LOCALE;
}

/**
 * Pure/shared locale fallback. Request-aware server code should import
 * getRequestLocale from '@/lib/i18n-request'. Keeping this function here avoids
 * breaking non-request consumers while making the dependency boundary explicit.
 */
export function getRequestLocale(): Locale {
  return DEFAULT_UI_LOCALE;
}

/**
 * Resolve a batch of content keys for an explicit locale.
 *
 * Each entry maps a content key to its EN draft fallback. The DB value wins
 * when present; the fallback keeps the page legible when the key is not yet
 * translated or the DB is unreachable.
 */
export async function getLabelsForLocale<K extends string>(
  keys: Record<K, string>,
  locale: Locale = DEFAULT_UI_LOCALE
): Promise<Record<K, string>> {
  const keyList = Object.keys(keys) as K[];
  const labels = {} as Record<K, string>;

  let resolved: Record<string, string | null> = {};
  try {
    resolved = await tMany(prisma, keyList, locale);
  } catch {
    // DB unreachable — every key falls through to its draft below.
  }

  for (const key of keyList) {
    const value = resolved[key];
    labels[key] = value && value !== key && value !== '\u2014' ? value : keys[key];
  }

  return labels;
}

/**
 * Backward-compatible shared resolver. It intentionally has no request-cookie
 * dependency. App Router server pages that need the visitor cookie locale use
 * getLabels from '@/lib/i18n-request'.
 */
export async function getLabels<K extends string>(
  keys: Record<K, string>,
  locale?: Locale
): Promise<Record<K, string>> {
  return getLabelsForLocale(keys, locale ?? DEFAULT_UI_LOCALE);
}
