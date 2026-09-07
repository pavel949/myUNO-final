import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every content key a surface asks for must exist in the content seed.
 *
 * `getLabels()` takes a map of content key → English draft, and falls back to
 * that draft when the key is missing from the database. That fallback is
 * deliberate — a page must stay legible when the database is unreachable — but
 * it also means a key that was never seeded is completely silent: the page
 * renders in English, forever, in every locale, and nothing fails. A Russian
 * guest simply sees English and no one finds out.
 *
 * That is exactly what happened to the four owner-statement breadcrumbs, and to
 * 383 others alongside them. This test is the structural guard, in the same
 * spirit as `reachability.test.ts`: it reads the sources rather than rendering
 * them, because "this key was never seeded" is not a property any component
 * test can see.
 *
 * It carried a `CONTENT_SEED_DEBT` allowlist while that backlog was worked
 * down. The backlog is now empty and the allowlist is deleted: this is a hard
 * rule with no exceptions, and a new key that is not seeded fails the build.
 */

const SRC_ROOT = join(process.cwd(), 'src');
const SEED_DIR = join(SRC_ROOT, 'modules/content');

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) found.push(path);
  }
  return found;
}

/** Every `key: '...'` declared across the seed files. */
function seededKeys(): Set<string> {
  const keys = new Set<string>();
  for (const entry of readdirSync(SEED_DIR)) {
    if (!/\.seed\.ts$|^seed\.ts$/.test(entry)) continue;
    const source = readFileSync(join(SEED_DIR, entry), 'utf8');
    for (const match of source.matchAll(/\bkey:\s*'([^']+)'/g)) keys.add(match[1]);
  }
  return keys;
}

/**
 * The keys passed to each `getLabels({ ... })` call in a file.
 *
 * Brace-matched from the call site rather than regexed line-by-line, so a
 * literal that merely looks like a key elsewhere in the file is not collected.
 */
function requestedKeys(source: string): string[] {
  const keys: string[] = [];
  for (const call of source.matchAll(/getLabels\s*\(\s*\{/g)) {
    let depth = 1;
    let i = call.index! + call[0].length;
    const start = i;
    while (i < source.length && depth > 0) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') depth--;
      i++;
    }
    const body = source.slice(start, i - 1);
    for (const entry of body.matchAll(/'([a-z][a-z0-9_]*(?:[.-][a-z0-9_]+)+)'\s*:/g)) {
      keys.push(entry[1]);
    }
  }
  return keys;
}



const seeded = seededKeys();

describe('content keys are seeded', () => {
  it('has more than a token number of seeded keys (the parser still works)', () => {
    // Guards the test itself: a seed-file rename that broke the scan would
    // otherwise make this suite pass by finding nothing to check.
    expect(seeded.size).toBeGreaterThan(1000);
  });

  it('every key a surface asks getLabels() for exists in the seed', () => {
    const missing: string[] = [];
    for (const path of sourceFiles(SRC_ROOT)) {
      const source = readFileSync(path, 'utf8');
      if (!source.includes('getLabels')) continue;
      for (const key of requestedKeys(source)) {
        if (seeded.has(key)) continue;
        missing.push(`${key}  (${path.slice(process.cwd().length + 1)})`);
      }
    }

    expect(
      [...new Set(missing)].sort(),
      'these content keys are requested by a surface but never seeded — they would render their English draft in every locale, silently. Add them to the content seed as needs_review drafts (doc 05 §1)'
    ).toEqual([]);
  });

});
