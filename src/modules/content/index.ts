/**
 * Content module — i18n, editable copy via the admin panel
 * Every user-facing string is a content key, edited in admin → content
 * Fallback: requested locale → en → ru → key name (dev) or dash (prod)
 *
 * IMPORTANT: database seed modules are intentionally not re-exported here.
 * Runtime and client-adjacent imports of this barrel must never pull Node-only
 * seed dependencies such as node:crypto into the application bundle.
 * Seed callers import `@/modules/content/seed` directly.
 */

export { t, tMany, setTranslation, ensureContentKey, clearTranslationCache } from './content.service';
export { useT } from './content.hook';
export type { Locale, TranslationParams, ContentKeyData, TranslationValue } from './types';
export { LOCALES, DEFAULT_LOCALE, getLocaleFallbackChain } from './types';
export {
  updateTranslation,
  createContentKey,
  getContentKey,
  listContentKeys,
  listNamespaces,
  exportToCSV,
  importFromCSV,
} from './edit.service';
