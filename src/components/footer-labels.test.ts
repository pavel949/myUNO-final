import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A footer column title must never repeat as one of the footer's links.
 * The legal column used to read "Правовая информация" twice in Russian (title
 * and first link, two keys with the same translation), which looks like a
 * rendering bug to the reader. Checked per locale against the seeded drafts.
 */
const seed = readFileSync(join(process.cwd(), 'src/modules/content/seed.ts'), 'utf8');
const layout = readFileSync(join(process.cwd(), 'src/app/layout.tsx'), 'utf8');

function seeded(key: string, locale: 'en' | 'ru' | 'th'): string | undefined {
  const row = seed.match(new RegExp(`key: '${key.replace(/\./g, '\\.')}'[^\\n]*`));
  return row?.[0].match(new RegExp(`\\b${locale}: '((?:[^'\\\\]|\\\\.)*)'`))?.[1];
}

describe('footer labels', () => {
  const rendered = [...new Set([...layout.matchAll(/footerLabels\['(nav\.footer\.[a-z_]+)'\]/g)].map(m => m[1]))];
  const columns = rendered.filter(key => key.endsWith('_column'));
  const links = rendered.filter(key => !key.endsWith('_column') && !['nav.footer.company_line'].includes(key));

  it('renders column titles and links from content keys', () => {
    expect(columns.length).toBeGreaterThan(0);
    expect(links).toContain('nav.footer.legal_all');
  });

  for (const locale of ['en', 'ru', 'th'] as const) {
    it(`never repeats a column title as a link (${locale})`, () => {
      const linkValues = new Map(links.map(key => [seeded(key, locale), key]));
      const clashes = columns
        .map(column => [column, seeded(column, locale)] as const)
        .filter(([, value]) => value && linkValues.has(value))
        .map(([column, value]) => `${column} = ${linkValues.get(value)} = "${value}"`);
      expect(clashes).toEqual([]);
    });
  }
});
