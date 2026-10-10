import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { tMany } from '@/modules/content';
import type { Locale } from '@/modules/content';

const SUPPORTED_LOCALES: Locale[] = ['ru', 'en', 'th', 'zh'];

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
 * Bounded static UI surfaces can supply the same registered locale drafts:
 * selected-locale CMS copy wins, then that locale's draft, then the usual
 * cross-locale fallback. This never changes review status or edits CMS rows.
 */
export async function getLabels<K extends string>(
  keys: Record<K, string>,
  locale?: Locale,
  localeDrafts?: Partial<Record<K, Partial<Record<Locale, string>>>>
): Promise<Record<K, string>> {
  const resolvedLocale = locale || getRequestLocale();
  const keyList = Object.keys(keys) as K[];
  const labels = {} as Record<K, string>;
  const requestedLocaleFallbacks = Object.fromEntries(keyList.flatMap(key => {
    const draft = localeDrafts?.[key]?.[resolvedLocale];
    return draft ? [[key, draft]] : [];
  }));

  let resolved: Record<string, string | null> = {};
  try {
    // One query for the whole batch (see content.service.tMany). Previously
    // this fired a query per key, so a page's labels alone cost ~120 round
    // trips before anything rendered.
    resolved = await tMany(prisma, keyList, resolvedLocale, { requestedLocaleFallbacks });
  } catch {
    // DB unreachable — use the registered locale draft, or the usual EN fallback.
  }

  for (const key of keyList) {
    const value = resolved[key];
    labels[key] = value && value !== key && value !== '\u2014'
      ? value : requestedLocaleFallbacks[key] || keys[key];
  }

  return labels;
}
