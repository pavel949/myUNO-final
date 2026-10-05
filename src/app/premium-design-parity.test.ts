import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('premium design-system surface parity', () => {
  it('keeps the canonical premium interface primitives available', () => {
    const primitives = source('src/components/premium/PremiumPrimitives.tsx');
    for (const name of [
      'RecordPageHeader',
      'ProcessStepper',
      'StatusChip',
      'KpiTile',
      'MoneyLine',
      'SourceChip',
      'StandardFilterBar',
      'InboxItem',
      'CtaBar',
      'EmptyState',
    ]) {
      expect(primitives).toContain(`function ${name}`);
    }
  });

  it('exposes the benchmark-aligned public discovery surfaces', () => {
    const navbar = source('src/components/Navbar.tsx');
    const footer = source('src/components/Footer.tsx');
    for (const route of ['/search', '/homes?intent=rent', '/homes?intent=buy', '/sell', '/projects', '/services']) {
      expect(navbar).toContain(route);
    }
    expect(navbar).toContain('/areas');
    expect(footer).toContain('/areas');
    expect(source('src/app/areas/page.tsx')).toContain('listBrowsableAreas(prisma)');
    expect(source('src/app/areas/[slug]/page.tsx')).toContain('getAreaForBrowse(prisma');
    expect(source('src/app/(public)/help/page.tsx')).toContain("'/tickets'");
    expect(source('src/app/(public)/projects/[slug]/passport/page.tsx')).toContain('getPublicProjectPassport(prisma');
  });

  it('keeps the homepage conversion sequence grounded in canonical data', () => {
    const home = source('src/app/(public)/page.tsx');
    expect(home).toContain('listPublicProjects()');
    expect(home).toContain('listPublicCommercialHomes(prisma)');
    expect(home).toContain('listPublicMarketplaceServices(prisma, locale');
    expect(home).toContain("landing.start.title");
    expect(home).toContain("href: '/sell'");
    expect(home).not.toContain('bg-white');
  });

  it('keeps list and map search on one canonical search contract', () => {
    const results = source('src/app/search/search-results.tsx');
    const route = source('src/app/api/search/units/route.ts');
    const map = source('src/components/search/SearchResultsMap.tsx');
    expect(results).toContain('swLat');
    expect(results).toContain('<SearchResultsMap');
    expect(route).toContain('parseMapBounds');
    expect(route).toContain('latitude: Number(rest.project.latitude)');
    expect(route).toContain('mapProjects');
    expect(route).toContain('mapCandidates');
    expect(map).toContain('onBoundsChange');
    expect(map).toContain('tile.openstreetmap.org');
    const middleware = source('src/middleware.ts');
    // MapLibre is bundled; no third-party script or style origin is allowed.
    expect(middleware).not.toContain('https://unpkg.com');
    expect(middleware).toContain('https://tile.openstreetmap.org');
    expect(middleware).toContain("worker-src 'self' blob:");
  });

  it('keeps Project Passport fail-closed over canonical evidence records', () => {
    const passport = source('src/modules/projects/passport.service.ts');
    expect(passport).toContain("project.status !== 'live'");
    expect(passport).toContain('regulatoryCredentials');
    expect(passport).toContain('commercialOfferings');
    expect(passport).toContain('complianceRecords');
    expect(passport).not.toContain("'pass'");
  });

  it('publishes Help and Project Passport through the sitemap', () => {
    const sitemap = source('src/app/sitemap.ts');
    expect(sitemap).toContain('${base}/help');
    expect(sitemap).toContain('/passport');
  });

  it('keeps seller intake on the shared lead pipeline rather than a second CRM', () => {
    const sell = source('src/app/(public)/sell/page.tsx');
    expect(sell).toContain("const SELL_AUDIENCE = 'owners' as const");
    expect(sell).toContain('audience={SELL_AUDIENCE}');
    expect(sell).toContain('<ProcessStepper');
    expect(sell).not.toContain('prisma.');
  });
});
