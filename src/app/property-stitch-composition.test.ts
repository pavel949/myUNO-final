import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(path, 'utf8');

describe('property funnel composition contracts (not rendered visual acceptance)', () => {
  it('keeps one project-scoped mosaic before availability and preserves narrative', () => {
    const page = source('src/app/(public)/projects/[slug]/page.tsx');
    expect(page).toContain('project.coverUrl, ...project.galleryUrls');
    expect(page.match(/<UnitPhotoMosaic/g)).toHaveLength(1);
    expect(page).not.toContain('md:min-h-[440px]');
    expect(page.indexOf('<UnitPhotoMosaic')).toBeLessThan(page.indexOf('id="availability"'));
    expect(page.indexOf('id="availability"')).toBeLessThan(page.indexOf('<ProjectEditorialSections'));
    for (const component of ['ProjectEditorialSections', 'ProjectAmenitiesSection', 'ProjectNearbySection', 'ProjectServiceMarketplace', 'LeadFormSection']) {
      expect(page).toContain(`<${component}`);
    }
    expect(page).toContain('bookableStayCount > 0 &&');
    expect(page).toContain('projectId={project.id}');
  });

  it('uses the existing heading primitive throughout search, project, unit and review', () => {
    for (const path of ['src/app/search/search-results.tsx', 'src/app/(public)/projects/[slug]/page.tsx', 'src/app/units/[id]/unit-client.tsx', 'src/app/units/[id]/page.tsx', 'src/app/book/review/review-client.tsx']) {
      expect(source(path)).toContain('<PageHeading');
    }
  });
});
