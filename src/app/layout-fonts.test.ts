import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * next/font/google downloads CSS from Google during `next build`.
 * A font URL without a file extension crashes the loader
 * (`Cannot read properties of null (reading '1')`) and failed `main` CI
 * after #167 even though the typefaces themselves were valid.
 */
describe('root layout fonts are self-hosted', () => {
  const layout = readFileSync(join(__dirname, 'layout.tsx'), 'utf8');

  it('does not import next/font/google', () => {
    expect(layout).not.toMatch(/from ['"]next\/font\/google['"]/);
  });

  it('loads Outfit, Manrope, and Noto Sans Thai from Fontsource', () => {
    expect(layout).toContain('@fontsource-variable/outfit/wght.css');
    expect(layout).toContain('@fontsource-variable/manrope/wght.css');
    expect(layout).toContain('@fontsource-variable/noto-sans-thai/wght.css');
  });
});
