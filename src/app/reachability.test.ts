import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every page must be linked from somewhere.
 *
 * This is the guarantee behind wiring the platform together. A page that
 * exists, compiles, is tested, and has nothing pointing at it is a page nobody
 * will ever open — and that failure is invisible from inside the code, because
 * everything about it looks healthy. It is how ledger, statements and payouts
 * shipped with no way in but typing the URL, and how a resident ended up with a
 * role and nowhere to go.
 *
 * A structural test: it reads the sources rather than rendering them, because
 * "somebody can get here" is not a property any component test can see.
 */

const APP_ROOT = join(process.cwd(), 'src/app');

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) found.push(path);
  }
  return found;
}

/** `src/app/(public)/trust/page.tsx` → `/trust`; route groups do not appear in URLs. */
function routeOf(pagePath: string): string {
  const relative = pagePath.slice(APP_ROOT.length).replace(/\/page\.tsx$/, '');
  const withoutGroups = relative.replace(/\/\([^)]+\)/g, '');
  return withoutGroups === '' ? '/' : withoutGroups;
}

const files = sourceFiles(APP_ROOT);
const sources = files.map((path) => readFileSync(path, 'utf8'));
// Components live outside src/app and do most of the linking — the navbar, the
// footer, the role banner — so a link from there counts.
const componentSources = sourceFiles(join(process.cwd(), 'src/components')).map((path) =>
  readFileSync(path, 'utf8')
);
// The role-driven menu builds its links from the landing policy rather than from
// literal anchors, so that table is a linking mechanism and counts as one.
const landingPolicy = readFileSync(join(process.cwd(), 'src/modules/core/landing.ts'), 'utf8');
const allSources = [...sources, ...componentSources, landingPolicy];

const routes = files
  .filter((path) => path.endsWith('/page.tsx'))
  .map(routeOf)
  // A dynamic segment is reached from whatever lists it, never linked by name.
  .filter((route) => !route.includes('['));

/**
 * Routes a person arrives at without following an internal link: the front
 * door, the pages an email lands on, and the redirect targets that are never
 * rendered as anchors.
 */
const ENTRY_POINTS = new Set([
  '/',
  '/login',
  '/register',
  '/app', // the adaptive landing: redirected to, and typed
  '/auth/claim', // opened from an invitation email
  '/auth/verify', // opened from a verification email
  '/auth/reset-password', // opened from a reset email
  '/design', // the design-system reference, for the team not the product
]);

describe('every page can be reached', () => {
  it('has something linking to it', () => {
    const orphans = routes.filter((route) => {
      if (ENTRY_POINTS.has(route)) return false;
      // `href="/ops/costs"`, `href={'/ops/costs'}`, or a template that starts
      // with it (`href={`/services/orders/${id}`}` links /services/orders too,
      // but we only need the exact route to appear somewhere).
      const pattern = new RegExp(`["'\`]${route}(["'\`?#/])`);
      return !allSources.some((source) => pattern.test(source));
    });

    expect(
      orphans,
      'these pages exist and nothing links to them; link them or delete them'
    ).toEqual([]);
  });

  it('gives every role its own way in', () => {
    // Named individually because each of these was, at some point, a role that
    // could be granted to a real person who then had nowhere to go.
    const perRole = [
      '/owner',
      '/residence',
      '/juristic',
      '/mc',
      '/provider',
      '/ops',
      '/app/admin',
    ];

    const missing = perRole.filter((route) => !routes.includes(route));
    expect(missing, 'a role with no surface is a role nobody can use').toEqual([]);
  });
});
