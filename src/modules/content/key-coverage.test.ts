import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every content key the UI asks for has a seeded EN/RU/TH entry (doc 05 §1).
 *
 * `getLabels({ 'key': 'English default' })` renders the English default when
 * the key is missing from the content store, so a key with no seed entry is
 * English for every Russian and Thai visitor and never appears in the admin
 * editor. The Reservation Desk and the About page shipped that way (52 keys).
 */

// Keys deliberately left without a machine-drafted translation.
const PENDING_CERTIFIED_TRANSLATION = [
  // The privacy notice is a legal text: a drafted RU/TH version could
  // misstate obligations. Tracked in docs/open_questions.md (certified
  // translation of legal pages); EN renders until then.
  'legal.privacy.',
];

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const CONTENT = join(SRC, 'modules/content');
// Config parameter defaults share the dotted shape but are not content keys.
const NOT_CONTENT = [join(SRC, 'modules/config')];

function files(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...files(path));
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(path);
  }
  return out;
}

const seeded = new Set<string>();
for (const file of readdirSync(CONTENT).filter(f => /seed\.ts$/.test(f))) {
  for (const m of readFileSync(join(CONTENT, file), 'utf8').matchAll(/key: '([^']+)'/g)) seeded.add(m[1]);
}

// A labels map entry: `'namespace.key': 'English default',` on its own line.
const LABEL_ENTRY = /^\s*'([a-z][a-z0-9_-]*(?:\.[a-z0-9_-]+)+)':\s*['"`]/gm;

describe('content key coverage', () => {
  it('seeds every content key the UI requests', () => {
    const missing: string[] = [];
    for (const file of files(SRC)) {
      if (file.includes('seed') || NOT_CONTENT.some(dir => file.startsWith(dir))) continue;
      const text = readFileSync(file, 'utf8');
      if (!text.includes('getLabels')) continue;
      for (const m of text.matchAll(LABEL_ENTRY)) {
        const key = m[1];
        if (seeded.has(key) || PENDING_CERTIFIED_TRANSLATION.some(p => key.startsWith(p))) continue;
        missing.push(`${relative(ROOT, file)}: ${key}`);
      }
    }
    expect([...new Set(missing)]).toEqual([]);
  });
});
