import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every admin screen must be reachable from the admin sidebar.
 *
 * Ledger, statements and payouts were all built, tested and deployed — and none
 * of them was in the navigation, so the only way to open one was to know its
 * URL and type it. The reachability audit called this "built but invisible",
 * and nothing stopped it happening again: adding a page directory is one step,
 * adding the link is another, and the tests never noticed the second was
 * missing.
 *
 * This is a structural test. It reads the layout rather than renders it,
 * because the property it protects — "a page a person can find" — is not
 * something a component test can see.
 */

const ADMIN_ROOT = join(process.cwd(), 'src/app/(admin)/app/admin');

/** Directories under /app/admin that actually render a page. */
function pageDirectories(): string[] {
  return readdirSync(ADMIN_ROOT).filter((entry) => {
    const path = join(ADMIN_ROOT, entry);
    if (!statSync(path).isDirectory()) return false;
    // A dynamic segment (`[id]`) is reached from its parent list, not the nav.
    if (entry.startsWith('[')) return false;
    return existsSync(join(path, 'page.tsx'));
  });
}

describe('the admin navigation', () => {
  const layout = readFileSync(join(ADMIN_ROOT, 'layout.tsx'), 'utf8');

  it('links to every admin screen that exists', () => {
    const unlinked = pageDirectories().filter(
      (dir) => !layout.includes(`/app/admin/${dir}`)
    );

    expect(
      unlinked,
      'these admin pages exist but nothing links to them; add them to the sidebar'
    ).toEqual([]);
  });

  it('includes the audit trail, which is how the compliance promise is kept', () => {
    // Called out by name because it is the one screen whose absence is
    // invisible from inside the product: everything still works, and the record
    // of who did what simply cannot be read (doc 12 §6).
    expect(layout).toContain('/app/admin/audit');
    expect(existsSync(join(ADMIN_ROOT, 'audit/page.tsx'))).toBe(true);
  });
});
