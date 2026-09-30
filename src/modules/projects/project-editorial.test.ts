import { describe, expect, it } from 'vitest';
import { categoryEditorialKeys, projectEditorialKey } from './project-editorial';

describe('shared Project Space editorial contract', () => {
  it('preserves verified imported Layantara copy through source identity', () => {
    expect(categoryEditorialKeys('layantara-villas',
      'layantara-category-5d24a186-41c2-4fb2-8fc5-535b693c6829',
      '3BR_GRAND_DELUXE_G6_G7')).toEqual({
      titleKey: 'layantara.category.5d24a186-41c2-4fb2-8fc5-535b693c6829.title',
      descriptionKey: 'layantara.category.5d24a186-41c2-4fb2-8fc5-535b693c6829.description',
    });
  });
  it('uses one generic contract for mixed resort and condominium projects', () => {
    const legendary = categoryEditorialKeys('title-legendary', 'category-1', '1BR_POOL');
    const serenity = categoryEditorialKeys('title-serenity', 'category-2', '2BR_SEAVIEW');
    expect(legendary.descriptionKey).toBe('project.title-legendary.category.1BR_POOL.description');
    expect(serenity.titleKey).toBe('project.title-serenity.category.2BR_SEAVIEW.title');
    expect(projectEditorialKey('title-legendary', 'benefit.1.title')).toBe('project.title-legendary.editorial.benefit.1.title');
  });
});
