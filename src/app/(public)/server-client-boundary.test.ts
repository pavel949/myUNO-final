import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A function exported from a 'use client' module reaches a server component as
 * a client *reference*, not a callable. Calling it throws at render time —
 * production "TypeError: g is not a function" on `/` — and neither the type
 * checker nor `next build` notices. A server page may import only components
 * (capitalised names) from a client module; helpers live in a plain module.
 */
const root = process.cwd();

function resolve(specifier: string): string | null {
  if (!specifier.startsWith('@/')) return null;
  const base = join(root, 'src', specifier.slice(2));
  for (const candidate of [`${base}.tsx`, `${base}.ts`, join(base, 'index.tsx'), join(base, 'index.ts')]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function valueImports(source: string): Array<{ names: string[]; from: string }> {
  const found: Array<{ names: string[]; from: string }> = [];
  for (const match of source.matchAll(/import\s+(?!type\b)([^;]*?)\s+from\s+'([^']+)'/g)) {
    const named = /\{([^}]*)\}/.exec(match[1])?.[1] ?? '';
    const names = named
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part && !part.startsWith('type '))
      .map((part) => part.split(/\s+as\s+/)[0].trim());
    found.push({ names, from: match[2] });
  }
  return found;
}

describe('server homepage ↔ client module boundary', () => {
  const page = readFileSync(join(root, 'src/app/(public)/page.tsx'), 'utf8');

  it("imports only components from 'use client' modules", () => {
    for (const { names, from } of valueImports(page)) {
      const file = resolve(from);
      if (!file) continue;
      const isClient = /^\s*(\/\*[\s\S]*?\*\/\s*)?['"]use client['"]/.test(readFileSync(file, 'utf8'));
      if (!isClient) continue;
      for (const name of names) {
        expect(name, `${name} from ${from} is a client export used by a server page`).toMatch(/^[A-Z]/);
      }
    }
  });

  it('keeps the intent helpers in a plain module', () => {
    const helpers = readFileSync(join(root, 'src/components/home/home-intent.ts'), 'utf8');
    expect(helpers).not.toMatch(/^\s*['"]use client['"]/m);
    expect(helpers).toContain('export function parseHomeIntent');
    expect(page).toContain("from '@/components/home/home-intent'");
  });
});
