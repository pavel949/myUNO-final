import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const landing = source('src/app/(public)/page.tsx');
const discovery = source('src/components/home/HomeFinder.tsx');
const rail = source('src/components/home/HomeOffersRail.tsx');
const intentState = source('src/components/home/home-intent.ts');
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
    for (const route of ['/search', '/projects', '/homes?', '/owners', '/partners', '/sell', '/rent-out', '/manage', '/services', '/areas', '/property/onboard', '/app', '/trips', '/help', '/desks', '/trust', '/developers', '/management-companies', '/providers']) {
      expect(landing + navbar + discovery + rail + intentState).toContain(route);
    }
  });
  it('keeps consumer discovery focused on stay monthly and buy', () => {
    expect(discovery).toContain("router.push('/search?' + params.toString())");
    expect(discovery).toContain("router.push('/homes?' + params.toString())");
    expect(discovery).toContain("intent === 'stay'");
    expect(intentState).toContain("HOME_INTENTS: readonly HomeIntent[] = ['stay', 'monthly', 'buy']");
    expect(discovery).not.toContain("'manage'");
    expect(discovery).not.toContain("'sell'");
    expect(landing).toContain('href="/sell"');
    expect(landing).toContain('href="/rent-out"');
    expect(landing).toContain('href="/manage"');
  });
  it('shares one intent and one place between the search and the offers shelf', () => {
    expect(landing).toContain('<HomeIntentProvider');
    expect(discovery).toContain('useHomeIntent()');
    expect(rail).toContain('useHomeIntent()');
    expect(rail).toContain('homeCatalogHref(intent, place, search)');
    expect(intentState).toContain('HomeSearchState');
    expect(rail).toContain('item.projectId === place.id');
    expect(rail).toContain("url.searchParams.set('startDate', search.startDate)");
  });
  it('never presents an indicative base rate as a total price', () => {
    expect(landing).toContain("priceMode: 'base_nightly'");
    expect(landing).toContain('landing.hp.offers.price.base_note');
  });
  it('keeps a shared header/footer with account role links', () => {
    expect(navbar).toContain('roleLinks');
    expect(navbar).toContain('labels.myUno');
    expect(footer).toContain("href: '/developers'");
    expect(footer).toContain("href: '/legal/privacy'");
  });
});
