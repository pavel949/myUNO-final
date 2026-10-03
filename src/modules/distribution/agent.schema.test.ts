import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Agent Distribution OS schema', () => {
  const schema = readFileSync('prisma/schema.prisma', 'utf8');

  it('uses canonical Unit and Booking rather than duplicating inventory', () => {
    expect(schema).toContain('model AgentQuoteItem {');
    expect(schema).toContain('unit Unit @relation');
    expect(schema).toContain('model AgentShortlistItem {');
    expect(schema).toContain('booking Booking? @relation');
    expect(schema).toContain('model Unit {');
    expect(schema).toContain('model Booking {');
  });

  it('supports client protection, shortlists, quotes, commissions and share links', () => {
    for (const model of [
      'AgentClientProtection',
      'AgentShortlist',
      'AgentQuote',
      'AgentCommission',
      'AgentSharedLink',
    ]) {
      expect(schema).toContain('model ' + model + ' {');
    }
  });

  it('adds agent role and agency organization types additively', () => {
    expect(schema).toContain('agent_member');
    expect(schema).toContain('agency');
    expect(schema).toContain('distribution_partner');
  });
});
