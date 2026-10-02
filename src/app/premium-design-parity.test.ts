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
    for (const route of ['/homes?intent=buy', '/search', '/sell', '/rent-out', '/manage']) {
      expect(navbar).toContain(route);
    }
    expect(navbar).toContain('/homes?intent=rent');
    expect(navbar).toContain('/projects');
    expect(navbar).toContain('/services');
    expect(navbar).toContain('/areas');
    expect(footer).toContain('/areas');
    expect(navbar).toContain('/desks');
    expect(footer).toContain('/desks');
    expect(source('src/app/(public)/desks/page.tsx')).toContain('GLOBAL_DESKS');
    expect(source('src/app/(public)/desks/[slug]/page.tsx')).toContain('getGlobalDesk');
    expect(source('src/app/areas/page.tsx')).toContain('listBrowsableAreas(prisma)');
    expect(source('src/app/areas/[slug]/page.tsx')).toContain('getAreaForBrowse(prisma');
    expect(source('src/app/(public)/help/page.tsx')).toContain("'/tickets'");
    expect(source('src/app/(public)/rent-out/page.tsx')).toContain('/property/onboard?kind=home&offers=short_stay,monthly,yearly');
    expect(source('src/app/(public)/sell/page.tsx')).toContain('/property/onboard?offers=sale');
    expect(source('src/app/(public)/rent-out/page.tsx')).toContain('href="/manage"');
    expect(source('src/app/(public)/manage/page.tsx')).toContain('href="#lead-form"');
    const onboardPage = source('src/app/property/onboard/page.tsx');
    expect(onboardPage).toContain("params.set('offers'");
    expect(onboardPage).toContain("params.set('operatingModel'");
    expect(source('src/app/(public)/projects/[slug]/passport/page.tsx')).toContain('getPublicProjectPassport(prisma');
  });

  it('keeps the homepage conversion sequence grounded in canonical data', () => {
    const home = source('src/app/(public)/page.tsx');
    expect(home).toContain('getPublicHomepageData(locale)');
    const readModel = source('src/modules/home/public-homepage.service.ts');
    expect(readModel).toContain('listPublicProjects(locale)');
    expect(readModel).toContain('listPublicCommercialHomes(prisma)');
    expect(readModel).toContain('listPublicMarketplaceServices(prisma, locale');
    expect(home).not.toContain('id="start-heading"');
    const discovery = source('src/components/DiscoverySearch.tsx');
    // Consumer search is deliberately Stay / Monthly / Buy; supplier intents live beside it on the homepage.
    expect(discovery).toContain("{ id: 'stay', title: labels.stay }");
    expect(discovery).toContain("{ id: 'monthly', title: labels.monthly }");
    expect(discovery).toContain("{ id: 'buy', title: labels.buy }");
    expect(discovery).toContain("router.push('/homes?' + params.toString())");
    expect(home).toContain('href="/sell"');
    expect(home).toContain('href="/rent-out"');
    expect(home).toContain('href="/manage"');
    expect(home).toContain("landing.units.title");
    expect(home).toContain("landing.areas.title");
    expect(home).toContain('GLOBAL_DESKS.map');
    expect(home).not.toContain('bg-white');
  });

  it('keeps the homepage on the canonical typography, width and colour system', () => {
    const home = source('src/app/(public)/page.tsx');
    const search = source('src/components/DiscoverySearch.tsx');
    const footer = source('src/components/Footer.tsx');
    const globals = source('src/app/globals.css');
    const tailwind = source('tailwind.config.ts');

    expect(home).toContain('max-w-content');
    expect(home).toContain('text-display-hero');
    expect(home).toContain('md:text-display-hero-lg');
    expect(home).not.toContain('max-w-7xl');
    expect(home).not.toContain('text-[clamp(');
    expect(home).not.toMatch(/\/(?:15|18|62|68|88)(?=[\"'\s])/);
    expect(search).not.toContain('bg-white');
    expect(footer).toContain('bg-brand-deep');
    expect(footer).not.toContain('bg-text-ink');
    expect(globals).toContain("html[lang='ru']");
    expect(globals).toContain("html[lang='th']");
    expect(tailwind).toContain("'var(--font-display-active)'");
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
    expect(middleware).toContain('https://unpkg.com');
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
    expect(sitemap).toContain('${base}/desks');
    expect(sitemap).toContain('${base}/rent-out');
    expect(sitemap).toContain('${base}/manage');
  });

  it('keeps seller intake on the shared lead pipeline rather than a second CRM', () => {
    const sell = source('src/app/(public)/sell/page.tsx');
    expect(sell).toContain("const SELL_AUDIENCE = 'owners' as const");
    expect(sell).toContain('audience={SELL_AUDIENCE}');
    expect(sell).toContain('<ProcessStepper');
    expect(sell).not.toContain('prisma.');
  });
});
