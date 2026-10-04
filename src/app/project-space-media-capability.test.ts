import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('capability-led Project Space media contract', () => {
  it('keeps project, category and exact-unit media scopes explicit', () => {
    const readiness = source('src/modules/media/public-readiness.ts');
    const project = source('src/app/(public)/projects/[slug]/page.tsx');
    const category = source('src/app/(public)/projects/[slug]/categories/[categoryKey]/page.tsx');

    expect(readiness).toContain("photoScope: 'exact_unit'");
    expect(readiness).toContain("photoScope: 'room_type'");
    expect(project).toContain('project_page.units.representative_media');
    expect(category).toContain('project_category.representative_media');
  });

  it('lets one Project Space expose only the commercial capabilities it actually has', () => {
    const project = source('src/app/(public)/projects/[slug]/page.tsx');
    expect(project).toContain('listPublicCommercialHomes(prisma)');
    expect(project).toContain('/homes?intent=buy&projectId=');
    expect(project).toContain('/homes?intent=rent&projectId=');
    expect(project).toContain('<SearchBar');
  });

  it('uses the same complete exact-unit gallery for public sale and rent detail', () => {
    const discovery = source('src/modules/projects/commercial-discovery.ts');
    const detail = source('src/app/homes/[id]/page.tsx');
    expect(discovery).toContain('assessGalleryReadiness');
    expect(discovery).toContain('images:');
    expect(detail).toContain('UnitPhotoMosaic');
  });
});
