import { CONSOLIDATED_RELEASE_KEYS } from './consolidated-release.seed';
import { PROJECT_RESTYLE_KEYS } from './project-restyle.seed';

/** Existing registered UI keys only. CMS copy in the requested locale still wins. */
export const PROPERTY_CATEGORY_UI_DRAFTS = Object.fromEntries([
  ...CONSOLIDATED_RELEASE_KEYS.filter(row => row.key.startsWith('project_category.')),
  ...PROJECT_RESTYLE_KEYS.filter(row => row.key.startsWith('project_category.')),
  // Registered in seed.ts; retained here to avoid importing the database seeder at runtime.
  {
    key: 'project_category.representative_media',
    en: 'Representative room-type photos',
    ru: 'Представительные фото типа номера',
    th: 'รูปตัวอย่างประเภทห้อง',
  },
].map(row => [row.key, {
  en: row.en,
  ru: row.ru,
  ...('th' in row && typeof row.th === 'string' ? { th: row.th } : {}),
}]));
