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

  it('keeps seller intake on the shared lead pipeline rather than a second CRM', () => {
    const sell = source('src/app/(public)/sell/page.tsx');
    expect(sell).toContain('<LeadFormSection audience="owners"');
    expect(sell).toContain('<ProcessStepper');
    expect(sell).not.toContain('prisma.');
  });
});
