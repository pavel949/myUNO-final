import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Agent quote money authority', () => {
  const route = readFileSync('src/app/api/agent/quotes/route.ts', 'utf8');
  const service = readFileSync('src/modules/distribution/agent.service.ts', 'utf8');
  const form = readFileSync('src/components/agent/AgentQuoteForm.tsx', 'utf8');

  it('does not accept agent-selected commission or discount from the public agent API', () => {
    expect(route).not.toContain('commissionPct');
    expect(route).not.toContain('discountThb');
    expect(form).not.toContain('Commission %');
    expect(form).not.toContain('Discount THB');
  });

  it('keeps commission server-controlled and uses canonical pricing', () => {
    expect(service).toContain('const commissionRateBps = distribution.defaultAgentCommissionBps');
    expect(service).toContain('computePriceBreakdown(');
    expect(service).toContain('checkAvailability(');
    expect(service).toContain('discountSatang: 0');
  });
});
