import { prisma } from '@/lib/prisma';
import { tMany } from '@/modules/content';
import type { Locale } from '@/modules/content';

/**
 * Static-safe label resolver for compatibility/error surfaces that must not
 * import request-bound Next.js APIs such as `next/headers`.
 */
export async function getStaticLabels<K extends string>(
  keys: Record<K, string>,
  locale: Locale = 'ru'
): Promise<Record<K, string>> {
  const keyList = Object.keys(keys) as K[];
  const labels = {} as Record<K, string>;

  let resolved: Record<string, string | null> = {};
  try {
    resolved = await tMany(prisma, keyList, locale);
  } catch {
    // If DB/content is unavailable, fall back to the supplied draft strings.
  }

  for (const key of keyList) {
    const value = resolved[key];
    labels[key] = value && value !== key && value !== '\u2014' ? value : keys[key];
  }

  return labels;
}
