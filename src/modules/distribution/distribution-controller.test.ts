import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Distribution controller invariants', () => {
  const migration = readFileSync(
    'prisma/migrations/20261003083000_distribution_controller/migration.sql',
    'utf8',
  );
  const policy = readFileSync('src/modules/distribution/policy.service.ts', 'utf8');
  const quote = readFileSync('src/modules/distribution/agent.service.ts', 'utf8');

  it('keeps distribution policy additive on CommercialOffering', () => {
    expect(migration).toContain('REFERENCES "commercial_offering"("id")');
    expect(migration).toContain('ALTER TABLE "agent_quote_item" ADD COLUMN "offering_id"');
    expect(migration).not.toContain('CREATE TABLE "unit"');
    expect(migration).not.toContain('CREATE TABLE "booking"');
  });

  it('does not permit request availability to instant book', () => {
    expect(policy).toContain("input.availabilityMode === 'request' && input.bookingMode === 'instant'");
    expect(policy).toContain("throw new Error('REQUEST_AVAILABILITY_CANNOT_INSTANT_BOOK')");
  });

  it('resolves live/synced/request confidence through canonical availability', () => {
    expect(policy).toContain('checkAvailability(db, input.unitId, input.startDate, input.endDate)');
    expect(policy).toContain("if (policy.availabilityMode === 'request') return 'request'");
    expect(policy).toContain("return ageMinutes > policy.staleAfterMinutes ? 'stale' : 'synced'");
  });

  it('takes agent commission and markup limits from server policy', () => {
    expect(quote).toContain('distribution.defaultAgentCommissionBps');
    expect(quote).toContain('distribution.maxAgentMarkupBps');
    expect(quote).toContain("throw new Error('AGENT_MARKUP_EXCEEDS_POLICY')");
    expect(quote).toContain('discountSatang: 0');
  });
});
