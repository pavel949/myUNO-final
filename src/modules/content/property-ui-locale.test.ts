import { describe, expect, it } from 'vitest';
import { PROPERTY_ONBOARDING_KEYS, PROPERTY_ONBOARDING_LOCALE_DRAFTS } from './property-onboarding.seed';
import { PROPERTY_LISTINGS_KEYS } from './property-listings.seed';
import { PROPERTY_PUBLIC_UI_DRAFTS } from './property-public-ui-drafts';
const placeholders = (value: string) => value.match(/\{[a-zA-Z_]+\}/g)?.sort() || [];
describe('registered bounded property UI copy', () => {
  it('has unique EN/RU drafts and retains review status', () => {
    const rows = [...PROPERTY_ONBOARDING_KEYS, ...PROPERTY_LISTINGS_KEYS];
    expect(new Set(rows.map(row => row.key)).size).toBe(rows.length);
    for (const row of rows) { expect(row.en).toBeTruthy(); expect(row.ru).toMatch(/[А-Яа-яЁё]/); expect(row.status).toBe('needs_review'); expect(placeholders(row.ru)).toEqual(placeholders(row.en)); }
    expect(PROPERTY_ONBOARDING_LOCALE_DRAFTS['property.onboard.title'].ru).toBe('Расскажите о вашем объекте');
  });
  it('fixes observed project navigation, owner and service UI without replacing content entities', () => {
    for (const key of ['project_page.nav.homes', 'project_page.nav.services', 'project_page.nav.location', 'project_page.nav.contact', 'project_page.owner_intake.title', 'project_page.owner_intake.body', 'project_page.owner_intake.cta', 'project.services.eyebrow', 'project.services.title', 'project.services.body', 'project.services.view_all', 'project.services.from']) {
      expect(PROPERTY_PUBLIC_UI_DRAFTS[key].ru).toMatch(/[А-Яа-яЁё]/);
      expect(placeholders(PROPERTY_PUBLIC_UI_DRAFTS[key].ru)).toEqual(placeholders(PROPERTY_PUBLIC_UI_DRAFTS[key].en));
    }
  });
});
