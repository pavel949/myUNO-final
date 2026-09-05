import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const search = readFileSync(join(process.cwd(), 'src/app/search/search-results.tsx'), 'utf8');
const trips = readFileSync(join(process.cwd(), 'src/app/trips/trips-list.tsx'), 'utf8');
const checkout = readFileSync(
  join(process.cwd(), 'src/app/checkout/[sessionId]/checkout-client.tsx'),
  'utf8'
);
const reconciliation = readFileSync(
  join(process.cwd(), 'src/app/admin/finance/reconciliation/reconciliation-client.tsx'),
  'utf8'
);
const announcements = readFileSync(join(process.cwd(), 'src/app/announcements/page.tsx'), 'utf8');
const integrations = readFileSync(
  join(process.cwd(), 'src/app/(admin)/app/admin/integrations/page.tsx'),
  'utf8'
);
const claim = readFileSync(join(process.cwd(), 'src/app/auth/claim/claim-client.tsx'), 'utf8');
const onboarding = readFileSync(
  join(process.cwd(), 'src/app/(admin)/app/admin/units/[id]/onboarding-client.tsx'),
  'utf8'
);

describe('remaining canvas boards 13–21 (existing surfaces only)', () => {
  it('drops the unused gray marketplace leftovers', () => {
    expect(existsSync(join(process.cwd(), 'src/app/components/marketplace/MarketplaceHeader.tsx'))).toBe(
      false
    );
    expect(existsSync(join(process.cwd(), 'src/app/components/marketplace/PropertyCard.tsx'))).toBe(
      false
    );
  });

  it('keeps search, trips, and checkout on ivory with display titles', () => {
    expect(search).toContain('bg-surface-ivory');
    expect(search).toContain('text-display-xl');
    expect(trips).toContain('bg-surface-ivory');
    expect(trips).toContain('text-display-xl');
    expect(checkout).toContain('bg-surface-ivory');
    expect(checkout).toContain('text-display-xl');
  });

  it('does not invent a marketplace header in Russian on search', () => {
    expect(search).not.toContain('Пхукет');
    expect(search).not.toContain('Жилье и услуги');
  });

  it('does not invent announcement read-receipts or a ฿840,000 NOI cap', () => {
    expect(announcements).not.toContain('read by');
    expect(announcements).toContain('text-display-xl');
    expect(onboarding).not.toContain('840000');
    expect(onboarding).not.toContain('30%');
    expect(onboarding).not.toContain('step 3 of 4');
  });

  it('sits integrations, claim, and reconciliation on tokens without gray leftovers', () => {
    expect(integrations).toContain('text-display-xl');
    expect(claim).toContain('bg-surface-ivory');
    expect(reconciliation).toContain('text-display-xl');
    expect(reconciliation).not.toContain('text-xsmall');
    expect(reconciliation).not.toContain('bg-brand-andaman-soft');
    expect(reconciliation).not.toContain('text-gray-');
  });
});
