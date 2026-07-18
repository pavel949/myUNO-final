import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { t } from '@/modules/content';
import type { Locale } from '@/modules/content';

const SUPPORTED_LOCALES: Locale[] = ['ru', 'en', 'th'];

// RU-first: the clientele is Russian-speaking (doc 05, Q19). Default to RU when
// the visitor hasn't chosen a locale; the navbar switcher sets the cookie.
const DEFAULT_UI_LOCALE: Locale = 'ru';

/** The request's UI locale: `locale` cookie (set by the navbar switcher), default RU. */
export function getRequestLocale(): Locale {
  try {
    const value = cookies().get('locale')?.value as Locale | undefined;
    return value && SUPPORTED_LOCALES.includes(value) ? value : DEFAULT_UI_LOCALE;
  } catch {
    return DEFAULT_UI_LOCALE;
  }
}

/**
 * Resolve a batch of content keys server-side.
 *
 * Each entry maps a content key to its EN draft fallback. The DB value wins
 * when present (admin-edited copy, any locale); the fallback keeps the page
 * legible when the key is not yet translated or the DB is unreachable.
 * New keys used here must also be added to the content seed as
 * `needs_review` drafts (doc 05 §1).
 */
export async function getLabels<K extends string>(
  keys: Record<K, string>,
  locale?: Locale
): Promise<Record<K, string>> {
  const resolvedLocale = locale || getRequestLocale();
  const labels = {} as Record<K, string>;
  await Promise.all(
    (Object.keys(keys) as K[]).map(async (key) => {
      try {
        const value = await t(prisma, key, undefined, resolvedLocale);
        // t() echoes the key (dev) or '—' (prod) when missing — use the draft instead
        labels[key] = value && value !== key && value !== '—' ? value : keys[key];
      } catch {
        labels[key] = keys[key];
      }
    })
  );
  return labels;
}
