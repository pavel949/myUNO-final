import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Doc 06 §5: 44px minimum touch targets. The PMS workspaces apply it once, in
 * CSS, for coarse pointers (the on-site host's phone) instead of per control —
 * 80 of 103 PMS controls were sized for a mouse. This pins the scope so a
 * layout refactor cannot silently drop it.
 */
const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('PMS touch targets', () => {
  it('marks every PMS workspace as a touch-target scope', () => {
    const shared = read('src/components/stitch/StitchShells.tsx');
    expect(shared).toContain('pms-touch');
    expect(read('src/app/ops/layout.tsx')).toContain('StitchWorkspaceShell');
    expect(read('src/app/mc/layout.tsx')).toContain('McWorkspaceShell');
    expect(read('src/components/stitch/McWorkspaceShell.tsx')).toContain('StitchWorkspaceShell');
    expect(read('src/app/(admin)/app/admin/layout.tsx')).toContain('pms-touch');
  });

  it('gives controls in that scope a 44px minimum height on touch screens', () => {
    const css = read('src/app/globals.css');
    const rule = css.slice(css.indexOf('@media (pointer: coarse)'));
    expect(rule).toContain('.pms-touch :is(button, select, summary');
    expect(rule).toContain("a[class*='px-']");
    expect(rule.match(/min-height: 44px/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
