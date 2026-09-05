import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const portfolio = readFileSync(join(process.cwd(), 'src/app/owner/client.tsx'), 'utf8');
const unit = readFileSync(join(process.cwd(), 'src/app/owner/units/[unitId]/client.tsx'), 'utf8');
const switcher = readFileSync(join(process.cwd(), 'src/components/owner/ProjectSwitcher.tsx'), 'utf8');
const sell = readFileSync(join(process.cwd(), 'src/components/owner/SellInterestCard.tsx'), 'utf8');

describe('owner tokens (Claude Design board 07)', () => {
  it('sits on ivory rather than the old background alias alone', () => {
    expect(portfolio).toContain('bg-surface-ivory');
    expect(unit).toContain('bg-surface-ivory');
  });

  it('uses chip filters instead of a dropdown switcher', () => {
    expect(switcher).toContain('rounded-full');
    expect(switcher).toContain('onProjectChange(null)');
    expect(switcher).not.toContain('rotate-180');
  });

  it('does not invent a managed-since date', () => {
    expect(portfolio).not.toContain('March 2024');
    expect(unit).not.toContain('March 2024');
  });

  it('writes permitted-use status as words, not check glyphs', () => {
    expect(portfolio).toContain('owner.compliance.permitted_yes');
    expect(portfolio).not.toContain("'✓'");
    expect(unit).not.toContain("'✓'");
  });

  it('keeps sell interest on paper, not a sun gradient', () => {
    expect(sell).toContain('bg-surface-paper');
    expect(sell).not.toContain('from-brand-sun-soft');
  });
});
