import { describe, expect, it } from 'vitest';
import { validateGalleryOrder, nextCover } from './gallery-policy';

describe('shared property gallery policy', () => {
  it('accepts a complete reorder and attached cover', () => {
    expect(validateGalleryOrder(['a','b'], ['b','a'], 'b')).toEqual({
      ordered: ['b','a'], cover: 'b',
    });
  });
  it('rejects foreign cover, duplicate, missing or foreign media', () => {
    expect(() => validateGalleryOrder(['a'], ['a'], 'other')).toThrow();
    expect(() => validateGalleryOrder(['a','b'], ['a','a'], 'a')).toThrow();
    expect(() => validateGalleryOrder(['a','b'], ['a'], 'a')).toThrow();
    expect(() => validateGalleryOrder(['a'], ['b'], null)).toThrow();
  });
  it('removes only the cover link and promotes remaining media', () => {
    expect(nextCover('a','a',[{mediaId:'b'}])).toBe('b');
    expect(nextCover('a','b',[{mediaId:'a'}])).toBe('a');
    expect(nextCover('a','a',[])).toBeNull();
  });
});
