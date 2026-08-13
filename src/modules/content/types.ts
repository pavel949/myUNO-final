/**
 * Content module types — i18n key model, locales, and fallback chain
 */

export type Locale = 'ru' | 'en' | 'th' | 'zh';

export const LOCALES: Locale[] = ['ru', 'en', 'th', 'zh'];
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
 * zh (Q23, answered 2026-07: full platform locale) falls back to EN first —
 * public namespaces carry zh drafts, admin/ops surfaces intentionally serve EN.
 */
export function getLocaleFallbackChain(locale?: Locale): Locale[] {
  if (!locale) return ['ru', 'en', 'th', 'zh'];
  if (locale === 'ru') return ['ru', 'en', 'th', 'zh'];
  if (locale === 'en') return ['en', 'ru', 'th', 'zh'];
  if (locale === 'th') return ['th', 'en', 'ru', 'zh'];
  if (locale === 'zh') return ['zh', 'en', 'ru', 'th'];
  return ['ru', 'en', 'th', 'zh'];
}
