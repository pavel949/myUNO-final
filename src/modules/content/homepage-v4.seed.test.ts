import { describe, expect, it } from 'vitest';
import { HOMEPAGE_V4_KEYS } from './homepage-v4.seed';

describe('homepage v4 localization coverage', () => {
  it('ships complete EN/RU/TH/ZH copy for every homepage key', () => {
    const missing = HOMEPAGE_V4_KEYS.flatMap((entry) =>
      (['en', 'ru', 'th', 'zh'] as const)
        .filter((locale) => !entry[locale]?.trim())
        .map((locale) => entry.key + ':' + locale)
    );
    expect(missing).toEqual([]);
  });

  it('keeps Simplified Chinese as the current zh contract', () => {
    const hero = HOMEPAGE_V4_KEYS.find((entry) => entry.key === 'landing.hp.hero.title');
    expect(hero?.zh).toContain('普吉岛');
  });
});
