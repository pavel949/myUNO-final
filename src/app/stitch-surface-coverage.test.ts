import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('Stitch system-wide surface coverage', () => {
  it('keeps every operational workspace on the shared Stitch shell', () => {
    for (const path of [
      'src/app/ops/layout.tsx',
      'src/app/owner/layout.tsx',
      'src/app/provider/layout.tsx',
    ]) {
      expect(source(path)).toContain('StitchWorkspaceShell');
    }
    expect(source('src/app/mc/layout.tsx')).toContain('McWorkspaceShell');
    expect(source('src/components/stitch/McWorkspaceShell.tsx')).toContain('StitchWorkspaceShell');
    expect(source('src/app/admin/layout.tsx')).toContain("@/app/(admin)/app/admin/layout");
    expect(source('src/app/(admin)/app/admin/layout.tsx')).toContain('stitch-workspace');
    expect(source('src/app/(admin)/app/admin/layout.tsx')).toContain('stitch-admin-content');
    expect(source('src/app/ops/layout.tsx')).toContain('getDepartmentProjectIds');
    expect(source('src/app/ops/layout.tsx')).toContain("['finance','front_desk']");
  });

  it('keeps the authenticated guest and commerce route families inside Stitch', () => {
    for (const path of [
      'src/app/trips/layout.tsx',
      'src/app/book/layout.tsx',
      'src/app/bookings/layout.tsx',
      'src/app/account/layout.tsx',
      'src/app/saved/layout.tsx',
      'src/app/services/layout.tsx',
      'src/app/search/layout.tsx',
      'src/app/checkout/layout.tsx',
      'src/app/units/layout.tsx',
      'src/app/homes/layout.tsx',
      'src/app/login/layout.tsx',
      'src/app/register/layout.tsx',
      'src/app/auth/layout.tsx',
      'src/app/messages/layout.tsx',
      'src/app/tickets/layout.tsx',
      'src/app/buying/layout.tsx',
      'src/app/residence/layout.tsx',
      'src/app/juristic/layout.tsx',
    ]) {
      expect(source(path)).toContain('StitchConsumerShell');
    }
  });

  it('keeps legacy guest transaction screens normalized to Stitch panels', () => {
    for (const path of [
      'src/app/trips/trips-list.tsx',
      'src/app/trips/[id]/booking-client.tsx',
      'src/app/account/account-client.tsx',
      'src/app/book/review/review-client.tsx',
      'src/app/bookings/[bookingId]/passports/passports-client.tsx',
      'src/app/services/services-client.tsx',
      'src/app/services/[id]/page.tsx',
      'src/app/saved/page.tsx',
      'src/app/search/search-results.tsx',
      'src/app/tickets/[id]/page.tsx',
      'src/app/tickets/tickets-list-client.tsx',
      'src/app/tickets/[id]/ticket-detail-client.tsx',
      'src/app/tickets/new/new-ticket-client.tsx',
    ]) {
      const contents = source(path);
      expect(contents.includes('stitch-workspace') || contents.includes('stitch-panel')).toBe(true);
    }
  });

  it('keeps canonical property and stay surfaces on Stitch composition', () => {
    for (const path of [
      'src/app/homes/page.tsx',
      'src/app/homes/[id]/page.tsx',
      'src/app/(public)/projects/page.tsx',
      'src/app/(public)/projects/[slug]/page.tsx',
      'src/app/units/[id]/unit-client.tsx',
      'src/app/checkout/[sessionId]/checkout-client.tsx',
      'src/app/bookings/[bookingId]/home-space/client.tsx',
      'src/app/property/onboard/wizard.tsx',
      'src/components/ops/UnifiedStayCalendar.tsx',
      'src/app/ops/stays/page.tsx',
      'src/app/ops/stays/[bookingId]/page.tsx',
      'src/app/ops/stays/[bookingId]/check-in/page.tsx',
      'src/app/ops/stays/[bookingId]/check-in/check-in-wizard.tsx',
      'src/app/ops/night-audit/page.tsx',
      'src/app/ops/housekeeping/page.tsx',
      'src/app/ops/maintenance/page.tsx',
      'src/app/mc/client.tsx',
    ]) {
      const contents = source(path);
      expect(contents.includes('stitch-workspace') || contents.includes('stitch-panel')).toBe(true);
    }
  });

  it('keeps shared Stitch composition primitives centralized', () => {
    const css = source('src/app/globals.css');
    const shells = source('src/components/stitch/StitchShells.tsx');
    const premium = source('src/components/premium/PremiumPrimitives.tsx');

    for (const token of [
      '.stitch-workspace',
      '.stitch-page',
      '.stitch-hero',
      '.stitch-hero-dark',
      '.stitch-panel',
      '.stitch-control',
    ]) {
      expect(css).toContain(token);
    }
    expect(shells).toContain('StitchWorkspaceShell');
    expect(shells).toContain('StitchConsumerShell');
    expect(premium).toContain('RecordPageHeader');
    expect(premium).toContain('ProcessStepper');
    expect(premium).toContain('CtaBar');
  });

  it('keeps PMS gaps on canonical writers rather than duplicate engines', () => {
    const checkin = source('src/app/ops/stays/[bookingId]/check-in/check-in-wizard.tsx');
    const actions = source('src/components/ops/StayActions.tsx');
    const close = source('src/app/ops/night-audit/page.tsx');
    const stay = source('src/app/ops/stays/[bookingId]/page.tsx');
    const passports = source('src/app/bookings/[bookingId]/passports/passports-client.tsx');

    expect(checkin).toContain("/api/bookings/'+encodeURIComponent(bookingId)+'/checkin");
    expect(actions).toContain("/check-in");
    expect(close).toContain('prisma.ledgerEntry.findMany');
    expect(close).toContain('/admin/finance/reconciliation');
    expect(stay).toContain('serviceOrders');
    expect(stay).toContain('depositPreauth');
    expect(stay).toContain('conditionReports');
    expect(passports).not.toContain('type="date"');
  });
  it('keeps public landing, trust and legal pages on Stitch page compositions', () => {
    for (const path of [
      'src/app/(public)/guests/page.tsx',
      'src/app/(public)/buyers/page.tsx',
      'src/app/(public)/providers/page.tsx',
      'src/app/(public)/management-companies/page.tsx',
      'src/app/(public)/developers/page.tsx',
      'src/app/(public)/about/page.tsx',
      'src/app/(public)/trust/page.tsx',
      'src/app/(public)/trust/ombudsman/page.tsx',
      'src/app/(public)/help/page.tsx',
      'src/app/(public)/legal/privacy/page.tsx',
      'src/app/(public)/legal/terms/page.tsx',
      'src/app/announcements/page.tsx',
      'src/app/(public)/projects/[slug]/categories/[categoryKey]/page.tsx',
      'src/app/(public)/projects/[slug]/amenities/page.tsx',
      'src/app/(public)/projects/[slug]/amenities/[amenitySlug]/page.tsx',
      'src/app/(public)/projects/[slug]/amenities/[amenitySlug]/book/page.tsx',
    ]) {
      expect(source(path)).toMatch(/AudienceLanding|StitchMain|stitch-workspace/);
    }
  });
});
