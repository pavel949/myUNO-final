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

/**
 * Every API route must have a caller.
 *
 * `reachability.test.ts` above only ever scanned `page.tsx` files — an
 * exported `route.ts` handler with zero references outside its own file was
 * invisible to it. That blind spot is exactly how the payout-creation routes
 * (Q51) shipped tested and correct, with no screen anywhere that called them.
 * This block closes it the same way: read the sources, don't render them.
 *
 * Matching an API route's caller is fuzzier than a page's, because a caller
 * often builds the URL from parts rather than writing it out:
 *   - an exact literal, `fetch('/api/notifications')` — the simple case.
 *   - a superstring, `href={`/api/admin/audit/export${queryString(...)}`}` —
 *     the route text still appears, just followed by more string, not a
 *     delimiter; `$` (a continuing template) is accepted as a valid follow-on
 *     character for exactly this reason.
 *   - a *dispatcher* call, where the final path segment is chosen at runtime
 *     rather than written in the URL text — a bare variable
 *     (`` `/api/bookings/${bookingId}/${path}` `` with `path` set to
 *     `'checkin'` elsewhere) or a ternary
 *     (`` `/api/admin/people/${id}/${blocked ? 'block' : 'unblock'}` ``).
 *     Neither is a literal substring match. A route is credited as wired by
 *     a dispatcher only when the SAME FILE both calls this exact resource
 *     prefix as a template ending in an open `/${`, and separately contains
 *     the route's last segment as a quoted string literal — scoped to one
 *     file, not the whole codebase, so an unrelated file using a common word
 *     (`'owner'` as a role name, say) can't hide a truly unwired route. This
 *     is deliberately the weaker, file-scoped check, not a global grep.
 */

const API_ROOT = APP_ROOT;
const apiFiles = files; // already collected from APP_ROOT above
const apiRouteFiles = apiFiles.filter((path) => path.endsWith('/route.ts'));
const apiCallerFiles = apiFiles.filter((path) => !path.endsWith('/route.ts'));
const apiCallerSources = [
  ...apiCallerFiles.map((path) => readFileSync(path, 'utf8')),
  ...componentSources,
];

function routeOfApi(routeFilePath: string): string {
  const relative = routeFilePath.slice(API_ROOT.length).replace(/\/route\.ts$/, '');
  return relative === '' ? '/' : relative;
}

function escapeLiteral(seg: string): string {
  return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function apiSegPattern(seg: string): string {
  return /^\[.+\]$/.test(seg) ? "[^/`\"']+" : escapeLiteral(seg);
}

function apiSearchPattern(route: string): RegExp {
  const escaped = route.split('/').map(apiSegPattern).join('/');
  return new RegExp('[`"\']' + escaped + "[`\"'?#/$]");
}

function isWiredByDispatcher(route: string): boolean {
  const segs = route.split('/').filter(Boolean);
  const lastSeg = segs[segs.length - 1];
  if (!lastSeg || /^\[.+\]$/.test(lastSeg)) return false;
  const prefixPattern = segs.slice(0, -1).map(apiSegPattern).join('/');
  const dispatcherCallPattern = new RegExp('[`"\']/' + prefixPattern + '/\\$\\{');
  const actionLiteralPattern = new RegExp(`['"\`]${escapeLiteral(lastSeg)}['"\`]`);
  return apiCallerSources.some(
    (text) => dispatcherCallPattern.test(text) && actionLiteralPattern.test(text)
  );
}

const apiRoutes = apiRouteFiles.map(routeOfApi);

/**
 * Hit without an in-app link, by design: schedulers, uptime monitors, AI
 * crawler conventions, and secret-token URLs handed to external tools.
 */
const API_ENTRY_POINTS = new Set([
  // Google redirects to this callback after consent; it is not an in-app link.
  '/api/auth/callback/google',
  '/api/cron/check-tm30-escalations',
  '/api/cron/check-verification-deadlines',
  '/api/cron/expire-service-orders',
  '/api/cron/retention-jobs',
  '/api/cron/rollup-metrics',
  '/api/cron/run-all',
  '/api/cron/sync-ical-imports',
  '/api/webhooks/opn',
  '/api/health',
  '/llms.txt',
  // Handed to an external calendar app as a secret-token URL (doc: admin
  // integrations page); never linked from inside the product.
  '/api/units/[unitId]/ical/export',
  // Marketing/QR-code entry onto a project's vanity URL, typed or scanned,
  // the same as the parent /[vanitySlug] route it extends.
  '/[vanitySlug]/guest',
]);

/**
 * Confirmed, real gaps as of this pass (2026-08-25) — not exempted because
 * they're fine, exempted because fixing ~40 unwired routes is a separate,
 * much larger initiative than closing this test's blind spot. Tracked in
 * `docs/open_questions.md` Q59 so the debt isn't lost. Wiring one — deleting
 * it here — should shrink this list, never grow it back.
 */
const API_DEBT = new Set([
  // Admin screens whose backend exists with no UI caller anywhere (Q59).
  '/api/admin/compliance-checklists/[id]',
  '/api/admin/compliance-checklists',
  '/api/admin/config/[paramKey]/history',
  '/api/admin/content/export',
  '/api/admin/content/import',
  '/api/admin/content/namespace/[namespace]',
  '/api/admin/contracts',
  '/api/admin/crm/activities',
  '/api/admin/crm/pipeline',
  '/api/admin/crm/profiles/[profileId]/transition',
  '/api/admin/fees/[contractId]',
  '/api/admin/fees/calculate',
  '/api/admin/incidents/[id]',
  '/api/admin/incidents',
  '/api/admin/operational-kpis',
  '/api/admin/organizations/[organizationId]',
  '/api/admin/organizations',
  '/api/admin/prospecting/[id]/transition',
  '/api/admin/prospecting',
  '/api/admin/reports/attribution',
  '/api/admin/statements/[statementId]/line-items',
  '/api/admin/units/[id]/status',
  // Guest/owner/provider-facing routes with no caller found.
  '/api/auth/verify-email',
  '/api/bookings/[id]/record-transfer',
  '/api/bookings/[id]/transfer-instructions',
  '/api/content/translate',
  '/api/messages/[messageId]/flag-as-purchase',
  '/api/profile/export',
  '/api/track',
  // SSE endpoints that exist and work, but the frontend they were built for
  // polls instead (NotificationBell polls /api/notifications every 30s) —
  // built, never adopted.
  '/api/notifications/stream',
  '/api/threads/[threadId]/stream',
]);

describe('every API route can be reached', () => {
  it('has a caller, an external trigger, or a tracked reason it does not yet', () => {
    const orphans = apiRoutes.filter((route) => {
      if (API_ENTRY_POINTS.has(route) || API_DEBT.has(route)) return false;
      const pattern = apiSearchPattern(route);
      if (apiCallerSources.some((source) => pattern.test(source))) return false;
      return !isWiredByDispatcher(route);
    });

    expect(
      orphans,
      'these API routes exist and nothing calls them; wire them up, add them to API_DEBT with a reason, or delete them'
    ).toEqual([]);
  });

  it('does not let API_DEBT quietly collect routes that got wired since', () => {
    const stillOrphaned = [...API_DEBT].filter((route) => {
      const pattern = apiSearchPattern(route);
      if (apiCallerSources.some((source) => pattern.test(source))) return false;
      return !isWiredByDispatcher(route);
    });

    expect(
      stillOrphaned.length,
      'every API_DEBT entry should still be genuinely unwired — remove any that a later change wired up'
    ).toBe(API_DEBT.size);
  });
});
