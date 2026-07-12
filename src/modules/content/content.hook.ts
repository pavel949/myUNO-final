'use client';

import { useCallback, useState } from 'react';
import { Locale, DEFAULT_LOCALE, TranslationParams } from './types';

/**
 * Client-side hook for translating content keys
 * Fetches translations server-side via API
 */
export function useT() {
  const [cache, setCache] = useState<Record<string, string>>({});
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);

  const t = useCallback(
    async (key: string, params?: TranslationParams): Promise<string> => {
      const cacheKey = `${key}:${locale}`;

      // Return from cache if available
      if (cache[cacheKey]) {
        return formatPlaceholders(cache[cacheKey], params);
      }

      try {
        const response = await fetch('/api/content/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, locale }),
        });

        if (!response.ok) {
          console.warn(`[i18n] Failed to fetch translation for key: ${key}`);
          return process.env.NODE_ENV !== 'production' ? key : '—';
        }

        const { value } = await response.json();

        // Cache the result
        setCache((prev) => ({
          ...prev,
          [cacheKey]: value,
        }));

        return formatPlaceholders(value, params);
      } catch (error) {
        console.error(`[i18n] Error fetching translation for key: ${key}`, error);
        return process.env.NODE_ENV !== 'production' ? key : '—';
      }
    },
    [locale, cache]
  );

  return { t, locale, setLocale };
}

/**
 * Format placeholders in a translation string (client-side)
 */
function formatPlaceholders(template: string, params?: TranslationParams): string {
  if (!params || Object.keys(params).length === 0) return template;

  let result = template;
  for (const [key, value] of Object.entries(params)) {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    result = result.replace(regex, String(value));
  }

  return result;
}
