/**
 * A stable editorial key for the physical category, independent of its unit.
 * Imported Layantara content keeps its source UUID provenance. Every new
 * project (Legendary, Serenity, hotels, mixed blocks) uses the same convention.
 */
export function projectEditorialKey(slug: string, field: string): string {
  return `project.${slug}.editorial.${field}`;
}

export function categoryEditorialKeys(projectSlug: string, categoryId: string, categoryKey: string) {
  const sourcePrefix = 'layantara-category-';
  const root = categoryId.startsWith(sourcePrefix)
    ? `layantara.category.${categoryId.slice(sourcePrefix.length)}`
    : `project.${projectSlug}.category.${categoryKey}`;
  return { titleKey: root + '.title', descriptionKey: root + '.description' };
}
