import { PROJECT_PORTAL_KEYS } from './project-portal.seed';
import { CONSOLIDATED_RELEASE_KEYS } from './consolidated-release.seed';

/** Existing registered static UI keys only; never project/service titles or descriptions. */
export const PROPERTY_PUBLIC_UI_KEYS = [...PROJECT_PORTAL_KEYS, ...CONSOLIDATED_RELEASE_KEYS.filter(row => row.key.startsWith('project_page.owner_intake.') || row.key.startsWith('project.services.'))];
export const PROPERTY_PUBLIC_UI_DRAFTS = Object.fromEntries(PROPERTY_PUBLIC_UI_KEYS.map(row => [row.key, { en: row.en, ru: row.ru, ...('th' in row && typeof row.th === 'string' ? { th: row.th } : {}) }]));
