import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const landing = source('src/app/(public)/page.tsx');
const discovery = source('src/components/DiscoverySearch.tsx');
const navbar = source('src/components/Navbar.tsx');
const footer = source('src/components/Footer.tsx');

describe('connected public homepage', () => {
  it('keeps canonical project and services data rather than local catalogues', () => {
    expect(landing).toContain('getPublicHomepageData(locale)');
    expect(source('src/modules/home/public-homepage.service.ts')).toContain('listPublicProjects(locale)');
    expect(source('src/modules/home/public-homepage.service.ts')).toContain('listPublicMarketplaceServices(prisma, locale');
    expect(landing).toContain('<ProjectCard');
    expect(landing).toContain('<ServiceCard');
  });
  it('provides connected entry points to the five primary intents and discovery', () => {
    for (const route of ['/search', '/projects', '/homes?intent=buy', '/sell', '/rent-out', '/manage', '/services']) {
      expect(landing + navbar + discovery).toContain(route);
    }
  });
  it('keeps date-aware stays on canonical search and makes other modes navigational', () => {
    expect(discovery).toContain("router.push('/search?' + params.toString())");
    expect(discovery).toContain("router.push('/homes?' + params.toString())");
    expect(discovery).toContain("router.push('/manage')");
    expect(discovery).toContain("/property/onboard?kind=home&offers=sale");
    expect(discovery).toContain("mode === 'rent'");
    expect(discovery).toContain("{ id: 'rent', title: labels.rent }");
    expect(discovery).toContain("{ id: 'buy', title: labels.buy }");
    expect(discovery).toContain("{ id: 'manage', title: labels.manage }");
    expect(discovery).toContain("{ id: 'sell', title: labels.sell }");
  });
  it('keeps a shared header/footer with account role links', () => {
    expect(navbar).toContain('roleLinks');
    expect(navbar).toContain('My UNO');
    expect(footer).toContain("href: '/developers'");
    expect(footer).toContain("href: '/legal/privacy'");
  });
});
