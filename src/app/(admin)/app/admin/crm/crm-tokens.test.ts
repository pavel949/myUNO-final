import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const page = readFileSync(join(process.cwd(), 'src/app/(admin)/app/admin/crm/page.tsx'), 'utf8');
const pipeline = readFileSync(
  join(process.cwd(), 'src/app/(admin)/app/admin/crm/pipeline-client.tsx'),
  'utf8'
);
const layout = readFileSync(join(process.cwd(), 'src/app/(admin)/app/admin/layout.tsx'), 'utf8');
const provider = readFileSync(join(process.cwd(), 'src/app/provider/layout.tsx'), 'utf8');
const mc = readFileSync(join(process.cwd(), 'src/app/mc/client.tsx'), 'utf8');
const detail = readFileSync(
  join(process.cwd(), 'src/app/components/crm/OpportunityDetailClient.tsx'),
  'utf8'
);
const residence = readFileSync(join(process.cwd(), 'src/app/residence/page.tsx'), 'utf8');

describe('CRM / admin / partner tokens (Claude Design boards 10–12)', () => {
  it('keeps admin nav hrefs in the layout file', () => {
    expect(layout).toContain("href: '/app/admin/crm'");
    expect(layout).toContain('bg-surface-ivory');
    expect(layout).toContain('bg-brand-deep');
  });

  it('does not invent pipeline stages or emoji column names', () => {
    expect(pipeline).toContain("'new'");
    expect(pipeline).toContain("'lost'");
    expect(pipeline).not.toContain('🆕');
    expect(pipeline).toContain('bg-chart-seq-');
    expect(page).toContain('text-display-xl');
  });

  it('does not invent a ฿286.4M forecast', () => {
    expect(page).not.toContain('286.4');
    expect(pipeline).not.toContain('286.4');
  });

  it('drops emoji stage names on the shipping opportunity detail', () => {
    expect(detail).not.toContain('🆕');
    expect(detail).toContain("new: 'New'");
  });

  it('does not invent announcement read-receipts on residence', () => {
    expect(residence).toContain('text-display-xl');
    expect(residence).not.toContain('have read this');
    expect(residence).not.toContain('sv-SE');
  });

  it('sits provider and MC portals on ivory', () => {
    expect(provider).toContain('bg-surface-ivory');
    expect(provider).toContain('text-display-xl');
    expect(mc).toContain('bg-surface-ivory');
    expect(mc).toContain('text-display-xl');
  });
});
