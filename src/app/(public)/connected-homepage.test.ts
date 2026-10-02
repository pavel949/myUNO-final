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
    for (const route of ['/search', '/projects', '/homes?intent=buy', '/owners', '/sell', '/rent-out', '/manage', '/services']) {
      expect(landing + navbar + discovery).toContain(route);
    }
  });
  it('keeps consumer discovery focused on stay monthly and buy', () => {
    expect(discovery).toContain("router.push('/search?' + params.toString())");
    expect(discovery).toContain("router.push('/homes?' + params.toString())");
    expect(discovery).toContain("mode === 'stay'");
    expect(discovery).toContain("{ id: 'stay', title: labels.stay }");
    expect(discovery).toContain("{ id: 'monthly', title: labels.monthly }");
    expect(discovery).toContain("{ id: 'buy', title: labels.buy }");
    expect(discovery).not.toContain("{ id: 'manage'");
    expect(discovery).not.toContain("{ id: 'sell'");
    expect(landing).toContain('href="/sell"');
    expect(landing).toContain('href="/rent-out"');
    expect(landing).toContain('href="/manage"');
  });
  it('keeps a shared header/footer with account role links', () => {
    expect(navbar).toContain('roleLinks');
    expect(navbar).toContain('My myUNO');
    expect(footer).toContain("href: '/developers'");
    expect(footer).toContain("href: '/legal/privacy'");
  });
});
