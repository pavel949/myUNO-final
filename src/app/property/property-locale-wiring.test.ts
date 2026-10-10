import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const read = (path: string) => readFileSync(path, 'utf8');
describe('static locale wiring preserves scoped workflows', () => {
  it('uses locale-specific drafts on the three reported pages', () => {
    expect(read('src/app/(public)/projects/[slug]/page.tsx')).toContain('getRequestLocale(), PROPERTY_PUBLIC_UI_DRAFTS');
    expect(read('src/app/property/onboard/page.tsx')).toContain('locale, PROPERTY_ONBOARDING_LOCALE_DRAFTS');
    expect(read('src/app/property/listings/page.tsx')).toContain('locale, PROPERTY_LISTINGS_LOCALE_DRAFTS');
  });
  it('preserves listing authority checks, login redirect and original stored titles', () => {
    const listing = read('src/app/property/listings/page.tsx');
    expect(listing).toContain('hasSelfListingAccess(user.identityId, unit.id)');
    expect(listing).toContain('hasManagedUnitMcAccess(user, { projectId: unit.projectId, unitId: unit.id })');
    expect(listing).toContain('/login?next=%2Fproperty%2Flistings');
    expect(listing).toContain('{draft.title}'); expect(listing).toContain('{unit.name}');
    expect(read('src/app/property/onboard/wizard.tsx')).toContain('body: JSON.stringify(saved ? { ...body, id: saved.id } : body)');
  });
});
