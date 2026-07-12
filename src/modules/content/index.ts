/**
 * Content module — i18n, editable copy via the admin panel
 * Every user-facing string is a content key, edited in admin → content
 * Fallback: requested locale → en → ru → key name (dev) or dash (prod)
 */

export { t, setTranslation, ensureContentKey, clearTranslationCache } from './content.service';
export { useT } from './content.hook';
export { seedContent } from './seed';
export type { Locale, TranslationParams, ContentKeyData, TranslationValue } from './types';
export { LOCALES, DEFAULT_LOCALE, getLocaleFallbackChain } from './types';
