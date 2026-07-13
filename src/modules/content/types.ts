/**
 * Content module types — i18n key model, locales, and fallback chain
 */

export type Locale = 'ru' | 'en' | 'th';

export const LOCALES: Locale[] = ['ru', 'en', 'th'];
export const DEFAULT_LOCALE: Locale = 'ru';

export interface TranslationValue {
  value: string;
  status: 'ok' | 'needs_review' | 'missing';
  locale: Locale;
}

export interface ContentKeyData {
  key: string;
  namespace: string;
  description: string;
  supportsRich: boolean;
  translations: Record<Locale, TranslationValue>;
}

export interface TranslationParams {
  [key: string]: string | number | boolean | Date;
}

/**
 * Fallback chain for locale resolution: requested → en → ru → key name
 * In production, missing translations show a dash; in dev/staging, show the key.
 */
export function getLocaleFallbackChain(locale?: Locale): Locale[] {
  if (!locale) return ['ru', 'en', 'th'];
  if (locale === 'ru') return ['ru', 'en', 'th'];
  if (locale === 'en') return ['en', 'ru', 'th'];
  if (locale === 'th') return ['th', 'en', 'ru'];
  return ['ru', 'en', 'th'];
}
