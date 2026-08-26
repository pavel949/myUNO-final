import { describe, it, expect } from 'vitest';
import { pickLocalizedServiceCopy } from './service.service';

describe('pickLocalizedServiceCopy', () => {
  const service = {
    title: 'Airport transfer',
    description: 'Door-to-door pickup.',
    titleRu: 'Трансфер из аэропорта',
    titleEn: 'Airport transfer (EN)',
    titleTh: null,
    descriptionRu: 'Трансфер от двери до двери.',
    descriptionEn: null,
    descriptionTh: null,
  };

  it('picks the Russian title and description for the ru locale', () => {
    expect(pickLocalizedServiceCopy(service, 'ru')).toEqual({
      title: 'Трансфер из аэропорта',
      description: 'Трансфер от двери до двери.',
    });
  });

  it('picks the English title but falls back to the base description when English is missing', () => {
    expect(pickLocalizedServiceCopy(service, 'en')).toEqual({
      title: 'Airport transfer (EN)',
      description: 'Door-to-door pickup.',
    });
  });

  it('falls back to the base title/description entirely for a language never entered', () => {
    expect(pickLocalizedServiceCopy(service, 'th')).toEqual({
      title: 'Airport transfer',
      description: 'Door-to-door pickup.',
    });
  });

  it('falls back to the base fields for a locale with no localized copy support at all', () => {
    expect(pickLocalizedServiceCopy(service, 'zh')).toEqual({
      title: 'Airport transfer',
      description: 'Door-to-door pickup.',
    });
  });

  it('falls back to the base fields when a service was only ever authored in one language', () => {
    const singleLanguage = {
      title: 'House cleaning',
      description: 'Two-hour clean.',
    };
    expect(pickLocalizedServiceCopy(singleLanguage, 'ru')).toEqual({
      title: 'House cleaning',
      description: 'Two-hour clean.',
    });
  });

  it('treats an empty-string localized field as missing, not as the value', () => {
    const withBlankRu = { ...service, titleRu: '', descriptionRu: '' };
    expect(pickLocalizedServiceCopy(withBlankRu, 'ru')).toEqual({
      title: 'Airport transfer',
      description: 'Door-to-door pickup.',
    });
  });
});
