import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

/**
 * No component island: every component must be reachable from a page.
 *
 * `src/app/components/crm/` held eleven components — a dashboard, a kanban, a
 * filter panel, an activity timeline — that imported each other and nothing
 * else. No page imported any of them, so no person could open one. That is
 * invisible from inside the code: each file compiles, each looks maintained,
 * and `reachability.test.ts` does not see it because that test checks pages,
 * and these are components.
 *
 * The cost was not theoretical. Cursor Agent restyled the island on 5 Sep and
 * a T-070 pass fixed a satang/baht bug in three of its files on 6 Sep — a bug
 * that could never have reached a screen. Two sessions of work on code nobody
 * could reach, because nothing said so.
 *
 * Reachability here is transitive and deliberately so: an island whose members
 * import each other must still trace back to a page, a layout, or a route
 * handler. Mutual imports are exactly how the island stayed alive.
 */

const SRC = join(process.cwd(), 'src');

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...walk(path));
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) found.push(path);
  }
  return found;
}

/** `@/lib/money` or `./OpportunityCard` → an absolute file path, if one exists. */
function resolveImport(specifier: string, fromFile: string): string | null {
  let base: string;
  if (specifier.startsWith('@/')) base = join(SRC, specifier.slice(2));
  else if (specifier.startsWith('.')) base = resolve(dirname(fromFile), specifier);
  else return null; // a package, not our source

  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function importsOf(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const specifiers: string[] = [];
  // `import … from 'x'`, `export … from 'x'`, and `import('x')`.
  for (const match of source.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
    specifiers.push(match[1]);
  }
  return specifiers
    .map((specifier) => resolveImport(specifier, file))
    .filter((path): path is string => path !== null);
}

/**
 * What a person or the framework can enter through: every page, layout and
 * route handler, plus the middleware. Nothing else is a root — a component is
 * reached, never entered.
 */
const roots = walk(join(SRC, 'app')).filter((path) =>
  /\/(page|layout|route|error|not-found|loading|template|default)\.tsx?$/.test(path)
);

const reachable = new Set<string>();
const queue = [...roots, join(SRC, 'middleware.ts')].filter((path) => existsSync(path));
while (queue.length > 0) {
  const file = queue.pop() as string;
  if (reachable.has(file)) continue;
  reachable.add(file);
  queue.push(...importsOf(file));
}

describe('component islands', () => {
  it('finds the entry points (the graph walk still works)', () => {
    expect(roots.length).toBeGreaterThan(50);
    expect(reachable.size).toBeGreaterThan(roots.length);
  });

  it('leaves no component that no page can reach', () => {
    const orphans = walk(join(SRC, 'app', 'components'))
      .filter((path) => !reachable.has(path))
      .map((path) => relative(process.cwd(), path))
      .sort();

    expect(
      orphans,
      'these components are not reachable from any page, layout or route — wire them to a screen or delete them'
    ).toEqual([]);
  });
});
