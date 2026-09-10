import 'server-only';

import { cookies } from 'next/headers';
import type { Locale } from '@/modules/content';
import {
  DEFAULT_UI_LOCALE,
  SUPPORTED_LOCALES,
  getLabelsForLocale,
} from '@/lib/i18n';

/**
 * Request-bound locale resolution for App Router server code only.
 * Keep next/headers isolated in this module so shared/static/error bundles can
 * safely import the pure i18n helpers from ./i18n.
 */
export function getRequestLocale(): Locale {
  try {
    const value = cookies().get('locale')?.value as Locale | undefined;
    return value && SUPPORTED_LOCALES.includes(value) ? value : DEFAULT_UI_LOCALE;
  } catch {
    return DEFAULT_UI_LOCALE;
  }
}

/** Resolve editable labels using the request locale unless one is explicit. */
export async function getLabels<K extends string>(
  keys: Record<K, string>,
  locale?: Locale
): Promise<Record<K, string>> {
  return getLabelsForLocale(keys, locale ?? getRequestLocale());
}
