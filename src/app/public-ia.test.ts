import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('canonical public IA (PRODUCT.md §2, DESIGN.md §7)', () => {
  it('wires header and footer to the specified consumer nav', () => {
    const navbar = source('src/components/Navbar.tsx');
    const footer = source('src/components/Footer.tsx');
    expect(navbar).toContain("href: '/explore'");
    expect(navbar).toContain("href: '/stays'");
    expect(navbar).toContain("href: '/services'");
    expect(navbar).toContain("href: '/homes'");
    expect(navbar).toContain("href: '/owners'");
    expect(navbar).toContain("href: '/partners'");
    expect(navbar).toContain("href: '/me'");
    expect(navbar).not.toMatch(/Developers\n/);
    expect(footer).toContain("href: '/explore'");
    expect(footer).toContain("href: '/stays'");
    expect(footer).toContain("href: '/partners'");
  });

  it('keeps specified aliases on existing backend rails', () => {
    expect(source('src/app/stays/page.tsx')).toContain("redirect(query ? `/search?${query}` : '/search')");
    expect(source('src/app/properties/[slug]/page.tsx')).toContain('`/projects/${params.slug}`');
    expect(source('src/app/(public)/owners/submit/page.tsx')).toContain("redirect('/rent-out')");
    expect(source('src/app/(public)/owners/management/page.tsx')).toContain("redirect('/manage')");
    expect(source('src/app/(public)/owners/claim/page.tsx')).toContain("redirect('/auth/claim')");
    expect(source('src/app/(public)/partners/property-managers/page.tsx')).toContain(
      "redirect('/management-companies')"
    );
    expect(source('src/app/(public)/partners/providers/page.tsx')).toContain("redirect('/providers')");
    expect(source('src/app/services/category/[key]/page.tsx')).toContain('/services?category=');
    expect(source('src/app/me/page.tsx')).toContain('availableSurfaces');
    expect(source('src/app/me/page.tsx')).toContain('resolveLanding');
    expect(source('src/app/(public)/explore/page.tsx')).toContain('getPublicHomepageData');
  });
});
