import { prisma } from '@/lib/prisma';
import { t } from '@/modules/content';
import type { Locale } from '@/modules/content';

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
  locale: Locale = 'en'
): Promise<Record<K, string>> {
  const labels = {} as Record<K, string>;
  await Promise.all(
    (Object.keys(keys) as K[]).map(async (key) => {
      try {
        const value = await t(prisma, key, undefined, locale);
        // t() echoes the key (dev) or '—' (prod) when missing — use the draft instead
        labels[key] = value && value !== key && value !== '—' ? value : keys[key];
      } catch {
        labels[key] = keys[key];
      }
    })
  );
  return labels;
}
